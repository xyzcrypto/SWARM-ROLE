/**
 * Link helpers shared by the markdown renderer. Kept in a plain .ts module (no
 * JSX) so they're trivially unit-testable.
 */

/**
 * Only allow safe link protocols (block javascript:, data:, etc.) to prevent
 * stored XSS from authored markdown. Returns the href if safe, else null.
 */
export function safeHref(raw: string): string | null {
  const url = raw.trim();
  // `\/(?![\/\\])` - a root-relative path must not be followed by a second
  // slash OR a backslash. Both `//evil.example` and `/\evil.example` are
  // resolved by the WHATWG URL parser as an absolute off-site address
  // (in a "special" scheme like https, `\` is treated as `/`), so a check
  // that only excluded `//` still let any external host through while
  // looking like it permitted internal paths only. This matches the guard
  // `LoginForm.tsx` already applies to `callbackUrl`, which excludes
  // backslashes outright.
  if (/^(https?:|mailto:|\/(?![\/\\])|#)/i.test(url)) return url;
  return null;
}

/** Trim punctuation that commonly trails a pasted URL so the target stays clean. */
export function cleanBareUrl(raw: string): string {
  return raw.replace(/[.,;:!?)\]]+$/, "");
}
