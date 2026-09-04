"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticToggle } from "@shared/utils/haptics";

/**
 * Light/dark theme toggle. Toggles the `dark` class on <html> and persists the
 * choice to localStorage (read back by the no-FOUC script in layout.tsx). Dark
 * is the default. Themeable components key off the semantic CSS tokens.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    // A state flip the user should feel land. No-ops on iOS (no Vibration API)
    // and under reduced motion, so the visual flip is always the real feedback.
    hapticToggle();
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      /* ignore storage errors */
    }
    setDark(isDark);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white/5 text-zinc-300 transition-colors hover:border-gold-500/30 hover:text-gold-200",
        className
      )}
    >
      {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
