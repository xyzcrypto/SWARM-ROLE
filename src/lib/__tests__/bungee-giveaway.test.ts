import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import bungee from "@modules/academy/content/bungee-funded-perps.json";
import { SEED_BATCHES } from "@modules/academy/content";
import { categoryFile } from "@modules/academy/lib/content-schema";
import { optionOrder } from "@modules/academy/client/option-order";
import { BUNGEE_CATEGORY, BUNGEE_LAST_MODULE, BUNGEE_REF_URL, MIN_HUMAN_ANSWER_MS, normalizeBungeeUid, normalizeTelegram } from "@modules/giveaway/lib/bungee";

const read = (p: string) => readFileSync(p, "utf8");

describe("Bungee Funded Perps Academy track", () => {
  const file = categoryFile.parse(bungee);

  it("is a valid category, seeded as batch 3", () => {
    expect(file.slug).toBe(BUNGEE_CATEGORY);
    expect(file.modules).toHaveLength(8);
    expect(file.questions).toHaveLength(64);
    const b3 = SEED_BATCHES.find((b) => b.version === 3);
    expect(b3?.files).toContain(bungee);
    expect(Math.max(...SEED_BATCHES.map((b) => b.version))).toBe(3);
  });

  it("has 8 questions per lesson and the referral lesson last", () => {
    for (const m of file.modules) expect(file.questions.filter((q) => q.module === m.slug), m.slug).toHaveLength(8);
    expect(file.modules.at(-1)?.slug).toBe(BUNGEE_LAST_MODULE);
  });

  it("spreads correct answers evenly so 'always pick B' does not work", () => {
    const n = [0, 0, 0, 0];
    for (const q of file.questions) n[q.answer] += 1;
    expect(n).toEqual([16, 16, 16, 16]);
    for (const q of file.questions) expect(new Set(q.options).size, q.prompt).toBe(4);
  });

  it("carries the official numbers from Bungee's rulebook", () => {
    const t = JSON.stringify(bungee);
    for (const fact of ["10% profit target", "12% profit target", "9% profit target", "6% static", "5% static", "3% static", "1.5 basis points", "$20,000", "$50 after the split", "00:00 UTC", "USDC on the Base network", "Sumsub"]) {
      expect(t, fact).toContain(fact);
    }
    expect(t).not.toMatch(/[—–]/); // no em or en dashes in site copy
  });
});

