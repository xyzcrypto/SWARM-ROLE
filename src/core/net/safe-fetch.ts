import "server-only";
import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Fetch a public web page on behalf of a user, without becoming a way into the
 * server's own network (SSRF).
 *
 * The checks, and why each one is here:
 *
 * - **http(s) on the default ports only.** No `file:`, no `gopher:`, no
 *   `:6379` against something that happens to listen there.
 * - **Every resolved address is checked AT CONNECT TIME**, through the socket's
 *   own `lookup`. Checking a hostname first and then letting `fetch` resolve it
 *   again is the classic DNS-rebinding hole: the second answer can be
 *   127.0.0.1. Here the address that is validated is the address that is dialled.
 * - **Redirects are followed by hand**, a few hops at most, and each hop goes
 *   through the same gate - a public URL that 302s to 169.254.169.254 is refused.
 * - **Hard caps** on time and bytes, and HTML only. A preview needs the <head>.
 */

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
];

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}

export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = v4ToInt(ip);
    return !PRIVATE_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (v4ToInt(base) & mask);
    });
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return false;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mapped) return isPublicAddress(mapped[1]!);
    // fc00::/7 unique-local, fe80::/10 link-local, ff00::/8 multicast
    if (/^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff")) return false;
    return true;
  }
  return false;
}

/** A socket `lookup` that refuses to connect anywhere private. */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = Array.isArray(addresses) ? addresses : [];
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new Error("Refusing to connect to a private address."), { code: "EPRIVATE" }), "", 4);
    }
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

export function isFetchableUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  if (u.username || u.password) return null;
  // A literal private IP never even gets as far as DNS.
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicAddress(host)) return null;
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) return null;
  return u;
}

type Page = { url: string; html: string };

function getOnce(u: URL, timeoutMs: number, maxBytes: number): Promise<{ status: number; location?: string; html?: string }> {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(
      u,
      {
        method: "GET",
        lookup: guardedLookup,
        timeout: timeoutMs,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; XYZCryptoLinkPreview/1.0; +https://xyzcrypto.io)",
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity",
          "accept-language": "en",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location });
        }
        const type = String(res.headers["content-type"] ?? "");
        if (status !== 200 || !/text\/html|application\/xhtml/i.test(type)) {
          res.resume();
          return resolve({ status: status || 500 });
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          size += c.length;
          chunks.push(c);
          // The <head> is all a preview needs; stop reading once we have plenty.
          if (size >= maxBytes) { res.destroy(); resolve({ status, html: Buffer.concat(chunks).toString("utf8") }); }
        });
        res.on("end", () => resolve({ status, html: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchPublicHtml(raw: string, { timeoutMs = 4000, maxBytes = 256 * 1024, maxRedirects = 3 } = {}): Promise<Page | null> {
  let u = isFetchableUrl(raw);
  for (let hop = 0; u && hop <= maxRedirects; hop++) {
    const r = await getOnce(u, timeoutMs, maxBytes).catch(() => null);
    if (!r) return null;
    if (r.location) { u = isFetchableUrl(new URL(r.location, u).toString()); continue; }
    return r.html ? { url: u.toString(), html: r.html } : null;
  }
  return null;
}
