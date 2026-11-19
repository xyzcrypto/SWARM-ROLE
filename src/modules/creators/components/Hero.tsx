"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, AtSign } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import type { Board } from "@modules/creators/lib/x-index";
import type { YtCreator } from "@modules/creators/lib/scoring";
import { compact, full } from "@modules/creators/lib/game";
import { validHandle } from "@modules/creators/lib/twitterapi";
import { Avatar, CountUp } from "./ui";

// The /creators hero. Written to read like a person made it: one plain
// sentence of what this is, the action you came for (look someone up) right
// under it, and the live board beside it instead of decoration. No glow orbs
// (design-system: restraint over glow), one accent phrase.

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero({
  board,
  topChannel,
  ytVideos,
  onScan,
  onOpen,
}: {
  board: Board | null;
  topChannel: YtCreator | null;
  ytVideos: number;
  onScan: (handle: string) => void;
  onOpen: (handle: string) => void;
}) {
  const [handle, setHandle] = useState("");
  const [bad, setBad] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = validHandle(handle);
    if (!h) return setBad(true);
    setBad(false);
    setHandle("");
    onScan(h);
  };

  const week = board?.rising.slice(0, 5) ?? [];
  const weekPosts = board ? board.daily.slice(-7).reduce((s, d) => s + d.posts, 0) : 0;

  return (
    <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12">
      <div className="min-w-0">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold-400"
        >
          Creator index
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6, ease }}
          className="mt-3 font-display text-[2.1rem] font-bold leading-[1.05] tracking-tight text-content sm:text-5xl lg:text-[3.4rem]"
        >
          Who is actually moving <span className="text-shine">Variational</span> right now.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.6, ease }}
          className="mt-5 max-w-xl text-[15px] leading-relaxed text-content-muted"
        >
          We rank X accounts by what their Variational posts really earn: views, replies, reposts and saves. YouTube channels across ten perp
          DEXs are ranked by views, likes, runtime and how much they publish. Look yourself up.
        </motion.p>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6, ease }}
          className="mt-7 max-w-xl"
        >
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl border bg-ink-900/70 p-1.5 pl-3.5 transition-colors focus-within:border-gold-400/60",
              bad ? "border-red-400/60" : "border-hairline"
            )}
          >
            <AtSign className="h-4 w-4 shrink-0 text-gold-300" />
            <input
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setBad(false);
              }}
              placeholder="your_x_handle"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="X handle to look up"
              className="min-w-0 flex-1 bg-transparent py-2 font-mono text-base text-content placeholder:text-content-subtle focus:outline-none"
            />
            <button type="submit" className="btn-primary shrink-0 px-5 py-2.5">
              Look up <ArrowRight className="ml-1 h-4 w-4" />
            </button>
          </div>
          <p className={cn("mt-2 text-xs", bad ? "text-red-300" : "text-content-subtle")}>
            {bad ? "That isn't an X handle. Letters, numbers and _ only, up to 15." : "Paste a handle or a profile link. First look-ups take a few seconds."}
          </p>
        </motion.form>

        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-t border-hairline pt-5"
        >
          {(
            [
              ["Creators ranked", board ? board.totals.accounts : 0, full],
              ["Views on their posts", board ? board.totals.views : 0, compact],
              ["Perp DEX videos", ytVideos, full],
            ] as const
          ).map(([label, value, fmt]) => (
            <div key={label} className="min-w-0">
              <dt className="truncate text-[11px] text-content-subtle">{label}</dt>
              <dd className="mt-1 font-display text-xl font-bold tabular-nums text-content sm:text-2xl">
                <CountUp value={value} format={fmt} />
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>

      {/* Live board: the real thing, not an illustration */}
      <motion.aside
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.7, ease }}
        className="surface min-w-0 rounded-3xl p-5 sm:p-6"
        aria-label="This week on the Variational board"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-content">This week on X</p>
            <p className="mt-0.5 text-[11px] text-content-subtle">
              {board?.sync.lastIndexAt ? `Indexed ${formatDateTime(board.sync.lastIndexAt)} UTC` : "Waiting for the first index"}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-mint-400/30 px-2.5 py-1 text-[11px] font-semibold text-mint-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-400" /> Live
          </span>
        </div>

        <ol className="mt-4 space-y-1">
          {week.length === 0
            ? Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-1 py-2">
                  <span className="h-7 w-7 rounded-full bg-ink-700/70" />
                  <span className="h-3 flex-1 rounded bg-ink-700/70" />
                  <span className="h-3 w-10 rounded bg-ink-700/70" />
                </li>
              ))
            : week.map((r, i) => (
                <motion.li key={r.handle} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.05 }}>
                  <button type="button" onClick={() => onOpen(r.handle)} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors hover:bg-ink-800/60">
                    <span className="w-4 shrink-0 text-center font-mono text-xs text-content-subtle">{i + 1}</span>
                    <Avatar src={r.avatar} alt={r.handle} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm text-content">@{r.handle}</span>
                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-mint-300">+{compact(r.points)}</span>
                  </button>
                </motion.li>
              ))}
        </ol>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-4 text-xs">
          <div className="min-w-0">
            <p className="text-content-subtle">Posts this week</p>
            <p className="mt-1 font-display text-lg font-bold tabular-nums text-content">{full(weekPosts)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-content-subtle">Top on YouTube</p>
            <p className="mt-1 truncate font-semibold text-content" title={topChannel?.channelTitle}>
              {topChannel ? topChannel.channelTitle : "-"}
            </p>
            {topChannel && <p className="text-[11px] tabular-nums text-content-subtle">{compact(topChannel.points)} pts</p>}
          </div>
        </div>
      </motion.aside>
    </section>
  );
}
