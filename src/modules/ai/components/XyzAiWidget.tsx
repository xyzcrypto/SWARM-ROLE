"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SendHorizonal, X, Loader2, Trash2, BarChart3, Search, Compass, BookOpen, Coins } from "lucide-react";
import { useSession } from "next-auth/react";
import { Markdown } from "@/lib/markdown";
import { RobotIcon } from "@/components/RobotIcon";
import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/lib/useClientFlag";
import { quotaLevel, type QuotaLevel } from "@shared/utils/ai-quota";

// Fired by the navbar "XYZ AI" item (and anywhere else) to open the assistant.
export const XYZ_AI_OPEN_EVENT = "xyz-ai:open";

type ChatMsg = { role: "user" | "assistant"; content: string };
type Quota = { remaining: number; limit: number };

// Two lead actions carry a subtitle; the rest stay compact. Subtitles describe
// what the assistant will do - they must never claim data we haven't fetched.
const LEAD_SUGGESTIONS = [
  { icon: BarChart3, tone: "gold" as const, q: "What moved in the market today?", label: "Brief me on the market", sub: "Live prices and today's headlines" },
  { icon: Search, tone: "mint" as const, q: "Summarise the latest research", label: "Summarise our research", sub: "Grounded in XYZ Crypto's published posts" },
];

const QUICK_SUGGESTIONS = [
  { icon: Coins, tone: "gold" as const, q: "What is a perp DEX?", label: "What's a perp?" },
  { icon: Compass, tone: "violet" as const, q: "Explain airdrop farming", label: "Airdrop basics" },
  { icon: BookOpen, tone: "mint" as const, q: "Explain how staking rewards work", label: "How staking works" },
  { icon: BarChart3, tone: "gold" as const, q: "How should I think about position sizing?", label: "Position sizing" },
];

const TONE: Record<"gold" | "mint" | "violet", string> = {
  gold: "bg-gold-500/10 text-gold-200",
  mint: "bg-mint-500/10 text-mint-200",
  violet: "bg-violet-500/10 text-violet-200",
};

