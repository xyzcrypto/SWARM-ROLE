import { afterEach, describe, expect, it, vi } from "vitest";

// Storage "configured" for every test in this file, so the Supabase branch is
// the one under test. The inline branch is covered by storage.test.ts.
vi.mock("@/lib/env", () => ({
  storageEnabled: true,
  env: {
    SUPABASE_URL: "https://proj.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    SUPABASE_STORAGE_BUCKET: "post-covers",
  },
}));

import { uploadImage } from "@/lib/storage";

const PNG = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
).buffer as ArrayBuffer;

/**
 * Stand in for Supabase: the authenticated POST always succeeds (a service-role
 * key can write to a private bucket), and `publicStatus` is what an anonymous
 * reader gets back from the `/object/public/...` URL afterwards.
 */
function mockSupabase(publicStatus: number) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, init: any = {}) => {
      const url = String(input);
      calls.push({ url, method: init.method ?? "GET" });
      if (init.method === "POST") return new Response("{}", { status: 200 });
      return new Response(null, { status: publicStatus });
    })
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("an upload is only trusted once the object is actually readable", () => {
  it("returns the Supabase URL when the bucket really is public", async () => {
    mockSupabase(206);
    const res = await uploadImage(PNG, "image/png");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.url).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/public\/post-covers\//);
    expect(res.url).not.toContain("base64");
  });

  // ⚠️ THE BUG. A private bucket accepts the service-role write and answers 200,
  // so every layer reported success - and then the browser, which has no
  // credentials, got a 400 from the `public` URL we had already saved to the
  // database. From the member's side: "I added a profile photo, it saved, and it
  // never showed up." Nothing errored, and re-uploading reproduced it forever.
  it("falls back to an inline data: URL when the bucket is NOT public", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSupabase(400);

    const res = await uploadImage(PNG, "image/png");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Inline is the path verified end-to-end (/api/media serves it), so this is
    // the photo actually rendering rather than a URL that never will.
    expect(res.url.startsWith("data:image/png;base64,")).toBe(true);
    expect(res.url).not.toContain("/object/public/");

    // And it is not silent: an owner reading the logs is told which dashboard
    // setting to change. Silence is how this survived in the first place.
    expect(err.mock.calls.flat().join(" ")).toMatch(/not publicly readable/i);
    err.mockRestore();
  });

  it("checks the same URL it is about to hand back, without credentials", async () => {
    const calls = mockSupabase(200);
    const res = await uploadImage(PNG, "image/png");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const check = calls.find((c) => c.method !== "POST");
    expect(check?.url).toBe(res.url);
  });

  // A backend that refuses HEAD/Range must not condemn a perfectly good upload,
  // but erring toward inline still leaves the member with a working photo - so
  // the check is allowed to be conservative, never optimistic.
  it("falls back to inline when the check itself cannot complete", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_i: any, init: any = {}) => {
        if (init.method === "POST") return new Response("{}", { status: 200 });
        throw new Error("network down");
      })
    );
    const res = await uploadImage(PNG, "image/png");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.url.startsWith("data:")).toBe(true);
    err.mockRestore();
  });

  it("still falls back to inline when the upload itself fails", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no bucket", { status: 404 })));
    const res = await uploadImage(PNG, "image/png");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.url.startsWith("data:")).toBe(true);
    err.mockRestore();
  });
});
