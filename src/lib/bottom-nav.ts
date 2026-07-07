// Pure routing helpers for the mobile bottom navigation (client-safe, no JSX)
// so they're unit-testable without importing the component tree.

/** Active when the current path is the item, or a sub-route of it. */
export function isBottomActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Immersive/focused routes with their own bottom UI (chat composer) or that
// shouldn't show app chrome (auth, full-screen admin). The bar is hidden there.
export const BOTTOM_HIDDEN_PREFIXES = ["/community", "/login", "/signup", "/forgot-password", "/dashboard"];

export function isBottomHidden(pathname: string): boolean {
  return BOTTOM_HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
