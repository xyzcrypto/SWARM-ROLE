"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/useClientFlag";

/**
 * The reasons, and how they are worded.
 *
 * Mirrors the server's `REPORT_REASONS` enum exactly - the server validates,
 * this list only labels. They are phrased as things that happened rather than
 * as categories ("Pretending to be someone else" beats "Impersonation"),
 * because a reporter picking in a hurry matches on the sentence.
 */
const REASONS = [
  { id: "harassment", label: "Harassment or abuse", hint: "Targeted insults, bullying" },
  { id: "spam", label: "Spam", hint: "Repetitive or unsolicited posting" },
  { id: "scam", label: "Scam or phishing", hint: "Fake links, drainers, impersonation" },
  { id: "threat", label: "Threats or violence" },
  { id: "illegal", label: "Illegal content" },
  { id: "other", label: "Something else" },
] as const;

type Reason = (typeof REASONS)[number]["id"];

/**
 * Report a chat message.
 *
 * ## What the reporter is told, and what they are not
 *
 * ⚠️ Success says "Thanks - the team will take a look" and nothing more. It
 * does not say whether the message was already reported, how many times, or
 * what happened next. All of that is moderation state, and a dialog that leaks
 * it turns reporting into a way to probe the room. The server returns the same
 * response for a first report and a duplicate for the same reason.
 *
 * Reporting also does not hide anything for the reporter. A self-service hide
 * would let any member silence any other; hiding stays with staff.
 *
 * ## Accessibility
 *
 * A real dialog: `role="dialog"`, `aria-modal`, labelled by its heading, focus
 * moved in on open and Escape to close. The reason list is a radio group, so a
 * screen reader announces "2 of 6" rather than reading six unrelated buttons.
 * Rendered through a portal because the chat shell is `overflow-hidden` - a
 * fixed child of an overflow-hidden ancestor is still clipped by it.
 */
export function ReportDialog({
  messageId,
  preview,
  onClose,
}: {
  messageId: string;
  /** A short excerpt, so the reporter can see what they are reporting. */
  preview: string;
  onClose: () => void;
}) {
  const hydrated = useHydrated();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Restore the previous value rather than blanking it: another overlay may
    // already hold the lock, and clearing it would free the page under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function submit() {
    if (!reason || state === "sending") return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch(`/api/chat/messages/${messageId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error ?? "Could not send that report. Please try again.");
        setState("idle");
        return;
      }
      setState("done");
      // Long enough to read the confirmation, short enough not to trap anyone.
      setTimeout(onClose, 1400);
    } catch {
      setError("Network error. Please try again.");
      setState("idle");
    }
  }

  if (!hydrated) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/80 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      onMouseDown={(e) => {
        // Only a press that STARTS on the backdrop closes - otherwise a text
        // selection that began inside and ended outside would discard a report
        // someone was part-way through writing.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-rise-in glass flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-gold-500/20 shadow-elevate sm:rounded-3xl">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="report-title" className="font-display text-base font-bold text-content">
              Report this message
            </h2>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-content-subtle">
              “{preview}”
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close the report dialog"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-hairline text-content-subtle transition-all hover:scale-105 hover:border-gold-500/30 hover:text-content active:scale-105"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {state === "done" ? (
          /* ⚠️ Deliberately says nothing about what happens next, whether it
             was already reported, or by whom. See the component note. */
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-mint-500/30 bg-mint-500/10 text-mint-300">
              <Check className="h-6 w-6" strokeWidth={2} />
            </span>
            <p className="text-sm font-semibold text-content">Thanks — that has been sent.</p>
            <p className="max-w-xs text-xs leading-relaxed text-content-muted">
              The team will take a look. You will not be told who reviewed it.
            </p>
          </div>
        ) : (
          <>
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              <fieldset>
                <legend className="mono text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
                  What is wrong with it?
                </legend>
                <div className="mt-3 space-y-1.5" role="radiogroup" aria-label="Reason for reporting">
                  {REASONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={reason === r.id}
                      onClick={() => setReason(r.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200",
                        // 44px minimum target: this list is used on a phone,
                        // often in a hurry.
                        "min-h-11 active:scale-[0.99]",
                        reason === r.id
                          ? "border-gold-500/45 bg-gold-500/10"
                          : "border-hairline hover:border-gold-500/25 hover:bg-white/[0.04]"
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors",
                          reason === r.id ? "border-gold-400 bg-gold-400" : "border-content-subtle"
                        )}
                      >
                        {reason === r.id && <span className="h-1.5 w-1.5 rounded-full bg-ink-950" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-content">{r.label}</span>
                        {"hint" in r && r.hint && (
                          <span className="mt-0.5 block text-[11px] text-content-subtle">{r.hint}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="mt-4 block">
                <span className="mono text-[10px] font-semibold uppercase tracking-[0.16em] text-content-subtle">
                  Anything to add? <span className="normal-case tracking-normal">(optional)</span>
                </span>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 600))}
                  rows={3}
                  placeholder="Context that would help someone reviewing this…"
                  className="mt-2 block w-full resize-none rounded-xl border border-hairline bg-base px-3.5 py-2.5 text-sm text-content outline-none transition-colors placeholder:text-content-subtle focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
                />
                <span className="mono mt-1 block text-right text-[10px] text-content-subtle">
                  {details.length}/600
                </span>
              </label>

              {error && (
                <p className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-amber-200">
                  {error}
                </p>
              )}
            </div>

            {/* ── Footer ───────────────────────────────────────────── */}
            <div className="flex items-center gap-3 border-t border-hairline bg-surface-2 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-3.5">
              <p className="text-[11px] leading-relaxed text-content-subtle">
                Reporting does not remove the message.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary ml-auto inline-flex min-h-10 items-center text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!reason || state === "sending"}
                className="btn-gold inline-flex min-h-10 items-center gap-1.5 text-xs disabled:opacity-50"
              >
                {state === "sending" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {state === "sending" ? "Sending…" : "Send report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
