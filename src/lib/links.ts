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
  // `\/(?!\/)` - a root-relative path must NOT start with a second slash. A
  // protocol-relative URL like //evil.example is resolved by the browser as an
  // absolute off-site address, so the old `\/` branch let any external host
  // through while looking like it only permitted internal paths.
  if (/^(https?:|mailto:|\/(?!\/)|#)/i.test(url)) return url;
  return null;
}

/** Trim punctuation that commonly trails a pasted URL so the target stays clean. */
export function cleanBareUrl(raw: string): string {
  return raw.replace(/[.,;:!?)\]]+$/, "");
}
