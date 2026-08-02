// Lazy loader for anime.js v4 (named-export API: animate, createTimeline,
// stagger, ...). anime.js is only needed for opt-in micro-interactions, so we
// import it on demand to keep it out of the initial bundle. Respect reduced
// motion at the call site.
//
// Usage:
//   const { animate } = await loadAnime();
//   animate(el, { translateY: [8, 0], opacity: [0, 1], duration: 400 });
export async function loadAnime() {
  return import("animejs");
}

/** True when the user prefers reduced motion (guard micro-interactions). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
