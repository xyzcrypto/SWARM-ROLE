"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Volume2, Square, Languages } from "lucide-react";
import { MarkdownLite, stripMarkdown } from "./MarkdownLite";
import { RobotIcon } from "./RobotIcon";
import { cn } from "@/lib/utils";

// Shared AI-briefing block: renders the markdown briefing plus a "Listen" (free
// browser text-to-speech) control and an EN / Hinglish toggle (AI-translated on
// demand). Used by both the News reader and the shared-story page.
export function BriefingBlock({
  englishText, loading, err, title, summary, loggedIn, className,
}: {
  englishText: string | null;
  loading: boolean;
  err: string | null;
  title: string;
  summary: string;
  loggedIn: boolean;
  className?: string;
}) {
  const [lang, setLang] = useState<"en" | "hinglish">("en");
  const [hinglish, setHinglish] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });
  const [speaking, setSpeaking] = useState(false);

  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Reset translation + stop speech when the story changes.
  useEffect(() => {
    setLang("en");
    setHinglish({ loading: false, text: null, err: null });
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [englishText]);

  // Always stop speech on unmount.
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  const shown = lang === "hinglish" ? hinglish.text : englishText;

  const speak = useCallback(() => {
    if (!ttsSupported || !shown) return;
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(stripMarkdown(shown));
    const voices = synth.getVoices();
    const pick = (langs: string[]) => langs.map((l) => voices.find((v) => v.lang === l || v.lang.startsWith(l))).find(Boolean);
    u.voice = (lang === "hinglish" ? pick(["hi-IN", "en-IN", "en"]) : pick(["en-US", "en-GB", "en-IN", "en"])) || null;
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
    setSpeaking(true);
  }, [ttsSupported, shown, speaking, lang]);

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
      <div className="inline-flex overflow-hidden rounded-full border border-white/15 text-[12px] font-semibold">
        <button onClick={() => switchLang("en")} className={cn("px-3 py-1 transition-colors", lang === "en" ? "bg-gold-500/20 text-gold-100" : "text-zinc-400 hover:text-zinc-100")}>EN</button>
        <button onClick={() => switchLang("hinglish")} className={cn("inline-flex items-center gap-1 px-3 py-1 transition-colors", lang === "hinglish" ? "bg-gold-500/20 text-gold-100" : "text-zinc-400 hover:text-zinc-100")}>
          <Languages className="h-3 w-3" /> Hinglish
        </button>
      </div>
    </div>
  ), [englishText, ttsSupported, speak, shown, speaking, switchLang, lang]);

  return (
    <div className={cn("rounded-2xl border border-gold-500/20 bg-gold-500/[0.06] p-3.5 sm:p-4", className)}>
      <p className="mono inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gold-200">
        <RobotIcon className="h-4 w-4" /> Full briefing · XYZ AI
      </p>
      {busy && <p className="mt-2 inline-flex items-center gap-2 text-[13px] text-zinc-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {lang === "hinglish" ? "Hinglish me likh raha hoon…" : "Writing the full briefing…"}</p>}
      {shown && !busy && <MarkdownLite text={shown} className="mt-1" />}
      {showErr && <p className="mt-1.5 text-[12px] text-amber-300">{showErr}</p>}
      {!loggedIn && !err && <p className="mt-1.5 text-[12px] text-zinc-500">Log in to read the full AI briefing of any story.</p>}
      {controls}
      <p className="mt-2 text-[10px] text-zinc-600">AI-generated from the headline &amp; excerpt. Not financial advice.</p>
    </div>
  );
}