describe("live quiz anti-cheat", () => {
  it("each player gets a stable permutation of the options", () => {
    const a = optionOrder("live1", "userA", 3);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    expect(optionOrder("live1", "userA", 3)).toEqual(a);
    expect(optionOrder("live1", null, 3)).toEqual([0, 1, 2, 3]);
  });

  it("orders differ between players, so a shared letter is useless", () => {
    const seen = new Set<string>();
    for (let u = 0; u < 60; u++) seen.add(optionOrder("live1", `user${u}`, 0).join(""));
    expect(seen.size).toBeGreaterThan(10);
    // and the correct option lands in every position across players
    const pos = new Set<number>();
    for (let u = 0; u < 60; u++) pos.add(optionOrder("live1", `user${u}`, 0).indexOf(2));
    expect(pos.size).toBe(4);
  });

  it("the arena renders in the player's order but still sends the original index", () => {
    const l = read("src/modules/academy/components/LiveArena.tsx");
    expect(l).toMatch(/optionOrder\(id, me\?\.userId, phaseIndex\)/);
    expect(l).toMatch(/\{order\.map\(\(i, pos\) => \{/);
    expect(l).toMatch(/LETTERS\[pos\]/);
    expect(l).toMatch(/onClick=\{\(\) => onAnswer\(i\)\}/);
    expect(l).toMatch(/order\[p\.option\] \?\? p\.option/);
    expect(l).toMatch(/action: "blur", index: phaseIndex/);
    expect(l).toMatch(/onCopy=\{\(e\) => phase\.kind === "question" && e\.preventDefault\(\)\}/);
  });

  it("instant answers score nothing, and tab switches are recorded on the server", () => {
    expect(MIN_HUMAN_ANSWER_MS).toBe(800);
    const live = read("src/modules/academy/lib/live.ts");
    expect(live).toMatch(/const tooFast = pick >= 0 && ms < MIN_HUMAN_ANSWER_MS;/);
    expect(live).toMatch(/const correct = !tooFast && pick === q\.answer;/);
    expect(live).toMatch(/export async function blurLive/);
    expect(read("src/app/api/academy/live/[id]/me/route.ts")).toMatch(/z\.literal\("blur"\)/);
    expect(read("prisma/schema.prisma")).toMatch(/blurs\s+Int\s+@default\(0\)/);
  });
});

describe("giveaway entry", () => {
  it("normalizes Telegram handles and Bungee UIDs", () => {
    expect(normalizeTelegram("@xyz_crypto")).toBe("@xyz_crypto");
    expect(normalizeTelegram("https://t.me/xyzcrypto")).toBe("@xyzcrypto");
    expect(normalizeTelegram("t.me/xyzcrypto/")).toBe("@xyzcrypto"); // pasted without the scheme
    expect(normalizeTelegram("telegram.me/xyzcrypto")).toBe("@xyzcrypto");
    expect(normalizeTelegram("123456789")).toBe("123456789");
    expect(normalizeTelegram("ab")).toBeNull();
    expect(normalizeTelegram("bad name!")).toBeNull();
    expect(normalizeBungeeUid(" 0xAbC123 ")).toBe("0xAbC123");
    expect(normalizeBungeeUid("a")).toBeNull();
    expect(normalizeBungeeUid("<script>")).toBeNull();
  });

  it("one entry per member and per Bungee UID; IP and browser stored only as salted hashes", () => {
    const schema = read("prisma/schema.prisma");
    expect(schema).toMatch(/@@unique\(\[campaign, userId\]\)/);
    expect(schema).toMatch(/@@unique\(\[campaign, bungeeUid\]\)/);
    const entry = read("src/modules/giveaway/lib/entry.ts");
    expect(entry).toMatch(/ipHash: fingerprint\(meta\.ip\)/);
    expect(entry).toMatch(/createHash\("sha256"\)\.update\(`\$\{env\.NEXTAUTH_SECRET\}:giveaway:/);
    // lesson completion is checked on the server, not taken from the screenshot
    expect(entry).toMatch(/if \(status\.lessons\.done < status\.lessons\.total\)/);
    // and refused entries are refused before any screenshot is uploaded
    const route = read("src/app/api/giveaway/bungee/route.ts");
    expect(route.indexOf("await assertCanEnter(me.id)")).toBeGreaterThan(0);
    expect(route.indexOf("await assertCanEnter(me.id)")).toBeLessThan(route.indexOf("storeScreenshot(parsed.data.proof)"));
  });

  it("routes are rate-limited, private, and staff-gated", () => {
    const pub = read("src/app/api/giveaway/bungee/route.ts");
    expect(pub).toMatch(/rateLimit\("giveawayIp", ip\)/);
    expect(pub).toMatch(/rateLimit\("giveaway", me\.id\)/);
    expect(pub).toMatch(/PRIVATE/);
    const admin = read("src/app/api/giveaway/bungee/admin/route.ts");
    expect(admin.match(/requirePermission\("academy:manage"\)/g)?.length).toBe(2);
    expect(admin).toMatch(/rateLimit\("academyAdmin", me\.id\)/);
  });
});

describe("campaign links", () => {
  it("/bungee/learn is a config redirect (no function) and /bungee/live is edge-cached", () => {
    expect(read("next.config.mjs")).toMatch(/source: "\/bungee\/learn", destination: "\/academy\/learn\/bungee-funded-perps"/);
    const live = read("src/app/bungee/live/route.ts");
    expect(live).toMatch(/public, s-maxage=30, stale-while-revalidate=30/);
    expect(live).toMatch(/currentBungeeLiveId/);
  });

  it("the last lesson carries the XYZ Crypto referral link", () => {
    expect(BUNGEE_REF_URL).toBe("https://www.bungee.exchange/dashboard/evaluations?ref=XYZCRYPTO");
    expect(read("src/modules/academy/components/LessonView.tsx")).toMatch(/<BungeeLessonCta last=\{lesson\.slug === BUNGEE_LAST_MODULE\} \/>/);
    expect(read("src/modules/giveaway/components/BungeeLessonCta.tsx")).toMatch(/href=\{BUNGEE_REF_URL\} target="_blank" rel="noopener noreferrer sponsored"/);
  });

  it("the /bungee page is a static shell", () => {
    const page = read("src/app/bungee/page.tsx");
    expect(page).not.toMatch(/force-dynamic|getServerSession|prisma/);
  });
});
