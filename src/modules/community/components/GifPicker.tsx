"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

type Gif = { id: string; url: string; preview: string; width: number; height: number };

// Giphy-backed GIF picker for the community composer. Opens as a popover above
// the input; searching hits /api/chat/gif (key stays server-side). Picking a GIF
// calls onPick(url) with the full GIF url, which is sent as a chat message.
export function GifPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    setLoading(true);
    setErr(null);
    const t = setTimeout(() => {
      fetch(`/api/chat/gif?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j) => {
          if (stop) return;
          setGifs(Array.isArray(j?.gifs) ? j.gifs : []);
          setLoading(false);
        })
        .catch(() => {
          if (stop) return;
          setErr("Couldn't load GIFs.");
          setLoading(false);
        });
    }, q.trim() ? 350 : 0); // debounce typed searches; load trending instantly
    return () => { stop = true; clearTimeout(t); };
  }, [q]);

  // Close on Escape.
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button className="fixed inset-0 z-30 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        ref={boxRef}
        className="absolute bottom-full left-0 z-40 mb-2 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-elevate"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search GIFs…"
            className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-zinc-500 hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Loading…</p>
          ) : err ? (
            <p className="py-8 text-center text-sm text-zinc-500">{err}</p>
          ) : gifs.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No GIFs found.</p>
          ) : (
            <div className="columns-2 gap-2 sm:columns-3">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onPick(g.url)}
                  className="mb-2 block w-full overflow-hidden rounded-lg ring-1 ring-white/10 transition-transform hover:scale-[1.03]"
                  aria-label="Send GIF"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.preview} alt="" loading="lazy" className="w-full" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-white/10 px-3 py-1.5 text-right">
          <span className="mono text-[9px] uppercase tracking-wider text-zinc-600">Powered by GIPHY</span>
        </div>
      </div>
    </>
  );
}
