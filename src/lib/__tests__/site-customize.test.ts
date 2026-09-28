import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applySitePrefs, DEFAULT_SITE, parseSitePrefs, type SitePrefs } from "@shared/utils/site-prefs";

const read = (f: string) => readFileSync(f, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

/** Run the REAL pre-paint script from layout.tsx against a fake <html>. */
function prePaint(store: Record<string, string>, opts: { coarse?: boolean; w?: number } = {}): string {
  const src = read("src/app/layout.tsx");
  const code = JSON.parse(/"\(function\(\)\{var d=document\.documentElement;[^"]+"/.exec(src)![0]) as string;
  const cls = new Set(["dark"]);
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, localStorage: g.localStorage, navigator: g.navigator, matchMedia: g.matchMedia, window: g.window };
  g.document = { documentElement: { classList: { add: (c: string) => cls.add(c), remove: (c: string) => cls.delete(c) } } };
  g.localStorage = { getItem: (k: string) => store[k] ?? null };
  Object.defineProperty(g, "navigator", { value: { connection: {}, hardwareConcurrency: 8 }, configurable: true });
  g.matchMedia = () => ({ matches: !!opts.coarse });
  g.window = { screen: { width: opts.w ?? 1440, height: 900 }, innerWidth: 1440 };
  try { new Function(code)(); } finally {
    for (const [k, v] of Object.entries(saved)) Object.defineProperty(g, k, { value: v, configurable: true, writable: true });
  }
  return [...cls].sort().join(" ");
}

/** Run applySitePrefs against a fake <html> starting from the same classes. */
function live(p: SitePrefs, start = ["dark"]): string {
  const cls = new Set(start);
  const root = { classList: { toggle: (c: string, on?: boolean) => { if (on ?? !cls.has(c)) cls.add(c); else cls.delete(c); }, add: (c: string) => cls.add(c), remove: (c: string) => cls.delete(c) } } as unknown as HTMLElement;
  applySitePrefs(p, root);
  return [...cls].sort().join(" ");
}

describe("Customize website: stored choices", () => {
  it("defaults, and survive corrupted storage", () => {
    expect(parseSitePrefs(null, null, null)).toEqual(DEFAULT_SITE);
    expect(parseSitePrefs("purple", "turbo", "{nope")).toEqual(DEFAULT_SITE);
    expect(parseSitePrefs(null, null, JSON.stringify({ scale: 300 }))).toEqual(DEFAULT_SITE);
  });
  it("keep valid choices", () => {
    expect(parseSitePrefs("light", "off", JSON.stringify({ scale: 125, effects: false, blur: false }))).toEqual({ theme: "light", motion: "off", scale: 125, effects: false, blur: false });
  });
});

describe("the pre-paint script and the live apply agree", () => {
  it("default: nothing changes for anyone who never opened the panel", () => {
    expect(prePaint({})).toBe("dark");
    expect(live(DEFAULT_SITE)).toBe("dark");
  });
  it("animations off", () => {
    expect(prePaint({ motion: "off" })).toBe("dark lite-motion motion-off");
    expect(live({ ...DEFAULT_SITE, motion: "off" })).toBe("dark lite-motion motion-off");
  });
  it("text size, effects, blur, light theme", () => {
    const store = { theme: "light", "xyz.ui": JSON.stringify({ scale: 110, effects: false, blur: false }) };
    const p = parseSitePrefs("light", null, store["xyz.ui"]);
    expect(prePaint(store)).toBe("no-blur no-effects text-scale-110");
    expect(live(p)).toBe("no-blur no-effects text-scale-110");
  });
  it("the automatic phone tier is untouched", () => {
    expect(prePaint({}, { coarse: true, w: 390 })).toBe("dark lite-motion");
  });
});

