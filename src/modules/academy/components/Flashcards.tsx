"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Check, Layers, RotateCcw, Trophy, X } from "lucide-react";
import { sfx } from "../client/audio";
import { burstConfetti } from "./ui";

type Card = { term: string; definition: string };
const KEY = (id: string) => `xyz:academy:flash:${id}`;

/** Terms this learner marked "Got it" for a lesson, kept on the device. */
function loadKnown(id: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(id)) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Flashcard practice for a lesson's key concepts: a full-screen deck with a 3D
 * flip, swipe right for "Got it" and left for "Still learning" (or the
 * buttons, or ← → and Space), sounds and haptics on every move, and a summary
 * that can replay only the cards that are not learned yet.
 */
export function Flashcards({ lessonId, cards, lessonTitle }: { lessonId: string; cards: Card[]; lessonTitle: string }) {
  const [open, setOpen] = useState(false);
  const [deck, setDeck] = useState<Card[]>([]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [dir, setDir] = useState(0);

  const start = useCallback(
    (onlyNew: boolean) => {
      const k = loadKnown(lessonId);
      setKnown(k);
      const d = onlyNew ? cards.filter((c) => !k.includes(c.term)) : cards;
      setDeck(d.length ? d : cards);
      setI(0);
      setFlip(false);
      setOpen(true);
      sfx("whoosh");
    },
    [cards, lessonId]
  );

  const mark = useCallback(
    (got: boolean) => {
      const c = deck[i];
      if (!c) return;
      setDir(got ? 1 : -1);
      sfx(got ? "correct" : "pop");
      setKnown((prev) => {
        const next = got ? [...new Set([...prev, c.term])] : prev.filter((t) => t !== c.term);
        try {
          localStorage.setItem(KEY(lessonId), JSON.stringify(next));
        } catch {
          /* still counts for this visit */
        }
        return next;
      });
      setFlip(false);
      setI((x) => x + 1);
    },
    [deck, i, lessonId]
  );

  const done = open && i >= deck.length;
  const learned = useMemo(() => cards.filter((c) => known.includes(c.term)).length, [cards, known]);
  useEffect(() => {
    if (done && learned === cards.length) {
      sfx("levelup");
      burstConfetti(undefined, 80);
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (done) return;
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlip((f) => !f);
        sfx("click");
      } else if (e.key === "ArrowRight") mark(true);
      else if (e.key === "ArrowLeft") mark(false);
    };
    window.addEventListener("keydown", on);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", on);
      document.body.style.overflow = prev;
    };
  }, [open, done, mark]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110 || info.velocity.x > 600) mark(true);
    else if (info.offset.x < -110 || info.velocity.x < -600) mark(false);
  };

  const card = deck[i];
  return (
    <>
      <button type="button" onClick={() => start(false)} className="btn-gold h-10 px-4 text-sm">
        <Layers className="h-4 w-4" /> Practice as flashcards
      </button>
      {open &&
        createPortal(
          <div className="acad-flash fixed inset-0 z-[80] flex flex-col items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Flashcards">
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="fc-chip absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full">
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4 w-full max-w-md text-center">
              <div className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-gold-300">{lessonTitle}</div>
              <div className="mt-2 flex items-center gap-2">
                <div className="fc-track h-1.5 flex-1 overflow-hidden rounded-full">
                  <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-mint-400 transition-[width] duration-300" style={{ width: `${(Math.min(i, deck.length) / Math.max(1, deck.length)) * 100}%` }} />
                </div>
                <span className="fc-ink-70 font-mono text-xs">
                  {Math.min(i + 1, deck.length)}/{deck.length}
                </span>
              </div>
            </div>

            {!done && card ? (
              <>
                <div className="relative h-[min(52vh,380px)] w-full max-w-md" style={{ perspective: 1200 }}>
                  <AnimatePresence initial={false} custom={dir}>
                    <motion.div
                      key={`${i}-${card.term}`}
                      custom={dir}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.7}
                      onDragEnd={onDragEnd}
                      initial={{ opacity: 0, y: 30, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: dir * 420, rotate: dir * 18, transition: { duration: 0.32 } }}
                      transition={{ type: "spring", stiffness: 300, damping: 26 }}
                      className="absolute inset-0 cursor-grab active:cursor-grabbing"
                      onClick={() => {
                        setFlip((f) => !f);
                        sfx("click");
                      }}
                    >
                      <div className={flip ? "acad-flip-card is-flipped" : "acad-flip-card"}>
                        <div className="acad-flip-face acad-flip-front">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">Concept</div>
                          <div className="mt-3 fc-ink font-display text-3xl font-semibold leading-tight sm:text-4xl">{card.term}</div>
                          <div className="fc-ink-50 absolute bottom-5 text-xs">Tap to flip · swipe right if you know it</div>
                        </div>
                        <div className="acad-flip-face acad-flip-back">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mint-300">Meaning</div>
                          <p className="fc-ink-90 mt-3 text-lg leading-relaxed">{card.definition}</p>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="mt-6 flex w-full max-w-md gap-3">
                  <button type="button" onClick={() => mark(false)} className="fc-ghost flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold">
                    <RotateCcw className="h-4 w-4" /> Still learning
                  </button>
                  <button type="button" onClick={() => mark(true)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint-500 to-mint-400 text-sm font-bold text-ink-950">
                    <Check className="h-4 w-4" /> Got it
                  </button>
                </div>
                <div className="fc-ink-40 mt-3 hidden text-[11px] sm:block">Space flips · ← still learning · → got it · Esc closes</div>
              </>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="fc-panel w-full max-w-md rounded-3xl p-6 text-center">
                <Trophy className="mx-auto h-10 w-10 text-gold-300" />
                <div className="fc-ink mt-3 font-display text-2xl font-semibold">
                  {learned === cards.length ? "Every concept learned!" : `${learned} of ${cards.length} learned`}
                </div>
                <p className="fc-ink-60 mt-1 text-sm">Your progress is saved on this device.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {learned < cards.length && (
                    <button type="button" onClick={() => start(true)} className="btn-gold h-11 px-5 text-sm">
                      <RotateCcw className="h-4 w-4" /> Practise the rest
                    </button>
                  )}
                  <button type="button" onClick={() => start(false)} className="fc-ghost inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold">
                    Start over
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="btn-primary h-11 px-5 text-sm">
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
