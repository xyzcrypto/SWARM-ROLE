"use client";

import { getRealtimeClient } from "@/lib/realtimeClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * One owner per realtime topic, with callbacks fanned out to every consumer.
 *
 * ## The bug this fixes
 *
 * `getRealtimeClient()` deliberately returns ONE Supabase client per tab, to
 * avoid opening a websocket per hook. But supabase-js reuses channels by topic:
 *
 * ```js
 * channel(topic) {
 *   const exists = this.getChannels().find(c => c.topic === realtimeTopic);
 *   return exists ?? new RealtimeChannel(...);   // <- the same object
 * }
 * ```
 *
 * and once `.subscribe()` has been called on a channel, adding another listener
 * throws:
 *
 * ```
 * cannot add `presence` callbacks for realtime:site-visitors after `subscribe()`
 * cannot add `presence` callbacks for realtime:community after `subscribe()`
 * ```
 *
 * Both of those were live in production. `site-visitors` was created from five
 * places (RealtimeSession, the dashboard's live-online tile, useLivePresence,
 * useUserOnline twice) and `community` from two (ChatClient, NavActivity).
 * Whichever mounted first subscribed; every later one got that already-
 * subscribed channel, threw, and **its callback was never registered**.
 *
 * That is why the online count did not update, and why it "worked after a
 * refresh": a reload changes the mount order, so sometimes the component that
 * needed presence won the race.
 *
 * ## How this fixes it
 *
 * Nothing outside this module calls `client.channel()`. The registry owns each
 * topic: it registers exactly one presence listener and one wildcard broadcast
 * listener **before** the single `subscribe()`, then dispatches to consumers
 * from its own sets. Consumers can come and go freely afterwards, because they
 * never touch the channel.
 */

type PresenceCb = (state: Record<string, Array<Record<string, unknown>>>) => void;
type BroadcastCb = (payload: unknown) => void;
type StatusCb = (status: string, err?: unknown) => void;

type Entry = {
  topic: string;
  presenceKey?: string;
  channel: RealtimeChannel | null;
  presence: Set<PresenceCb>;
  broadcast: Map<string, Set<BroadcastCb>>;
  status: Set<StatusCb>;
  lastStatus: string;
  refs: number;
  /** Latest presence payload, replayed to consumers that arrive after a sync. */
  lastPresence: Record<string, Array<Record<string, unknown>>> | null;
  building: Promise<void> | null;
};

const entries = new Map<string, Entry>();

function entryFor(topic: string): Entry {
  let e = entries.get(topic);
  if (!e) {
    e = {
      topic,
      channel: null,
      presence: new Set(),
      broadcast: new Map(),
      status: new Set(),
      lastStatus: "idle",
      refs: 0,
      lastPresence: null,
      building: null,
    };
    entries.set(topic, e);
  }
  return e;
}

/**
 * Build (or rebuild) the channel for a topic with every handler attached before
 * subscribing. Rebuilding is safe precisely because the handlers live here and
 * not on the channel - which is what makes a late presence key possible.
 */
async function build(e: Entry, url: string, anonKey: string): Promise<void> {
  const client = await getRealtimeClient(url, anonKey);

  if (e.channel) {
    try {
      await e.channel.unsubscribe();
      client.removeChannel(e.channel);
    } catch {
      /* already gone */
    }
    e.channel = null;
  }

  const ch = client.channel(e.topic, e.presenceKey ? { config: { presence: { key: e.presenceKey } } } : undefined);

  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState() as Record<string, Array<Record<string, unknown>>>;
    e.lastPresence = state;
    e.presence.forEach((cb) => {
      try {
        cb(state);
      } catch {
        /* one bad consumer must not stop the others */
      }
    });
  });

  // A single wildcard binding, dispatched by name. Registering per-event
  // bindings lazily is what would reintroduce the original bug the moment a
  // consumer asked for an event after subscribe().
  ch.on("broadcast", { event: "*" }, (message: { event?: string; payload?: unknown }) => {
    const set = e.broadcast.get(String(message?.event ?? ""));
    if (!set) return;
    set.forEach((cb) => {
      try {
        cb(message?.payload);
      } catch {
        /* as above */
      }
    });
  });

  ch.subscribe((status, err) => {
    e.lastStatus = status;
    e.status.forEach((cb) => {
      try {
        cb(status, err);
      } catch {
        /* as above */
      }
    });
  });

  e.channel = ch;
}

