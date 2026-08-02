"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Volume2, Square, Languages, Gauge, Sparkles } from "lucide-react";
import { MarkdownLite, stripMarkdown } from "@/components/MarkdownLite";
import { RobotIcon } from "@/components/RobotIcon";
import { pickVoice, nextRate } from "@/lib/tts";
import { cn } from "@/lib/utils";

// Shared AI-briefing block: renders the markdown briefing plus a "Listen" (free
// browser text-to-speech) control and an EN / Hinglish toggle (AI-translated on
// demand). Used by both the News reader and the shared-story page.
export function BriefingBlock({
  englishText, loading, err, title, summary, loggedIn, onGenerate, className,
}: {
  englishText: string | null;
  loading: boolean;
  err: string | null;
  title: string;
  summary: string;
  loggedIn: boolean;
  /** Briefing is on-demand now (was auto-fired on open) - call to fetch it. Omit to keep the old auto-fetch-by-parent behavior. */
  onGenerate?: () => void;
  className?: string;
}) {
  const [lang, setLang] = useState<"en" | "hinglish">("en");
  const [hinglish, setHinglish] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [rate, setRate] = useState(1);

  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Load the browser's voice list (Chrome populates it asynchronously, so listen
  // for `voiceschanged` rather than reading once).
  useEffect(() => {
    if (!ttsSupported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [ttsSupported]);

  // Reset translation state when the story changes. Adjusted during render, so
  // the previous story's translation can't paint under the new story's text.
  const [prevEnglishText, setPrevEnglishText] = useState(englishText);
  if (prevEnglishText !== englishText) {
    setPrevEnglishText(englishText);
    setLang("en");
    setHinglish({ loading: false, text: null, err: null });
    setSpeaking(false);
  }

  // Cancelling in-flight speech is a real side effect on a browser API, so it
  // stays in an effect.
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [englishText]);

  // Always stop speech on unmount.
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  const shown = lang === "hinglish" ? hinglish.text : englishText;

  const speak = useCallback(() => {
    if (!ttsSupported || !shown) return;
    const synth = window.speechSynthesis;
    // Toggle off if we're already talking.
    if (speaking || synth.speaking) { synth.cancel(); setSpeaking(false); return; }
    // Avoid the classic mobile bug where cancel() immediately followed by speak()
    // drops the utterance (cancel flushes asynchronously) - only clear the queue
    // when something is actually stuck pending/paused, and keep speak() inside the
    // same user gesture (iOS requires that).
    if (synth.pending || synth.paused) synth.cancel();
    const u = new SpeechSynthesisUtterance(stripMarkdown(shown));
    const langs = lang === "hinglish" ? ["hi-IN", "en-IN", "en"] : ["en-US", "en-GB", "en-IN", "en"];
    const v = pickVoice(voices.length ? voices : synth.getVoices(), langs);
    if (v) { u.voice = v; u.lang = v.lang; }
    else u.lang = lang === "hinglish" ? "hi-IN" : "en-US";
    u.rate = rate;
    u.pitch = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
    // iOS/Safari sometimes starts the synthesis queue paused - nudge it. No-op elsewhere.
    synth.resume();
    setSpeaking(true);
  }, [ttsSupported, shown, speaking, lang, voices, rate]);

  const speakRef = useRef(speak);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  // Fetch the Hinglish translation the first time it's requested.
  const switchLang = useCallback(async (next: "en" | "hinglish") => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    setLang(next);
    if (next === "hinglish" && !hinglish.text && !hinglish.loading && englishText) {
      setHinglish({ loading: true, text: null, err: null });
      try {
        const res = await fetch("/api/ai/why-matters", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, summary, mode: "hinglish", text: englishText }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) setHinglish({ loading: false, text: null, err: j.error || "Couldn't translate." });
        else setHinglish({ loading: false, text: j.text, err: null });
      } catch {
        setHinglish({ loading: false, text: null, err: "Network error." });
      }
    }
  }, [hinglish.text, hinglish.loading, englishText, title, summary]);

  const busy = lang === "hinglish" ? hinglish.loading : loading;
  const showErr = lang === "hinglish" ? hinglish.err : err;

  const controls = useMemo(() => englishText && (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      {ttsSupported && (
        <button onClick={speak} disabled={!shown} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors disabled:opacity-40", speaking ? "border-mint-500/40 bg-mint-500/15 text-mint-200" : "border-white/15 text-zinc-300 hover:bg-white/5")}>
          {speaking ? <><Square className="h-3 w-3" /> Stop</> : <><Volume2 className="h-3.5 w-3.5" /> Listen</>}
        </button>
      )}
      {ttsSupported && (
        <button onClick={() => setRate((r) => nextRate(r))} title="Playback speed" aria-label={`Playback speed ${rate}x`} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-[12px] font-semibold text-zinc-300 transition-colors hover:bg-white/5">
          <Gauge className="h-3.5 w-3.5" /> {rate}×
        </button>
      )}
      <div className="inline-flex overflow-hidden rounded-full border border-white/15 text-[12px] font-semibold">
        <button onClick={() => switchLang("en")} className={cn("px-3 py-1 transition-colors", lang === "en" ? "bg-gold-500/20 text-gold-100" : "text-zinc-400 hover:text-zinc-100")}>EN</button>
        <button onClick={() => switchLang("hinglish")} className={cn("inline-flex items-center gap-1 px-3 py-1 transition-colors", lang === "hinglish" ? "bg-gold-500/20 text-gold-100" : "text-zinc-400 hover:text-zinc-100")}>
          <Languages className="h-3 w-3" /> Hinglish
        </button>
      </div>
    </div>
  ), [englishText, ttsSupported, speak, shown, speaking, switchLang, lang, rate]);

  return (
    // Was `bg-gold-500/[0.06]` - a 6% tint, not a background. It only ever read
    // as a panel because of whatever happened to be behind it, and inside the
    // news reader that was the article's own photo. This is the block people
    // actually read, so it must never sit on an image.
    //
    // #181411 is that same 6% gold (#e2a72f) pre-blended over the panel base
    // (#0b0b0f), so over a dark background it looks identical to before - it is
    // simply opaque now. Pre-blended rather than `.panel-solid` + the tint,
    // because both set `background-color` and the Tailwind utility would win.
    <div className={cn("rounded-2xl border border-gold-500/20 bg-[#181411] p-3.5 sm:p-4", className)}>
      <p className="mono inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gold-200">
        <RobotIcon className="h-4 w-4" /> Full briefing · XYZ AI
      </p>
      {busy && <p className="mt-2 inline-flex items-center gap-2 text-[13px] text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {lang === "hinglish" ? "Hinglish me likh raha hoon…" : "Writing the full briefing…"}</p>}
      {shown && !busy && <MarkdownLite text={shown} className="mt-1" />}
      {showErr && <p className="mt-1.5 text-[12px] text-amber-300">{showErr}</p>}
      {!loggedIn && !err && <p className="mt-1.5 text-[12px] text-zinc-500">Log in to read the full AI briefing of any story.</p>}
      {loggedIn && onGenerate && !englishText && !loading && !err && (
        <button
          onClick={onGenerate}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-3.5 py-1.5 text-[12px] font-semibold text-gold-200 transition-colors hover:bg-gold-500/20"
        >
          <Sparkles className="h-3.5 w-3.5" /> Generate briefing
        </button>
      )}
      {controls}
      <p className="mt-2 text-[10px] text-zinc-600">AI-generated from the headline &amp; excerpt. Not financial advice.</p>
    </div>
  );
}
