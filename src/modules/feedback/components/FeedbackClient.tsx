"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, LogIn, Mic, Music, Send, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { enterAudioScope, lineFor, play, say, sayOneOf, sfx, stopVoice, tryAutoUnlock, unlock, updateSettings, type Piece } from "@modules/academy/client/audio";
import { useAudio } from "@modules/academy/client/hooks";
import { greetName } from "@modules/academy/client/name-bank";
import { hey } from "@modules/academy/client/greet";
import { VOICE_LINES } from "@modules/academy/client/voice-lines";
import { recordUtterance, releaseMic, talkSupported, transcribe, TalkError } from "@modules/academy/client/talk";
import { GuideCaption, GuideOrb, GuideWave } from "@modules/academy/components/Guide";
import { Avatar, burstConfetti, CountUp, Panel, utcDate } from "@modules/academy/components/ui";
import { BADGES, CATEGORIES, MAX_MESSAGE, MIN_MESSAGE, quality, XP_DAILY, XP_FIRST, XP_SHIPPED, type BadgeCode, type Category } from "../lib/shared";
import { compressImage } from "@shared/utils/compress-image";

type Mine = {
  count: number;
  xp: number;
  rewardAvailable: boolean;
  badges: BadgeCode[];
  items: { id: string; category: string; rating: number; message: string; status: string; xp: number; createdAt: string }[];
};

const RATINGS = [
  { v: 1, emoji: "😞", label: "Bad" },
  { v: 2, emoji: "😕", label: "Meh" },
  { v: 3, emoji: "🙂", label: "Okay" },
  { v: 4, emoji: "😄", label: "Good" },
  { v: 5, emoji: "🤩", label: "Love it" },
];

const STEP_TITLES = ["What's it about?", "How does it feel?", "Tell us more"];
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  new: { label: "Sent", cls: "bg-white/[0.06] text-content-muted" },
  seen: { label: "Seen by team", cls: "bg-gold-400/15 text-gold-200" },
  done: { label: "Shipped", cls: "bg-mint-400/15 text-mint-300" },
};

const line = (k: keyof typeof VOICE_LINES): Piece => lineFor(k);