export type SharedChannel = {
  onPresence: (cb: PresenceCb) => () => void;
  onBroadcast: (event: string, cb: BroadcastCb) => () => void;
  onStatus: (cb: StatusCb) => () => void;
  /** Announce this tab into the topic's presence. No-op until subscribed. */
  track: (payload: Record<string, unknown>) => void;
  /** Broadcast on this topic (e.g. the chat's typing indicator). */
  send: (event: string, payload: Record<string, unknown>) => void;
  /** Drop this consumer's claim; the channel closes when the last one leaves. */
  release: () => void;
};

/**
 * Join a shared topic. Every consumer gets its own handle; the underlying
 * channel is created once and torn down when the last handle is released.
 *
 * `presenceKey` identifies THIS TAB in the topic's presence. Pass it from the
 * one consumer that represents the user (the rest are observers). If it arrives
 * after the channel was built, the channel is rebuilt with it - one browser tab
 * must appear once, and previously the five `site-visitors` callers each tried
 * to impose their own key on the same channel.
 */
export function joinSharedChannel(
  url: string,
  anonKey: string,
  topic: string,
  presenceKey?: string
): SharedChannel {
  const e = entryFor(topic);
  e.refs += 1;

  const needsRebuild = !!presenceKey && e.presenceKey !== presenceKey;
  if (presenceKey) e.presenceKey = presenceKey;

  if (!e.channel || needsRebuild) {
    e.building = (e.building ?? Promise.resolve())
      .then(() => build(e, url, anonKey))
      .catch(() => {
        /* surfaced through onStatus; nothing useful to do here */
      });
  }

  let released = false;
  const mine = { presence: new Set<PresenceCb>(), status: new Set<StatusCb>(), broadcast: [] as Array<[string, BroadcastCb]> };

  return {
    onPresence(cb) {
      e.presence.add(cb);
      mine.presence.add(cb);
      // Replay the last sync so a consumer that mounts mid-session is not blank
      // until the next presence change.
      if (e.lastPresence) {
        try {
          cb(e.lastPresence);
        } catch {
          /* ignore */
        }
      }
      return () => {
        e.presence.delete(cb);
        mine.presence.delete(cb);
      };
    },
    onBroadcast(event, cb) {
      let set = e.broadcast.get(event);
      if (!set) {
        set = new Set();
        e.broadcast.set(event, set);
      }
      set.add(cb);
      mine.broadcast.push([event, cb]);
      return () => {
        e.broadcast.get(event)?.delete(cb);
      };
    },
    onStatus(cb) {
      e.status.add(cb);
      mine.status.add(cb);
      if (e.lastStatus !== "idle") {
        try {
          cb(e.lastStatus);
        } catch {
          /* ignore */
        }
      }
      return () => {
        e.status.delete(cb);
        mine.status.delete(cb);
      };
    },
    track(payload) {
      void e.building?.then(() => {
        try {
          e.channel?.track(payload);
        } catch {
          /* not subscribed yet; the next status callback can retry */
        }
      });
    },
    send(event, payload) {
      void e.building?.then(() => {
        try {
          void e.channel?.send({ type: "broadcast", event, payload });
        } catch {
          /* not subscribed; the sender treats this as best-effort */
        }
      });
    },
    release() {
      if (released) return;
      released = true;
      mine.presence.forEach((cb) => e.presence.delete(cb));
      mine.status.forEach((cb) => e.status.delete(cb));
      mine.broadcast.forEach(([event, cb]) => e.broadcast.get(event)?.delete(cb));
      e.refs = Math.max(0, e.refs - 1);
      if (e.refs === 0) {
        const ch = e.channel;
        e.channel = null;
        e.lastPresence = null;
        e.lastStatus = "idle";
        void (async () => {
          if (!ch) return;
          try {
            const client = await getRealtimeClient(url, anonKey);
            await ch.unsubscribe();
            client.removeChannel(ch);
          } catch {
            /* already gone */
          }
        })();
      }
    },
  };
}
