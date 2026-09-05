"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  SendHorizonal, X, Loader2, Trash2, BarChart3, Search, Compass, BookOpen, Coins,
  Copy, Check, RotateCcw, Volume2, Square, Mic, Sparkles, CornerDownRight,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Markdown } from "@/lib/markdown";
import { RobotIcon } from "@/components/RobotIcon";
import { cn } from "@/lib/utils";
import { useReducedMotionSafe } from "@/lib/useClientFlag";
import { quotaLevel, type QuotaLevel } from "@shared/utils/ai-quota";
import { stripMarkdown } from "@shared/utils/strip-markdown";
import { pickVoice, chunkForSpeech } from "@/lib/tts";
import { aiPlanFor } from "@shared/utils/ai-plan";
import { pageSuggestions } from "@shared/utils/ai-page-context";
import { useSpeechInput } from "@/shared/hooks/useSpeechInput";
import { useDraggablePanel } from "@/shared/hooks/useDraggablePanel";
import { useResizablePanel, type Edge } from "@/shared/hooks/useResizablePanel";
import { hapticTap } from "@shared/utils/haptics";

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

// Thin hit areas on each edge, larger square ones in the corners. Kept to a
// few px so they never steal a click meant for the content underneath.
const RESIZE_HANDLE: Record<Edge, string> = {
  n: "left-3 right-3 top-0 h-1.5 cursor-ns-resize",
  s: "left-3 right-3 bottom-0 h-1.5 cursor-ns-resize",
  e: "top-3 bottom-3 right-0 w-1.5 cursor-ew-resize",
  w: "top-3 bottom-3 left-0 w-1.5 cursor-ew-resize",
  nw: "left-0 top-0 h-3 w-3 cursor-nwse-resize",
  ne: "right-0 top-0 h-3 w-3 cursor-nesw-resize",
  sw: "left-0 bottom-0 h-3 w-3 cursor-nesw-resize",
  se: "right-0 bottom-0 h-3 w-3 cursor-nwse-resize",
};

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
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const reduce = useReducedMotionSafe();

  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Dictation lands in the composer AND sends itself once you stop speaking.
  //
  // It used to only land in the composer, on the reasoning that a misheard word
  // should be fixable before it costs a request. That is a real cost, but it
  // was being paid on every single dictation to insure against a minority of
  // them - and the whole point of talking to an assistant is not touching the
  // keyboard. Auto-send is now the behaviour, with two things that keep the old
  // protection where it actually matters:
  //
  //   - Nothing is sent unless there is something to send (`inputRef` below).
  //   - Tapping the mic again mid-sentence still just stops and leaves the text
  //     in the composer to edit, because `toggle()` on a running session calls
  //     `stop()`, which finalises - and `onEnd` then sends what was finalised.
  //     Discarding instead of sending is `cancel()`, which suppresses `onEnd`.
  //
  // continuous: Chrome otherwise ends the session at the first short pause,
  // which cuts people off mid-sentence and reads as "it didn't hear me".
  //
  // `inputRef` mirrors `input` because `onEnd` fires from a recognizer callback
  // that closed over an older render - reading `input` there would send the
  // value from before the last transcript landed, i.e. almost always the wrong
  // thing (and an empty string on a single-utterance dictation).
  const inputRef = useRef("");
  const speech = useSpeechInput(
    (text) =>
      setInput((v) => {
        const next = v ? `${v} ${text}` : text;
        inputRef.current = next;
        return next;
      }),
    {
      continuous: true,
      onEnd: () => {
        const q = inputRef.current.trim();
        if (q) void send(q);
      },
    }
  );

  // Suggestions about the page the member is actually on, shown above the
  // general set. Derived from the path only - no extra fetch.
  const contextual = pageSuggestions(pathname);

  // Drag the panel anywhere; the position persists. Disabled on small screens,
  // where it is near full-width and there is nowhere useful to move it to.
  // Both the launcher and the panel move, on every screen size. The earlier
  // desktop-only gate meant it simply did nothing on a phone, which is where
  // a floating button most gets in the way.
  const drag = useDraggablePanel(true, "xyz-ai:panel-offset");
  const fabDrag = useDraggablePanel(true, "xyz-ai:fab-offset");
  // Resize from any edge or corner. Pulling the right/bottom edge also nudges
  // the drag offset, so the opposite edge stays visually still instead of the
  // whole panel sliding.
  const resize = useResizablePanel("xyz-ai:panel-size", drag.nudge);

  const firstName = String(user?.name ?? "").trim().split(/\s+/)[0] || null;
  // Not `user.membership` - that says "Premium" for an admin whose actual AI
  // allowance is the far larger Admin one, so the chip was lying to them.
  const plan = aiPlanFor(user ?? null);
  const level: QuotaLevel = quota ? quotaLevel(quota.remaining) : "hidden";
  const blocked = level === "blocked";

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Re-entrancy guard for `send`. Deliberately a ref and not the `busy` state -
  // see the note at the top of `send` for why state cannot do this job.
  const sendingRef = useRef(false);

  // Mirror of `input` for the dictation auto-send path. The updater inside
  // `useSpeechInput` writes it too, and it has to: `onEnd` can fire in the same
  // task as the last `onresult`, before React has committed - so an effect
  // alone would hand `onEnd` the previous value. This effect covers everything
  // else that changes the composer (typing, clearing, a suggestion chip), so
  // the two together mean the ref is never behind whichever path got there.
  useEffect(() => {
    inputRef.current = input;
  }, [input]);
  // Remaining speech chunks for the answer being read aloud.
  const speechQueue = useRef<string[]>([]);

  // Keep the view pinned to the newest content while streaming.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, busy, open, reduce]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Chrome populates the voice list asynchronously, so listen rather than read once.
  useEffect(() => {
    if (!ttsSupported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [ttsSupported]);

  // Never leave speech running behind a closed panel or an unmounted widget.
  useEffect(() => {
    if (!open) stopSpeaking();
  }, [open]);
  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    []
  );

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
    // The aborted request's `finally` releases this too, but not until its
    // microtask runs - and "clear" should leave the composer usable now, not a
    // tick later.
    sendingRef.current = false;
    stopSpeaking();
    setMessages([]);
    setError(null);
    setInput("");
  }

  function stopSpeaking() {
    speechQueue.current = [];
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingIdx(null);
  }

  async function copyAnswer(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(stripMarkdown(text));
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1600);
    } catch {
      // Clipboard can be blocked (permissions, insecure context). Nothing to
      // recover - staying silent beats an error toast for a convenience action.
    }
  }

  // Mirrors the hard-won handling in BriefingBlock: toggle off if this answer is
  // already speaking, only flush the queue when something is genuinely stuck,
  // and keep speak() inside the same user gesture (iOS requires that).
  function speakAnswer(i: number, text: string) {
    if (!ttsSupported) return;
    const synth = window.speechSynthesis;
    if (speakingIdx === i) {
      speechQueue.current = [];
      synth.cancel();
      setSpeakingIdx(null);
      return;
    }
    if (synth.speaking || synth.pending || synth.paused) synth.cancel();

    // One utterance per chunk: Chrome stops speaking after ~15s and some
    // Android engines reject a long string, both silently. An AI answer is
    // easily long enough to hit that.
    const chunks = chunkForSpeech(stripMarkdown(text));
    if (!chunks.length) return;
    speechQueue.current = chunks.slice(1);

    const v = pickVoice(voices.length ? voices : synth.getVoices(), ["en-US", "en-GB", "en-IN", "en"]);
    const utter = (t: string) => {
      const u = new SpeechSynthesisUtterance(t);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.onend = () => {
        const next = speechQueue.current.shift();
        if (next) utter(next);
        else setSpeakingIdx((s) => (s === i ? null : s));
      };
      u.onerror = () => {
        speechQueue.current = [];
        setSpeakingIdx((s) => (s === i ? null : s));
      };
      synth.speak(u);
    };
    utter(chunks[0]);
    synth.resume();
    setSpeakingIdx(i);
  }

  /** Re-ask the last question, dropping the answer we didn't like. */
  function regenerate() {
    if (busy) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        stopSpeaking();
        // Pass the truncated history explicitly - setMessages is async, so
        // send() would otherwise rebuild from the stale pre-truncation array.
        send(messages[i].content, messages.slice(0, i));
        return;
      }
    }
  }

  async function send(text: string, base?: ChatMsg[]) {
    const q = text.trim();
    // ⚠️ The guard is a REF, not `busy`.
    //
    // `busy` is React state, so it stays `false` until React commits the
    // `setBusy(true)` below. Two sends fired in the same tick - Enter twice, or
    // Enter plus a click, or dictation ending while a finger is on the button -
    // both read `busy === false` and both proceed. Then both streaming loops
    // run `next[next.length - 1] = { role: "assistant", content: acc }` against
    // the SAME bubble with two different accumulators, alternately overwriting
    // each other. That is the "double word" - not a parser or a decoder fault;
    // the provider deltas and the incremental decode are both correct.
    //
    // A ref flips synchronously, so the second call cannot get past this line.
    if (!q || sendingRef.current) return;
    sendingRef.current = true;
    // Belt and braces: if a previous request somehow survived (an early return
    // that skipped the `finally`, a re-mount), stop it before starting another.
    // The old code reassigned `abortRef.current` without aborting the old one,
    // which orphaned it from both `finally` and `clearChat`.
    abortRef.current?.abort();
    hapticTap(); // asking the assistant is a committed action, not a navigation
    setError(null);
    setInput("");

    const history: ChatMsg[] = [...(base ?? messages), { role: "user", content: q }];
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
      sendingRef.current = false;
      setBusy(false);
      abortRef.current = null;
    }
  }

  const panel = (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      // The drag offset rides framer-motion's own x/y rather than an inline
      // `transform`. framer-motion rewrites transform every frame for the
      // entrance spring, so an inline transform was simply overwritten and the
      // panel never moved - the same class of bug as the launcher's :active
      // scale. Handing it the offset means there is only ever one writer.
      animate={{ opacity: 1, scale: 1, x: -drag.offset.x, y: -drag.offset.y }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
      // No spring while the pointer is down, or the panel lags behind the cursor.
      transition={drag.dragging ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 24 }}
      className={cn(
        "ai-surface fixed bottom-24 right-4 z-[60] flex h-[min(70vh,560px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-[20px] sm:right-6",
        hideOnMobile && "max-md:hidden"
      )}
      ref={(el) => {
        drag.ref.current = el;
        resize.ref.current = el;
      }}
      style={{
        ...drag.handleProps.style,
        ...(resize.size ? { width: resize.size.w, height: resize.size.h } : {}),
      }}
      role="dialog"
      aria-label="XYZ AI assistant"
    >
      {/* Resize handles: four edges + four corners. `data-resize` (set by
          handleProps) also keeps the header's drag handler off them. */}
      {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as Edge[]).map((edge) => (
        <span
          key={edge}
          {...resize.handleProps(edge)}
          aria-hidden="true"
          className={cn("absolute z-20", edge === "sw" && "resize-grip", RESIZE_HANDLE[edge])}
        />
      ))}

      {/* Header */}
      <div
        {...drag.handleProps}
        className={cn(
          "flex items-center gap-2.5 border-b border-white/10 bg-white/5 px-3.5 py-3",
          drag.dragging ? "cursor-grabbing select-none" : "cursor-grab"
        )}
      >
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

        {(drag.moved || resize.resized) && (
          <button
            onClick={() => {
              drag.reset();
              resize.reset();
            }}
            aria-label="Reset size and position"
            title="Snap back to the default size and corner"
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          >
            <CornerDownRight className="h-4 w-4" />
          </button>
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

                {contextual.length > 0 && (
                  <>
                    <p className="mono px-1 pt-1 text-[9.5px] uppercase tracking-[0.15em] text-mint-300/70">
                      About this page
                    </p>
                    <div className="space-y-2">
                      {contextual.map((s) => (
                        <button
                          key={s.q}
                          onClick={() => send(s.q)}
                          className="flex w-full items-center gap-3 rounded-xl border border-mint-500/20 bg-mint-500/[0.06] px-3 py-2.5 text-left transition-colors hover:border-mint-400/40 hover:bg-mint-500/10"
                        >
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-mint-500/15">
                            <Sparkles className="h-4 w-4 text-mint-200" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-100">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

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

            {messages.map((m, i) => {
              // While the last answer is still streaming, its sources and tools
              // are not final - hold them back rather than flickering.
              const streaming = busy && i === messages.length - 1 && m.role === "assistant";
              const done = m.role === "assistant" && Boolean(m.content) && !streaming;
              return (
                <div key={i} className="space-y-1.5">
                  <Bubble role={m.role}>
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

                  {/* The source-chip row that used to sit here has been removed:
                      it repeated titles that were ALREADY in the answer.

                      `extractSources` read every `[Title](/research/slug)`
                      citation out of the markdown - and `Markdown` renders each
                      of those inline as an `<a>` a few lines above, to the same
                      destination. So a cited article's title was on screen
                      twice, with the second copy carrying no information the
                      first did not. Measured: an answer citing one article
                      rendered its title 2 times.

                      That is the "double word" in the assistant. Labelling the
                      row "Sources" was tried first and rejected - it explains
                      the repetition instead of removing it, and the reader is
                      still reading the same title twice.

                      If numbered citations are wanted later (a `[1]` marker
                      inline plus a numbered list at the end, Perplexity-style),
                      that is a real improvement and a clean follow-up - but it
                      means rewriting the model's links, not re-adding a second
                      copy of them. */}
                  {done && (
                    <div className="flex flex-wrap gap-1 pl-1">
                      <ToolBtn
                        onClick={() => copyAnswer(i, m.content)}
                        icon={copiedIdx === i ? Check : Copy}
                        label={copiedIdx === i ? "Copied" : "Copy"}
                      />
                      {i === messages.length - 1 && (
                        <ToolBtn onClick={regenerate} icon={RotateCcw} label="Regenerate" />
                      )}
                      {ttsSupported && (
                        <ToolBtn
                          onClick={() => speakAnswer(i, m.content)}
                          icon={speakingIdx === i ? Square : Volume2}
                          label={speakingIdx === i ? "Stop" : "Read aloud"}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

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
          <>
          {(speech.listening || speech.error) && (
            <div className="border-t border-white/10 bg-white/5 px-4 pt-2 text-[11px]">
              {speech.error ? (
                <p className="text-amber-300/90">{speech.error}</p>
              ) : (
                <p className="flex items-center gap-1.5 text-mint-200">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-mint-400" />
                  {speech.interim || "Listening…"}
                </p>
              )}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className={cn(
              "flex items-end gap-2 bg-white/5 px-3 py-3",
              speech.listening || speech.error ? "" : "border-t border-white/10"
            )}
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
            {speech.supported && (
              <button
                type="button"
                onClick={speech.toggle}
                aria-label={speech.listening ? "Stop dictation" : "Dictate a question"}
                title={speech.listening ? "Stop dictation" : "Dictate a question"}
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-colors",
                  speech.listening
                    ? "mic-live bg-mint-500/25 text-mint-100 ring-mint-400/60"
                    : "text-zinc-400 ring-white/10 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                {speech.listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-shine text-ink ring-1 ring-gold-500/40 transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </button>
          </form>
          </>
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
        ref={fabDrag.ref as any}
        {...fabDrag.handleProps}
        style={fabDrag.handleProps.style}
        // A drag must not also open the panel, so a gesture that passed the
        // movement threshold swallows its own click.
        onClick={() => {
          if (fabDrag.wasDragged()) return;
          setOpen((v) => !v);
        }}
        aria-label={open ? "Close XYZ AI" : "Open XYZ AI"}
        initial={reduce ? undefined : { opacity: 0 }}
        animate={{ opacity: 1, x: -fabDrag.offset.x, y: -fabDrag.offset.y }}
        transition={fabDrag.dragging ? { duration: 0 } : undefined}
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

function ToolBtn({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
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
