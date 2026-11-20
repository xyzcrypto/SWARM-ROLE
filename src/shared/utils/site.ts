export const site = {
  name: "XYZ Crypto",
  slogan: "The Home Of Next Gen Web3..",
  description:
    "A next-generation Web3 ecosystem, research, trading tools, perp DEX, airdrop tools, premium intelligence & education.",
  email: "shorttechinfo@gmail.com",
  socials: {
    youtube: "https://youtube.com/@xyzcrypto?si=FphRZcC3mdSVnN7j",
    x: "https://x.com/XYZCryptos",
    telegram: "https://t.me/X_Y_Z_Crypto",
    linkedin: "https://www.linkedin.com/company/xyzcrypto/",
  },
  // Direct support contact (personal Telegram).
  support: {
    telegram: "AneQueM",
    telegramUrl: "https://t.me/AneQueM",
  },
  ecosystem: {
    web3Academy: "https://t.me/X_Y_Z_Web3",
    tradeKaroVerse: "https://t.me/TradeKaro_Verse",
  },
  /**
   * The running list of perp DEX airdrops worth farming, maintained in the
   * Telegram channel.
   *
   * It lives here rather than inline in the points page because it is a
   * published destination like any other social link, and because a channel
   * post id is exactly the kind of value that gets hardcoded once and then
   * cannot be found when it needs updating.
   */
  farming: {
    ongoingAirdrops: "https://t.me/X_Y_Z_Crypto/16537",
  },
};

/**
 * Every destination in the site navigation. This is the COMPLETE list and it
 * stays complete: the footer and the mobile drawer both render it, so anything
 * removed here stops being reachable by navigation at all.
 */
export const navLinks = [
  { label: "Home", href: "/" },
  { label: "Markets", href: "/markets" },
  { label: "Points", href: "/points" },
  { label: "Tools", href: "/tools" },
  { label: "News", href: "/news" },
  { label: "Research", href: "/research" },
  { label: "Academy", href: "/academy" },
  { label: "Creators", href: "/creators" },
  // Per-member, so it lives in "More" rather than the rail - but it MUST be in
  // this list, because a page absent from `navLinks` is a page that cannot be
  // reached from anywhere (the footer and the mobile drawer both render it).
  { label: "Saved", href: "/saved" },
  { label: "Community", href: "/community" },
  { label: "Premium", href: "/premium" },
  { label: "Feedback", href: "/feedback" },
  { label: "Contact", href: "/contact" },
];

/**
 * What the DESKTOP RAIL shows directly. Everything else moves into the rail's
 * "More" dropdown.
 *
 * ⚠️ The two lists below are DERIVED from `navLinks`, never written out by
 * hand, and that is the whole point: a link can only ever be in exactly one of
 * them, and adding one to `navLinks` puts it in "More" rather than nowhere.
 * Two hand-maintained arrays would drift, and the failure mode is a page that
 * quietly cannot be reached from anywhere - which is exactly what happened to
 * Sodex and RiseX on /points.
 */
// ⚠️ `/points` takes `/premium`'s place on the rail rather than being added
// alongside it. The rail is SIX links wide at its breakpoint and was already
// measured as eight pixels from overflowing - a seventh would wrap, which is
// how a nav stops looking designed. Premium moves into "More", where it is
// still reachable from the rail, the footer and the mobile drawer, because it
// stays in `navLinks`.
// Academy and Creators joined the rail on 2026-11-20 at the owner's request
// (8 links). Re-measured at the rail's breakpoint (xl, 1280px) signed in and
// signed out - see nav-rail-width.test.ts for the numbers and the padding step.
const RAIL_HREFS = new Set(["/", "/markets", "/points", "/news", "/research", "/academy", "/creators", "/community"]);

export const railLinks = navLinks.filter((l) => RAIL_HREFS.has(l.href));
export const moreLinks = navLinks.filter((l) => !RAIL_HREFS.has(l.href));
