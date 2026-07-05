"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SendHorizonal, X, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Markdown } from "@/lib/markdown";
import { RobotIcon } from "./RobotIcon";

// Fired by the navbar "XYZ AI" item (and anywhere else) to open the assistant.
export const XYZ_AI_OPEN_EVENT = "xyz-ai:open";

type ChatMsg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi — I'm **XYZ AI**, your research assistant. Ask me anything about crypto, Web3, or XYZ Crypto's research and I'll answer with links to our articles.";

const SUGGESTIONS = [
  "Summarise the latest research",
  "What is a perp DEX?",
  "Explain airdrop farming",
];

export function XyzAiWidget() {
  const { data: session, status } = useSession();
  const user = session?.user as any;
  // Open to every signed-in member (free provider — no Premium gate).
  const canUse = Boolean(user);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

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
      className="glass fixed bottom-24 right-4 z-[60] flex h-[min(70vh,560px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-2xl ring-1 ring-gold-500/25 sm:right-6"
      role="dialog"
      aria-label="XYZ AI assistant"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-950/60 ring-1 ring-mint-400/40">
            <RobotIcon className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-100">XYZ AI</p>
            <p className="mono text-[10px] text-mint-200/80">Research assistant</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
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
                <Bubble role="assistant">
                  <Markdown content={GREETING} />
                </Bubble>
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-gold-500/25 bg-gold-500/5 px-3 py-1 text-xs text-gold-100 transition-colors hover:bg-gold-500/15"
                    >
                      {s}
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

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20">{error}</p>
            )}
          </div>

          {/* Composer */}
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
        className="ai-fab fixed bottom-5 right-4 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-mint-600 text-ink shadow-lg shadow-mint-500/30 ring-1 ring-mint-300/50 sm:right-6"
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
