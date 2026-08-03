// App-router templates re-mount on every navigation, so this gives each route a
// quick fade/rise-in transition.
//
// ## Why this is CSS and not framer-motion, and why it has no `if`
//
// This file used to be a client component that did:
//
//     const reduced = useReducedMotion();
//     if (reduced) return <>{children}</>;
//     return <motion.div initial={{ opacity: 0, y: 8 }} ...>{children}</motion.div>;
//
// Both halves of that were bugs, and together they produced the blank/stuck
// page the owner kept reporting.
//
// 1. **The branch broke hydration on every single page.** framer-motion's
//    `useReducedMotion()` returns `null` on the server but reads `matchMedia`
//    synchronously during the FIRST client render. So for a visitor with
//    reduced motion on, the server sent `<div style="opacity:0">…</div>` and
//    the client rendered the children with no wrapper at all. The whole
//    document shifted one level and React threw `Minified React error #418`
//    (`throwOnHydrationMismatch`) on `/`, `/community`, `/u/…`, `/terms` -
//    everything - then discarded the server HTML and re-rendered the entire
//    page on the client. Reduced motion is on by default under Android battery
//    saver and iOS Low Power, which is why this looked like a mobile problem.
//
// 2. **The server shipped every page at `opacity: 0`.** Content was made
//    visible only once JavaScript hydrated. Any failure on that path - a stale
//    chunk, a throw like the one above, a phone that gave up on the bundle -
//    left a fully-populated DOM that nobody could see. A blank page.
//
// The CSS version fixes both by construction: identical markup on the server
// and the client (nothing to mismatch), and the fade is driven by the style
// sheet, so the page becomes visible with no JavaScript involved at all.
// `.route-enter` opts out under `prefers-reduced-motion` in globals.css, where
// that decision belongs - a media query, unlike a hook, is not a render input.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-enter">{children}</div>;
}
