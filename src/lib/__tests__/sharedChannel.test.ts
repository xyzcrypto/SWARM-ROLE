import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The production bug, reproduced against a fake client.
 *
 * supabase-js returns the SAME channel object for a topic that already exists,
 * and throws if you add a listener after `subscribe()`. With five consumers on
 * `site-visitors` and two on `community`, whichever mounted second lost its
 * listeners. These tests pin the properties that make that impossible:
 * one channel per topic, every listener attached before the single subscribe,
 * and consumers fanned out from the registry instead of from the channel.
 */

type Handler = (...args: unknown[]) => void;

class FakeChannel {
  subscribed = false;
  binds: Array<{ type: string; filter: unknown }> = [];
  presenceHandler?: Handler;
  broadcastHandler?: Handler;
  statusHandler?: Handler;
  tracked: unknown[] = [];
  sent: Array<{ event: string; payload: unknown }> = [];
  state: Record<string, unknown[]> = {};

  constructor(public topic: string, public params?: unknown) {}

  on(type: string, filter: { event?: string }, cb: Handler) {
    // This is the real library's rule, and the whole reason for the registry.
    if (this.subscribed) throw new Error(`cannot add \`${type}\` callbacks for ${this.topic} after \`subscribe()\`.`);
    this.binds.push({ type, filter });
    if (type === "presence") this.presenceHandler = cb;
    if (type === "broadcast") this.broadcastHandler = cb;
    return this;
  }
  subscribe(cb?: Handler) {
    this.subscribed = true;
    this.statusHandler = cb;
    cb?.("SUBSCRIBED");
    return this;
  }
  presenceState() { return this.state; }
  track(p: unknown) { this.tracked.push(p); }
  send(m: { event: string; payload: unknown }) { this.sent.push(m); }
  unsubscribe() { return Promise.resolve("ok"); }
}

class FakeClient {
  channels = new Map<string, FakeChannel>();
  created = 0;
  channel(topic: string, params?: unknown) {
    // Mirrors RealtimeClient.channel(): reuse by topic.
    const existing = this.channels.get(topic);
    if (existing) return existing;
    this.created += 1;
    const ch = new FakeChannel(topic, params);
    this.channels.set(topic, ch);
    return ch;
  }
  removeChannel(ch: FakeChannel) { this.channels.delete(ch.topic); }
}

let client: FakeClient;
vi.mock("@/lib/realtimeClient", () => ({
  getRealtimeClient: () => Promise.resolve(client as never),
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("joinSharedChannel", () => {
  beforeEach(() => {
    client = new FakeClient();
    vi.resetModules();
  });

  it("creates ONE channel for a topic no matter how many consumers join", async () => {
    const { joinSharedChannel } = await import("@/lib/sharedChannel");
    const a = joinSharedChannel("u", "k", "site-visitors", "tab-1");
    const b = joinSharedChannel("u", "k", "site-visitors");
    const c = joinSharedChannel("u", "k", "site-visitors");
    a.onPresence(() => {});
    b.onPresence(() => {});
    c.onPresence(() => {});
    await flush();
    expect(client.channels.size).toBe(1);
  });

  it("never adds a listener after subscribe - the exact production throw", async () => {
    const { joinSharedChannel } = await import("@/lib/sharedChannel");
    const first = joinSharedChannel("u", "k", "community", "me");
    first.onPresence(() => {});
    await flush();
    const ch = client.channels.get("community")!;
    expect(ch.subscribed).toBe(true);
    const bindsAtSubscribe = ch.binds.length;

    // A second consumer arriving later must NOT touch the channel. Before the
    // registry this threw and silently lost the listener.
    const second = joinSharedChannel("u", "k", "community");
    expect(() => second.onPresence(() => {})).not.toThrow();
    expect(() => second.onBroadcast("new_message", () => {})).not.toThrow();
    expect(ch.binds.length).toBe(bindsAtSubscribe);
  });

  it("delivers presence to EVERY consumer, including one that joined late", async () => {
    const { joinSharedChannel } = await import("@/lib/sharedChannel");
    const seenA: unknown[] = [];
    const seenB: unknown[] = [];
    const a = joinSharedChannel("u", "k", "site-visitors", "tab-1");
    a.onPresence((s) => seenA.push(s));
    await flush();

    const ch = client.channels.get("site-visitors")!;
    ch.state = { "tab-1": [{ id: "u1" }] };
    ch.presenceHandler?.();

    const b = joinSharedChannel("u", "k", "site-visitors");
    b.onPresence((s) => seenB.push(s));

    expect(seenA).toHaveLength(1);
    // The late joiner is replayed the last sync rather than sitting blank.
    expect(seenB).toHaveLength(1);

    ch.state = { "tab-1": [{ id: "u1" }], "tab-2": [{ id: "u2" }] };
    ch.presenceHandler?.();
    expect(seenA).toHaveLength(2);
    expect(seenB).toHaveLength(2);
  });

  it("routes a broadcast only to the consumers that asked for that event", async () => {
    const { joinSharedChannel } = await import("@/lib/sharedChannel");
    const news: unknown[] = [];
    const typing: unknown[] = [];
    const a = joinSharedChannel("u", "k", "community", "me");
    a.onBroadcast("new_message", (p) => news.push(p));
    const b = joinSharedChannel("u", "k", "community");
    b.onBroadcast("typing", (p) => typing.push(p));
    await flush();

    const ch = client.channels.get("community")!;
    ch.broadcastHandler?.({ event: "new_message", payload: { id: "m1" } });
    ch.broadcastHandler?.({ event: "typing", payload: { userId: "u2" } });
    ch.broadcastHandler?.({ event: "unheard", payload: {} });

    expect(news).toEqual([{ id: "m1" }]);
    expect(typing).toEqual([{ userId: "u2" }]);
  });

  it("keeps the channel alive until the LAST consumer releases it", async () => {
    const { joinSharedChannel } = await import("@/lib/sharedChannel");
    const a = joinSharedChannel("u", "k", "site-visitors", "tab-1");
    const b = joinSharedChannel("u", "k", "site-visitors");
    a.onPresence(() => {});
    b.onPresence(() => {});
    await flush();
    expect(client.channels.size).toBe(1);

    a.release();
    await flush();
    expect(client.channels.size).toBe(1); // b is still watching

    b.release();
    await flush();
    expect(client.channels.size).toBe(0);
  });

  it("stops delivering to a consumer that released", async () => {
    const { joinSharedChannel } = await import("@/lib/sharedChannel");
    const got: unknown[] = [];
    const keep = joinSharedChannel("u", "k", "community", "me");
    keep.onBroadcast("new_message", () => {});
    const gone = joinSharedChannel("u", "k", "community");
    gone.onBroadcast("new_message", (p) => got.push(p));
    await flush();

    gone.release();
    client.channels.get("community")!.broadcastHandler?.({ event: "new_message", payload: 1 });
    expect(got).toEqual([]);
  });

  it("sends typing through the handle instead of the raw channel", async () => {
    const { joinSharedChannel } = await import("@/lib/sharedChannel");
    const a = joinSharedChannel("u", "k", "community", "me");
    await flush();
    a.send("typing", { userId: "u1", name: "A" });
    await flush();
    expect(client.channels.get("community")!.sent).toEqual([
      { type: "broadcast", event: "typing", payload: { userId: "u1", name: "A" } },
    ]);
  });
});
