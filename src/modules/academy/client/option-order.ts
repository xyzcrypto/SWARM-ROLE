// Live quiz anti-cheat: every player sees the four options in their own
// order, so "it's B" shared in a group chat is worthless. The order is a pure
// function of (quiz, player, question), so it is stable across refreshes and
// devices for the same player, and the server never needs to know it: the
// client still sends the ORIGINAL option index.

/** 32-bit FNV-1a. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded PRNG. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Display order of option indexes for this player on this question: order[position] = original index. */
export function optionOrder(liveId: string, userId: string | null | undefined, index: number, n = 4): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  if (!userId) return out; // guests watch in the canonical order
  const r = rng(hash(`${liveId}:${userId}:${index}`));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