describe("wiring", () => {
  it("framer-motion honours Off (context only, no DOM)", () => {
    expect(read("src/app/providers.tsx")).toMatch(/<MotionConfig reducedMotion=\{motion === "off" \? "always" : "never"\}>/);
  });
  it("CSS for every class", () => {
    const css = read("src/app/globals.css");
    for (const c of ["html.text-scale-110", "html.motion-off *", "html.no-effects .mesh", "html.no-blur *"]) expect(css, c).toContain(c);
  });
  it("reachable from the navbar, the mobile menu, the chat side menu and Settings", () => {
    expect(read("src/shared/components/Navbar.tsx").match(/openCustomize/g)?.length).toBeGreaterThanOrEqual(3);
    expect(read("src/shared/components/AppMenu.tsx")).toMatch(/openCustomize\(\)/);
    expect(read("src/modules/settings/components/SettingsClient.tsx")).toMatch(/<CustomizePanel \/>/);
    expect(read("src/app/layout.tsx")).toMatch(/<CustomizeSheetMount \/>/);
  });
  it("switch knobs are anchored to the left of their track", () => {
    // A probe measured the knob at 46px in a 48px track: `absolute` with no
    // `left` starts from the button's centred content, not its edge.
    for (const f of ["src/shared/components/CustomizePanel.tsx", "src/modules/community/components/ChatAppearanceSheet.tsx"]) {
      expect(read(f), f).toMatch(/absolute left-0 top-0\.5 h-5 w-5 rounded-full bg-white shadow/);
    }
  });
});

describe("community bookmarks", () => {
  const route = strip(read("src/app/api/chat/messages/[id]/bookmark/route.ts"));
  it("both handlers: signed-in, two rate-limit keys, cuid-checked", () => {
    expect([...route.matchAll(/if \(!success\) return/g)]).toHaveLength(4);
    expect([...route.matchAll(/isCuid\(params\.id\)/g)]).toHaveLength(2);
  });
  it("only a visible message can be bookmarked; idempotent", () => {
    expect(route).toMatch(/findFirst\(\{ where: \{ id: params\.id, status: "visible" \}/);
    expect(route).toMatch(/upsert\(/);
  });
  it("my-bookmarks list is private and tolerant of an un-migrated DB", () => {
    const g = strip(read("src/app/api/chat/bookmarks/route.ts"));
    expect(g).toMatch(/"Cache-Control": "private, no-store"/);
    expect(g).toMatch(/\.catch\(\(\) => \[\]/);
  });
  it("the profile shows only VISIBLE messages, and never errors before migration 42", () => {
    const pg = read("src/app/u/[username]/page.tsx");
    expect(pg).toMatch(/prisma\.chatBookmark\s*\.findMany\(\{\s*where: \{ userId: user\.id, message: \{ status: "visible" \} \}/);
    expect(pg).toMatch(/take: 24,[\s\S]{0,400}\.catch\(\(\) => \[\]\)/);
  });
  it("schema + idempotent migration", () => {
    expect(read("prisma/schema.prisma")).toMatch(/@@unique\(\[userId, messageId\]\) \/\/ one bookmark per member per message/);
    const sql = read("prisma/migrations/42_chat_bookmarks/migration.sql");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "ChatBookmark"/);
    expect(sql).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL/);
  });
  it("Saved stays private: the tab appears only for the profile's owner", () => {
    const lib = read("src/modules/profile/components/ProfileLibrary.tsx");
    expect(lib).toMatch(/const active = isOwner \? tab : "bookmarks";/);
    expect(lib).toMatch(/\{isOwner && \(/);
  });
});

describe("voice notes for every member in the room", () => {
  it("the Voice option is not admin-gated; Photo still is", () => {
    const room = read("src/modules/community/components/ChatClient.tsx");
    expect(room).toMatch(/\{ key: "voice", label: "Voice message", icon: VoiceIcon, busy: voiceBusy, onSelect: \(\) => setRecording\(true\) \},/);
    expect(room).toMatch(/\.\.\.\(me\.isAdmin \? \[\{ key: "photo"/);
  });
});
