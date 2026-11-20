"use client";

import { useEffect, useState } from "react";
import { Smile } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { WHATS_NEW_TAGS, type WhatsNewTag } from "@/lib/whatsnew";
import { formatDate } from "@/lib/utils";
import { EmojiPicker } from "@/components/EmojiPicker";

type Entry = { id: string; date: string; tag: string; title: string; body: string };

const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink-700/60 px-3.5 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20";

// Dashboard "What's New" manager (gated by `whatsnew:manage`). Add manual entries
// for launches/announcements; auto entries (from research publish) also appear
// here. The homepage feed updates live via the `whatsnew_updated` broadcast.
export function WhatsNewManager() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState<WhatsNewTag>("New");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/whatsnew?limit=50")
      .then((r) => r.json())
      .then((d) => setEntries(Array.isArray(d.entries) ? d.entries : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/whatsnew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, tag }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not add entry.");
      }
      setTitle("");
      setBody("");
      setTag("New");
      load();
    } catch (e: any) {
      setError(e.message || "Could not add entry.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (id.startsWith("static-")) return; // seed/fallback rows aren't in the DB
    const res = await fetch(`/api/whatsnew/${id}`, { method: "DELETE" });
    if (res.ok) setEntries((cur) => cur.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="surface space-y-3 rounded-2xl p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-zinc-100">Add a What&apos;s New entry</h2>
        <p className="mt-1 text-xs text-zinc-500">Published entries dated in the last 7 days also pop up on the home page for visitors who haven&apos;t seen them (closes itself after 9 s).</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. New: Realtime notifications)"
          required
          maxLength={120}
          className={inputCls}
        />
        <div className="relative">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Short description of what changed… 🎉"
            required
            maxLength={1000}
            rows={3}
            className={`${inputCls} resize-none pr-10`}
          />
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-label="Insert emoji"
            className="absolute bottom-2.5 right-2 rounded-lg p-1 text-zinc-500 transition-colors hover:text-gold-200"
          >
            <Smile className="h-4 w-4" />
          </button>
          <AnimatePresence>
            {pickerOpen && (
              <EmojiPicker onPick={(e) => setBody((b) => b + e)} onClose={() => setPickerOpen(false)} />
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={tag} onChange={(e) => setTag(e.target.value as WhatsNewTag)} className={`${inputCls} sm:w-auto`}>
            {WHATS_NEW_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy} className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50">
            {busy ? "Adding…" : "Add entry"}
          </button>
        </div>
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">{error}</p>
        )}
      </form>

      <div className="surface rounded-2xl p-5 sm:p-6">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-zinc-400">Recent entries</h3>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No entries yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 ring-1 ring-white/10">
                      {e.tag}
                    </span>
                    <span className="mono text-[11px] text-zinc-600">{formatDate(e.date)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-zinc-200">{e.title}</p>
                </div>
                {!e.id.startsWith("static-") && (
                  <button
                    onClick={() => remove(e.id)}
                    className="shrink-0 text-xs font-medium text-red-300 transition-colors hover:text-red-200"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
