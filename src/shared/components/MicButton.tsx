"use client";

import { useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechInput } from "@/shared/hooks/useSpeechInput";

/**
 * Dictation control for any composer or search box.
 *
 * Renders nothing where the browser has no SpeechRecognition (Firefox), so a
 * dead button never ships. Dictated text goes to `onText` - callers append it
 * to their input rather than submitting, so a misheard word can be fixed first.
 *
 * The live partial transcript and any error are surfaced by the caller through
 * the render-prop form below when there is room; the bare button is enough for
 * tight spots like a search field.
 */
export function MicButton({
  onText,
  onInterim,
  onError,
  continuous,
  size = "md",
  className,
}: {
  onText: (text: string) => void;
  onInterim?: (partial: string) => void;
  onError?: (message: string | null) => void;
  continuous?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const speech = useSpeechInput(onText, { continuous });

  // Mirror transcript/error outward without owning them, so the caller decides
  // where they appear (placeholder, helper line, toast). In effects, not during
  // render - calling a parent's setState while rendering is the cascading-render
  // shape the lint rule rejects.
  const { interim, error } = speech;
  useEffect(() => {
    onInterim?.(interim);
  }, [interim, onInterim]);
  useEffect(() => {
    onError?.(error);
  }, [error, onError]);

  if (!speech.supported) return null;

  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={speech.toggle}
      aria-label={speech.listening ? "Stop dictation" : "Dictate"}
      aria-pressed={speech.listening}
      title={speech.listening ? "Stop dictation" : "Dictate"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl ring-1 transition-colors",
        box,
        speech.listening
          ? "mic-live bg-mint-500/25 text-mint-100 ring-mint-400/60"
          : "text-zinc-400 ring-white/10 hover:bg-white/5 hover:text-zinc-200",
        className
      )}
    >
      {speech.listening ? <Square className={icon} /> : <Mic className={icon} />}
    </button>
  );
}
