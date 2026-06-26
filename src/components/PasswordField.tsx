"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Score a password 0-4 for the strength meter (purely UI feedback). */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

const LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const BARS = ["bg-red-500", "bg-red-400", "bg-amber-400", "bg-mint-400", "bg-mint-500"];

export function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  strength = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  strength?: boolean;
}) {
  const [show, setShow] = useState(false);
  const score = passwordScore(value);

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          minLength={8}
          className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 pr-11 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-zinc-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {strength && value.length > 0 && (
        <div className="mt-2">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i < score ? BARS[score] : "bg-white/10"}`}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {LABELS[score]} · use 8+ chars with a number, upper/lowercase &amp; a symbol.
          </p>
        </div>
      )}
    </label>
  );
}
