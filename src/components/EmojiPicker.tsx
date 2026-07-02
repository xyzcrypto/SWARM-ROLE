"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Curated emoji set - no external library (keeps the bundle small). Grouped
// loosely by vibe; enough for a lively crypto community chat.
const EMOJIS = [
  "😀", "😂", "🤣", "😅", "😊", "😍", "😎", "🤩",
  "🤔", "🫡", "😴", "😭", "😡", "🥳", "🤝", "🙏",
  "👍", "👎", "👏", "🔥", "💯", "✨", "⚡", "🚀",
  "🌙", "📈", "📉", "💰", "💎", "🪙", "🏆", "🎯",
  "❤️", "🧡", "💚", "💙", "💜", "👀", "🎉", "🤑",
  "🐂", "🐻", "🦍", "💪", "🧠", "👋", "😏", "🤡",
];

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full right-0 z-20 mb-2 w-64 max-w-[88vw] rounded-2xl border border-line bg-ink-900/95 p-2 shadow-elevate backdrop-blur-xl"
    >
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-lg transition-transform hover:scale-125 hover:bg-white/10"
          >
            {e}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