export function FeedbackClient() {
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated";
  const name = greetName((session?.user as { name?: string | null } | undefined)?.name);
  const { settings, voice, unlocked } = useAudio();

  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<Category | null>(null);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [contact, setContact] = useState("");
  const [hp, setHp] = useState("");
  // Optional screenshot, compressed in the browser (max 1600px JPEG) so it
  // uploads fast on a phone connection.
  const [shot, setShot] = useState<string | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const pickShot = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/^image\/(png|jpeg|webp|gif|heic|heif)$/.test(file.type) && !file.type.startsWith("image/")) {
      setError("That file isn't an image.");
      return;
    }
    setShotBusy(true);
    try {
      setShot(await compressImage(file));
      sfx("pop");
    } catch {
      setError("Couldn't read that image. Try a PNG or JPG.");
    } finally {
      setShotBusy(false);
    }
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ xp: number; first: boolean } | null>(null);
  const [mine, setMine] = useState<Mine | null>(null);
  const [page, setPage] = useState("");
  const [voices, setVoices] = useState<{ rank: number; name: string; username: string | null; image: string | null; count: number; shipped: number }[] | null>(null);
  useEffect(() => {
    fetch("/api/feedback/board")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setVoices(b?.voices ?? []))
      .catch(() => setVoices([]));
  }, []);

  const loadMine = useCallback(async () => {
    try {
      const r = await fetch("/api/feedback/mine");
      if (r.ok) setMine(await r.json());
    } catch {
      /* history is optional */
    }
  }, []);
  useEffect(() => {
    if (signedIn) void loadMine();
  }, [signedIn, loadMine]);

  // Which page they came from (sent with the feedback), read after mount.
  useEffect(() => {
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      const from = new URLSearchParams(window.location.search).get("from");
      setPage(from || (ref && ref.origin === window.location.origin && ref.pathname !== "/feedback" ? ref.pathname : ""));
    } catch {
      /* none */
    }
  }, []);

  // AneQue's voice is welcome here, the Academy's music is not: this page
  // claims sound as a "page" (voice + effects, never music), and leaving it
  // stops her mid-sentence instead of letting her follow the visitor around.
  useEffect(() => enterAudioScope("page"), []);

  // AneQue welcomes them by name: straight away if the browser allows sound,
  // otherwise on the first tap.
  const greeted = useRef(false);
  useEffect(() => {
    if (status === "loading" || greeted.current) return;
    greeted.current = true;
    const pieces = [hey(name), line(Math.random() < 0.5 ? "feedback_welcome" : "feedback_welcome_2")];
    let alive = true;
    const on = () => {
      off();
      if (!alive) return;
      unlock();
      play(pieces);
    };
    // The tap-to-hear listeners must go when the page does: they used to
    // outlive it, so the first tap anywhere else on the site played the
    // Feedback greeting.
    const off = () => {
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("keydown", on);
    };
    void tryAutoUnlock().then((ok) => {
      if (!alive) return;
      if (ok) play(pieces);
      else {
        window.addEventListener("pointerdown", on, { once: true });
        window.addEventListener("keydown", on, { once: true });
      }
    });
    return () => {
      alive = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // On a phone the next step (or the thank-you) can open below the fold:
  // bring the card's top back into view when it changes.
  const cardRef = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 72 || top > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + top - 96, behavior: "smooth" });
  }, [step, done]);

  const q = useMemo(() => quality(message), [message]);
  const praisedQuality = useRef(false);
  useEffect(() => {
    if (q >= 80 && !praisedQuality.current) {
      praisedQuality.current = true;
      sfx("achievement");
      say("feedback_quality", { auto: true });
    }
  }, [q]);

  const chooseCategory = (c: Category) => {
    unlock();
    setCategory(c);
    sfx("select");
    say(`feedback_${c}` as keyof typeof VOICE_LINES, { auto: true });
    setTimeout(() => setStep(1), 260);
  };
  const chooseRating = (v: number) => {
    unlock();
    setRating(v);
    sfx(v >= 4 ? "coin" : "click");
    say(v <= 2 ? "feedback_rate_low" : v === 3 ? "feedback_rate_mid" : "feedback_rate_high", { auto: true });
    setTimeout(() => setStep(2), 320);
  };

  // Voice dictation through AneQue's ears (members only: it is the same
  // Whisper route Live Talk uses).
  const [dictating, setDictating] = useState<"idle" | "listening" | "transcribing">("idle");
  const [level, setLevel] = useState(0);
  const dictate = async () => {
    unlock();
    setError(null);
    if (!signedIn) return setError("Sign in to dictate with your voice. Typing works for everyone.");
    if (!talkSupported()) return setError("This browser can't record audio. Typing works everywhere.");
    if (dictating !== "idle") return; // it stops by itself when they pause
    stopVoice();
    setDictating("listening");
    sfx("pop");
    try {
      const rec = await recordUtterance({ onLevel: setLevel, silenceMs: 1600, maxMs: 30_000, waitMs: 8_000 });
      if (!rec) {
        setDictating("idle");
        return;
      }
      setDictating("transcribing");
      const { text } = await transcribe(rec.blob);
      if (text.trim()) {
        setMessage((m) => (m.trim() ? `${m.trim()} ${text.trim()}` : text.trim()).slice(0, MAX_MESSAGE));
        sfx("reveal");
      }
    } catch (e) {
      const st = (e as TalkError).status;
      setError(st === 503 ? "Voice typing isn't available right now. Typing works fine." : (e as Error).message || "Couldn't hear that. Try again.");
    } finally {
      setDictating("idle");
      setLevel(0);
      releaseMic();
    }
  };

  const submit = async () => {
    unlock();
    if (!category || !rating) return;
    if (message.trim().length < MIN_MESSAGE) {
      setError(`Tell us a little more (at least ${MIN_MESSAGE} characters).`);
      sfx("wrong");
      return;
    }
    setBusy(true);
    setError(null);
    sfx("whoosh");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, rating, message, page, name: guestName || undefined, contact: contact || undefined, website: hp || undefined, image: shot || undefined }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new Error(body?.error || "Couldn't send that. Try again.");
      setDone({ xp: body.xp ?? 0, first: Boolean(body.first) });
      burstConfetti();
      sfx(body.xp ? "levelup" : "achievement");
      const pieces: Piece[] = [line(Math.random() < 0.5 ? "feedback_sent" : "feedback_sent_2")];
      if (!signedIn) pieces.push(line("feedback_guest"));
      else if (body.first) pieces.push(line("feedback_first"));
      else if (body.xp) pieces.push(line("feedback_xp"));
      else pieces.push(line("feedback_cooldown"));
      play(pieces);
      if (signedIn) void loadMine();
    } catch (e) {
      setError((e as Error).message);
      sfx("wrong");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setShot(null);
    setStep(0);
    setCategory(null);
    setRating(0);
    setMessage("");
    setDone(null);
    praisedQuality.current = false;
    sfx("click");
    sayOneOf("feedback_welcome", 2, { auto: true });
  };

  const xpPreview = signedIn ? (mine ? (mine.rewardAvailable ? XP_DAILY : 0) + (mine.count === 0 ? XP_FIRST : 0) : XP_DAILY) : 0;
  const speaking = voice.speaking && !voice.paused;
  const cat = CATEGORIES.find((c) => c.id === category);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      {/* ---------------------------------------------------------- main card */}
      <div className="min-w-0">
        <motion.header initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6 sm:mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-gold-200">
            <Sparkles className="h-3.5 w-3.5" /> Feedback · earn XP
          </span>
          <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.08] tracking-tight text-content sm:text-5xl">
            Help shape <span className="text-shine">XYZ Crypto</span>
          </h1>
          <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-content-muted">
            Report a bug, pitch an idea, rate a page. Every note goes straight to the team, and members earn Academy XP for it.
          </p>
        </motion.header>

        <div ref={cardRef} className="scroll-mt-24">
        <Panel className="fb-card relative overflow-hidden !p-0">
          <div className="fb-glow pointer-events-none absolute inset-0" aria-hidden />
          {/* progress */}
          <div className="relative flex items-center gap-3 border-b border-hairline px-5 py-4 sm:px-7">
            <div className="flex flex-1 items-center gap-2">
              {STEP_TITLES.map((t, i) => (
                <button
                  key={t}
                  type="button"
                  disabled={done !== null || i > step || (i === 1 && !category) || (i === 2 && !rating)}
                  onClick={() => {
                    setStep(i);
                    sfx("click");
                  }}
                  className="group flex min-w-0 flex-1 flex-col gap-1.5 text-left disabled:cursor-default"
                  aria-label={`Step ${i + 1}: ${t}`}
                >
                  <span className={cn("h-1.5 rounded-full transition-colors duration-500", done || i < step ? "bg-mint-400" : i === step ? "bg-gold-400" : "bg-white/[0.08]")} />
                  <span className={cn("hidden truncate text-[0.6875rem] font-medium sm:block", i === step && !done ? "text-content" : "text-content-subtle")}>{t}</span>
                </button>
              ))}
            </div>
            {xpPreview > 0 && !done && (
              <span className="shrink-0 rounded-full bg-mint-400/15 px-2.5 py-1 font-mono text-[0.6875rem] font-bold text-mint-300">+{xpPreview} XP</span>
            )}
          </div>

          <div className="relative min-h-[23rem] px-5 py-6 sm:px-7 sm:py-7">
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-6 text-center">
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-mint-300 to-mint-500 text-ink-950 shadow-[0_0_60px_-10px_rgba(52,211,153,0.7)]"
                  >
                    <Check className="h-10 w-10" strokeWidth={2.6} />
                  </motion.span>
                  <h2 className="mt-5 font-display text-2xl font-semibold text-content sm:text-3xl">Thank you{name ? `, ${name}` : ""}!</h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-content-muted">Your feedback is with the team right now. You&apos;ll see its status change here when we read it and when it ships.</p>
                  {done.xp > 0 ? (
                    <div className="mt-6 rounded-3xl border border-mint-400/30 bg-mint-400/10 px-8 py-4">
                      <div className="font-mono text-4xl font-bold text-mint-300">
                        +<CountUp value={done.xp} duration={1200} /> XP
                      </div>
                      <div className="mt-1 text-xs text-content-muted">{done.first ? `Includes the ${XP_FIRST} XP first-feedback bonus` : "Added to your Academy total"}</div>
                    </div>
                  ) : signedIn ? (
                    <p className="mt-6 rounded-2xl bg-white/[0.04] px-4 py-3 text-xs text-content-muted">Today&apos;s feedback XP is already yours. Come back tomorrow for more.</p>
                  ) : (
                    <Link href="/login?callbackUrl=/feedback" className="btn-gold mt-6 h-11 px-5 text-sm">
                      <LogIn className="h-4 w-4" /> Sign in to earn XP next time
                    </Link>
                  )}
                  <div className="mt-7 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={reset} className="btn-secondary h-11 px-5 text-sm">
                      Send another
                    </button>
                    <Link href="/academy" className="btn-primary h-11 px-5 text-sm">
                      Spend it in the Academy <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.div>
              ) : step === 0 ? (
                <motion.div key="s0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
                  <h2 className="font-display text-xl font-semibold text-content">{STEP_TITLES[0]}</h2>
                  <p className="mt-1 text-sm text-content-muted">Pick the closest one.</p>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {CATEGORIES.map((c, i) => (
                      <motion.button
                        key={c.id}
                        type="button"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => chooseCategory(c.id)}
                        onPointerEnter={() => sfx("hover")}
                        className={cn(
                          "fb-choice group flex min-h-[7.5rem] flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200",
                          category === c.id ? "border-gold-400/70 bg-gold-400/10" : "border-hairline bg-white/[0.02] hover:-translate-y-0.5 hover:border-gold-400/40 active:-translate-y-0.5",
                        )}
                      >
                        <span className="text-3xl transition-transform duration-300 group-hover:scale-110 group-active:scale-110">{c.emoji}</span>
                        <span className="mt-auto pt-3 font-display text-[0.9375rem] font-semibold text-content">{c.label}</span>
                        <span className="mt-0.5 text-[0.75rem] leading-snug text-content-subtle">{c.hint}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : step === 1 ? (
                <motion.div key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
                  <h2 className="font-display text-xl font-semibold text-content">{STEP_TITLES[1]}</h2>
                  <p className="mt-1 text-sm text-content-muted">
                    {cat?.emoji} {cat?.label}: how is it overall?
                  </p>
                  <div className="mt-7 grid grid-cols-5 gap-2 sm:gap-3">
                    {RATINGS.map((r) => (
                      <button
                        key={r.v}
                        type="button"
                        onClick={() => chooseRating(r.v)}
                        onPointerEnter={() => sfx("hover")}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-2xl border py-4 transition-all duration-200 sm:py-5",
                          rating === r.v ? "scale-105 border-gold-400/70 bg-gold-400/10" : "border-hairline bg-white/[0.02] hover:-translate-y-1 hover:border-gold-400/40",
                        )}
                        aria-label={`${r.v} of 5: ${r.label}`}
                        aria-pressed={rating === r.v}
                      >
                        <span className={cn("text-3xl transition-transform duration-300 sm:text-4xl", rating === r.v && "fb-pop")}>{r.emoji}</span>
                        <span className="text-[0.6875rem] font-medium text-content-muted sm:text-xs">{r.label}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setStep(0)} className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-content-subtle hover:text-content">
                    <ArrowLeft className="h-3.5 w-3.5" /> Change topic
                  </button>
                </motion.div>
              ) : (
                <motion.div key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-content">{STEP_TITLES[2]}</h2>
                      <p className="mt-1 text-sm text-content-muted">
                        {cat?.emoji} {cat?.label} · {RATINGS[rating - 1]?.emoji} {RATINGS[rating - 1]?.label}
                      </p>
                    </div>
                    <button type="button" onClick={() => setStep(1)} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-content-subtle hover:text-content">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </button>
                  </div>

                  <div className={cn("mt-5 rounded-2xl border bg-ink-900/40 transition-colors", dictating === "listening" ? "border-red-400/60" : "border-hairline focus-within:border-gold-400/50")}>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                      rows={6}
                      placeholder={
                        category === "bug"
                          ? "What happened? Which page, which device, and what did you expect?"
                          : category === "idea"
                            ? "What should we build, and why would it help you?"
                            : "Tell us in your own words. Hinglish is fine too."
                      }
                      className="block w-full resize-none rounded-t-2xl bg-transparent px-4 py-3.5 text-[0.9375rem] leading-relaxed text-content outline-none placeholder:text-content-subtle"
                      aria-label="Your feedback"
                    />
                    <div className="flex items-center gap-3 border-t border-hairline px-3 py-2.5">
                      <button
                        type="button"
                        onClick={dictate}
                        className={cn(
                          "inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors",
                          dictating === "listening" ? "bg-red-500/90 text-white" : "bg-white/[0.05] text-content-muted hover:bg-white/[0.09] hover:text-content",
                        )}
                        aria-label={dictating === "listening" ? "Listening, pause to finish" : "Dictate with your voice"}
                      >
                        {dictating === "transcribing" ? <Loader2 className="h-4 w-4 animate-spin" /> : dictating === "listening" ? <Square className="h-3.5 w-3.5 animate-pulse" /> : <Mic className="h-4 w-4" />}
                        {dictating === "listening" ? "Listening…" : dictating === "transcribing" ? "Writing…" : "Speak"}
                      </button>
                      {dictating === "listening" && (
                        <span className="flex h-5 items-center gap-[0.1875rem]" aria-hidden>
                          {Array.from({ length: 10 }, (_, i) => (
                            <span key={i} className="w-[0.1875rem] rounded-full bg-red-400" style={{ height: `${Math.max(15, Math.min(100, level * 110 * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.9)))))}%` }} />
                          ))}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[0.6875rem] text-content-subtle">
                        {message.length}/{MAX_MESSAGE}
                      </span>
                    </div>
                  </div>

                  {/* screenshot */}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className={cn("inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 text-xs font-semibold transition-colors", shot ? "border-mint-400/50 text-mint-300" : "border-hairline text-content-muted hover:border-gold-400/50 hover:text-content")}>
                      {shotBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {shot ? "Change screenshot" : "Add a screenshot"}
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pickShot(e.target.files?.[0])} />
                    </label>
                    {shot && (
                      <span className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={shot} alt="Your screenshot" className="h-14 w-auto max-w-[8rem] rounded-lg border border-hairline object-cover" />
                        <button type="button" onClick={() => setShot(null)} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-ink-950 text-content-subtle ring-1 ring-hairline hover:text-content" aria-label="Remove screenshot">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <span className="text-[0.6875rem] text-content-subtle">{category === "bug" ? "A screenshot helps us fix it faster." : "Optional"}</span>
                  </div>

                  {/* quality meter */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[0.6875rem]">
                      <span className="font-semibold uppercase tracking-[0.14em] text-content-subtle">How useful</span>
                      <span className={cn("font-semibold", q >= 80 ? "text-mint-300" : q >= 45 ? "text-gold-200" : "text-content-subtle")}>
                        {q >= 80 ? "Super detailed 🔥" : q >= 45 ? "Good, add a detail or two" : q > 0 ? "Keep going" : "Start typing"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div className={cn("h-full rounded-full", q >= 80 ? "bg-gradient-to-r from-mint-500 to-mint-300" : "bg-gradient-to-r from-gold-500 to-gold-300")} animate={{ width: `${q}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                    </div>
                  </div>

                  {!signedIn && status !== "loading" && (
                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-content-subtle">Name (optional)</span>
                        <input value={guestName} onChange={(e) => setGuestName(e.target.value.slice(0, 60))} className="mt-1.5 h-11 w-full rounded-xl border border-hairline bg-ink-900/40 px-3.5 text-sm text-content outline-none focus:border-gold-400/50" />
                      </label>
                      <label className="block">
                        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-content-subtle">Email or Telegram (optional)</span>
                        <input value={contact} onChange={(e) => setContact(e.target.value.slice(0, 120))} placeholder="so we can reply" className="mt-1.5 h-11 w-full rounded-xl border border-hairline bg-ink-900/40 px-3.5 text-sm text-content outline-none placeholder:text-content-subtle focus:border-gold-400/50" />
                      </label>
                    </div>
                  )}
                  {/* honeypot */}
                  <input value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[624.9375rem] h-0 w-0 opacity-0" name="website" />

                  {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">{error}</p>}

                  <button type="button" onClick={submit} disabled={busy || message.trim().length < MIN_MESSAGE} className="btn-gold mt-5 h-12 w-full justify-center text-sm disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {busy ? "Sending…" : xpPreview ? `Send feedback · +${xpPreview} XP` : "Send feedback"}
                  </button>
                  {!signedIn && status !== "loading" && (
                    <p className="mt-3 text-center text-xs text-content-subtle">
                      <Link href="/login?callbackUrl=/feedback" className="font-semibold text-gold-200 hover:underline">
                        Sign in
                      </Link>{" "}
                      to earn {XP_DAILY}+ XP and track what happens to your feedback.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------------- sidebar */}
      <aside className="flex min-w-0 flex-col gap-5">
        <Panel className="relative overflow-hidden">
          <div className="flex items-center gap-3">
            <GuideOrb size={52} speaking={speaking} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-semibold text-content">AneQue</div>
              <div className="text-[0.6875rem] text-content-subtle">{speaking ? "Speaking" : "Here to help"}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                unlock();
                updateSettings({ music: !settings.music });
                sfx("click");
              }}
              className={cn("acad-icon-btn", settings.music && "!text-gold-200")}
              aria-label={settings.music ? "Turn music off" : "Turn music on"}
              title="Music"
            >
              <Music />
            </button>
            <button
              type="button"
              onClick={() => {
                unlock();
                updateSettings({ master: !settings.master });
              }}
              className="acad-icon-btn"
              aria-label={settings.master ? "Mute" : "Unmute"}
              title={settings.master ? "Mute" : "Unmute"}
            >
              {settings.master ? <Volume2 /> : <VolumeX />}
            </button>
          </div>
          <div className="mt-3 rounded-2xl border border-hairline bg-ink-900/50 px-3.5 py-3">
            <GuideWave speaking={speaking} bars={30} className="h-5" />
            <GuideCaption text={voice.text || VOICE_LINES.feedback_welcome} speaking={speaking} className="mt-2 min-h-[2.5rem] text-[0.8125rem] leading-relaxed" />
          </div>
          {!unlocked && (
            <button type="button" onClick={() => unlock()} className="mt-3 w-full rounded-xl bg-gold-400/15 py-2 text-xs font-semibold text-gold-100 hover:bg-gold-400/25">
              <Volume2 className="mr-1.5 inline h-3.5 w-3.5" /> Tap to hear AneQue
            </button>
          )}
        </Panel>

        <Panel>
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-base font-semibold text-content">Your badges</h3>
            {mine && <span className="font-mono text-xs text-mint-300">{mine.xp} XP earned</span>}
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2 lg:grid-cols-5">
            {BADGES.map((b) => {
              const got = mine?.badges.includes(b.code);
              return (
                <div key={b.code} className="group relative flex flex-col items-center text-center" title={`${b.title}: ${b.hint}`}>
                  <span className={cn("grid h-12 w-12 place-items-center rounded-2xl border text-2xl transition-all", got ? "fb-badge border-gold-400/50 bg-gold-400/10" : "border-hairline bg-white/[0.02] opacity-40 grayscale")}>{b.emoji}</span>
                  <span className="mt-1.5 line-clamp-2 text-[0.625rem] font-medium leading-tight text-content-muted">{b.title}</span>
                </div>
              );
            })}
          </div>
          {!signedIn && status !== "loading" && <p className="mt-4 text-xs text-content-subtle">Sign in to collect badges.</p>}
        </Panel>

        <Panel>
          <h3 className="font-display text-base font-semibold text-content">How XP works</h3>
          <ul className="mt-3 space-y-2.5 text-[0.8125rem] text-content-muted">
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 rounded-md bg-mint-400/15 px-1.5 font-mono text-[0.6875rem] font-bold text-mint-300">+{XP_DAILY}</span> Your first feedback each day
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 rounded-md bg-mint-400/15 px-1.5 font-mono text-[0.6875rem] font-bold text-mint-300">+{XP_FIRST}</span> Bonus on your very first one
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-0.5 rounded-md bg-gold-400/15 px-1.5 font-mono text-[0.6875rem] font-bold text-gold-200">+{XP_SHIPPED}</span> When we ship or fix what you sent
            </li>
          </ul>
        </Panel>

        {voices && voices.length > 0 && (
          <Panel>
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-base font-semibold text-content">Top voices</h3>
              <span className="text-[0.6875rem] text-content-subtle">last 30 days</span>
            </div>
            <ol className="mt-3 space-y-2">
              {voices.map((v) => (
                <li key={v.rank} className="flex items-center gap-2.5 text-[0.8125rem]">
                  <span className={cn("w-5 text-center font-mono text-[0.6875rem] font-bold", v.rank === 1 ? "text-gold-300" : "text-content-subtle")}>{v.rank}</span>
                  <Avatar src={v.image} alt={v.name} size={26} />
                  {v.username ? (
                    <Link href={`/u/${v.username}`} className="min-w-0 flex-1 truncate font-medium text-content hover:underline">
                      {v.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate font-medium text-content">{v.name}</span>
                  )}
                  {v.shipped > 0 && <span className="rounded-full bg-mint-400/15 px-1.5 py-0.5 font-mono text-[0.625rem] text-mint-300" title="Shipped">🚀 {v.shipped}</span>}
                  <span className="font-mono text-[0.6875rem] text-content-muted">{v.count}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {signedIn && mine && mine.items.length > 0 && (
          <Panel>
            <h3 className="font-display text-base font-semibold text-content">Your feedback</h3>
            <ul className="mt-3 space-y-2.5">
              {mine.items.slice(0, 6).map((it) => {
                const c = CATEGORIES.find((x) => x.id === it.category);
                const st = STATUS_LABEL[it.status] ?? STATUS_LABEL.new;
                return (
                  <li key={it.id} className="rounded-2xl border border-hairline bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 text-[0.6875rem]">
                      <span>{c?.emoji}</span>
                      <span className="font-semibold text-content">{c?.label}</span>
                      <span className="text-content-subtle">{utcDate(it.createdAt)}</span>
                      <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[0.625rem] font-semibold", st.cls)}>{st.label}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[0.75rem] leading-relaxed text-content-muted">{it.message}</p>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}
      </aside>
    </div>
  );
}
