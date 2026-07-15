export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function readingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "Mon, Jul 14" - date with weekday, for trade logs where the day matters. */
export function formatDateWithDay(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Privacy-safe email mask: keeps the first 2 chars of the local part, masks the
 * rest, keeps the domain. "rahul@gmail.com" -> "ra***@gmail.com". Short locals
 * keep 1 char. Returns "" for falsy input.
 */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return email ?? "";
  const [local, domain] = email.split("@");
  if (!local) return email;
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}***@${domain}`;
}

/**
 * Escape a value for safe inclusion in a CSV cell: wraps in quotes, doubles any
 * embedded quotes, and neutralises spreadsheet formula injection by prefixing a
 * leading = + - @ with a single quote.
 */
export function csvCell(value: unknown): string {
  const s = String(value ?? "").replace(/"/g, '""');
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe}"`;
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