export function XyzAiWidget() {
  const { data: session, status } = useSession();
  const user = session?.user as any;
  // Open to every signed-in member (free provider - no Premium gate).
  const canUse = Boolean(user);
  // The floating launcher overlaps the composer on /community's mobile layout
  // (no room for both), and the same conflict happens the moment a DM thread
  // is open on /messages - hidden in both cases on small screens only;
  // desktop (composer sits in a much wider frame) keeps it either way.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dmThreadOpen = pathname === "/messages" && Boolean(searchParams?.get("c"));
  const hideOnMobile = (pathname?.startsWith("/community") ?? false) || dmThreadOpen;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Learned from the response headers of the request we were already making -
  // null until the member's first question, which is also when it first matters.
  const [quota, setQuota] = useState<Quota | null>(null);
  const reduce = useReducedMotionSafe();

  const firstName = String(user?.name ?? "").trim().split(/\s+/)[0] || null;
  const plan = String(user?.membership ?? "Free");
  const level: QuotaLevel = quota ? quotaLevel(quota.remaining) : "hidden";
  const blocked = level === "blocked";

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the view pinned to the newest content while streaming.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, busy, open, reduce]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Let the navbar (or any surface) open the assistant by dispatching the event.
  useEffect(() => {
    const openWidget = () => setOpen(true);
    window.addEventListener(XYZ_AI_OPEN_EVENT, openWidget);
    return () => window.removeEventListener(XYZ_AI_OPEN_EVENT, openWidget);
  }, []);

  // Both headers must be present and numeric. Reading them loosely would be a
  // trap: `Number(null)` is 0, so a single missing header would read as "no
  // budget left" and lock a member out of a working assistant.
  function readQuota(res: Response) {
    const rawRemaining = res.headers.get("X-Ai-Remaining");
    const rawLimit = res.headers.get("X-Ai-Limit");
    if (rawRemaining === null || rawLimit === null) return;
    const remaining = Number(rawRemaining);
    const limit = Number(rawLimit);
    if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return;
    setQuota({ remaining, limit });
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setInput("");
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");

    const history: ChatMsg[] = [...messages, { role: "user", content: q }];
    // Seed the in-flight assistant bubble so streamed text appends into it.
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: ac.signal,
      });

      readQuota(res);

      if (!res.ok || !res.body) {
        const msg = await res.json().catch(() => null);
        throw new Error(msg?.error ?? "XYZ AI is unavailable right now.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      // Drop the empty assistant bubble and show the error line.
      setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.content)));
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const panel = (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      className={cn(
        "fixed bottom-24 right-4 z-[60] flex h-[min(70vh,560px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-2xl shadow-black/60 ring-1 ring-gold-500/25 sm:right-6",
        hideOnMobile && "max-md:hidden"
      )}
      role="dialog"
      aria-label="XYZ AI assistant"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/10 bg-white/5 px-3.5 py-3">
        <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-shine text-ink ring-1 ring-gold-500/40">
          <RobotIcon className="h-5 w-5" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-mint-400 ring-2 ring-ink-950" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-zinc-100">XYZ AI</p>
          <p className="mono truncate text-[10px] text-mint-200/80">Online · research &amp; live markets</p>
        </div>

        {(level === "quiet" || level === "warn") && quota && (
          <span
            title={`${quota.remaining} of ${quota.limit} questions left today. Resets at midnight UTC.`}
            className={cn(
              "mono shrink-0 rounded-full px-2 py-0.5 text-[10px] tabular-nums ring-1",
              level === "warn"
                ? "bg-gold-500/15 text-gold-100 ring-gold-500/40"
                : "bg-white/5 text-zinc-400 ring-white/10"
            )}
          >
            {quota.remaining} left
          </span>
        )}

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            aria-label="Clear chat"
            title="Clear chat"
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {status === "loading" ? (
        <div className="flex flex-1 items-center justify-center text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : !canUse ? (
        <GateCard
          title="Log in to use XYZ AI"
          body="XYZ AI is available to signed-in members. Log in to start asking."
          href="/login?callbackUrl=/"
          cta="Log in"
        />
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {/* Greeting + suggestions (only before the first message) */}
            {messages.length === 0 && (
              <>
                <div className="rounded-2xl border border-mint-500/15 bg-gradient-to-b from-mint-500/[0.08] to-transparent px-4 py-3.5 text-center">
                  <p className="text-[15px] font-semibold text-zinc-100">
                    {firstName ? `Hey ${firstName}` : "Hey there"} 👋
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    I read every research post and live market data. Ask me anything.
                  </p>
                  <span className="mono mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] ring-1 ring-white/10">
                    <span className="text-zinc-500">PLAN</span>
                    <span className="font-semibold text-violet-200">{plan}</span>
                  </span>
                </div>

                <p className="mono px-1 pt-1 text-[9.5px] uppercase tracking-[0.15em] text-zinc-600">Start here</p>

                <div className="space-y-2">
                  {LEAD_SUGGESTIONS.map((s) => (
                    <button
                      key={s.q}
                      onClick={() => send(s.q)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:border-mint-400/30 hover:bg-white/[0.07]"
                    >
                      <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE[s.tone])}>
                        <s.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-zinc-100">{s.label}</span>
                        <span className="block truncate text-[11px] text-zinc-500">{s.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {QUICK_SUGGESTIONS.map((s) => (
                    <button
                      key={s.q}
                      onClick={() => send(s.q)}
                      className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.03] px-2.5 py-2 text-left transition-colors hover:border-mint-400/30 hover:bg-white/[0.07]"
                    >
                      <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md", TONE[s.tone])}>
                        <s.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate text-[12px] text-zinc-200">{s.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role}>
                {m.role === "assistant" ? (
                  m.content ? (
                    <Markdown content={m.content} />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-gold-200" />
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </Bubble>
            ))}

            {/* When the cap is hit, LimitCard below carries the message - a red
                error line as well would say the same thing twice. */}
            {error && !blocked && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20">{error}</p>
            )}
          </div>

          {/* Out of budget: the composer is replaced rather than left to fail. */}
          {blocked ? (
            <LimitCard plan={plan} limit={quota?.limit ?? 0} />
          ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-white/10 bg-white/5 px-3 py-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask XYZ AI…"
              disabled={busy}
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-gold-500/40 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-shine text-ink ring-1 ring-gold-500/40 transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </button>
          </form>
          )}
          <p className="px-4 pb-2 text-center text-[10px] text-zinc-600">
            XYZ AI can be wrong. Not financial advice.
          </p>
        </>
      )}
    </motion.div>
  );

  return (
    <>
      <AnimatePresence>{open && panel}</AnimatePresence>

      {/* Launcher */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close XYZ AI" : "Open XYZ AI"}
        initial={reduce ? undefined : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={reduce ? undefined : { scale: 1.05 }}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        className={cn(
          "ai-fab fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-mint-600 text-ink shadow-lg shadow-mint-500/30 ring-1 ring-mint-300/50 sm:right-6 md:bottom-5",
          hideOnMobile && "max-md:hidden"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="h-6 w-6" />
            </motion.span>
          ) : (
            <motion.span key="s" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <RobotIcon className="ai-fab-bot h-8 w-8" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-gold-500/15 px-3.5 py-2 text-sm text-zinc-100 ring-1 ring-gold-500/20"
            : "prose-xyz max-w-[90%] rounded-2xl rounded-bl-sm bg-white/5 px-3.5 py-2 text-sm text-zinc-200 ring-1 ring-white/10"
        }
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Shown in place of the composer once today's budget is spent. This is the
 * moment that actually decides whether someone upgrades, so it gets a real
 * design rather than the generic red error line - and it always states when the
 * budget comes back, so the offer never reads as the only way out.
 */
function LimitCard({ plan, limit }: { plan: string; limit: number }) {
  const isFree = plan === "Free";
  return (
    <div className="border-t border-gold-500/20 bg-gold-500/[0.06] px-4 py-3.5 text-center">
      <p className="text-[13px] font-semibold text-gold-100">
        That&rsquo;s today&rsquo;s {limit > 0 ? `${limit} ` : ""}questions
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
        Your budget resets at midnight UTC.
        {isFree ? " Premium members get a much higher daily allowance." : ""}
      </p>
      {isFree && (
        <Link href="/premium" className="btn-gold mt-2.5 inline-block px-4 py-1.5 text-xs">
          Upgrade to Premium
        </Link>
      )}
    </div>
  );
}

function GateCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink-950/60 ring-1 ring-mint-400/30">
        <RobotIcon className="h-7 w-7" />
      </span>
      <p className="text-sm font-semibold text-zinc-100">{title}</p>
      <p className="text-xs leading-relaxed text-zinc-400">{body}</p>
      <Link href={href} className="btn-gold mt-1 px-4 py-2 text-sm">
        {cta}
      </Link>
    </div>
  );
}
