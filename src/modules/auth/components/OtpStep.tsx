"use client";

import { useEffect, useState } from "react";

/**
 * Shared 6-digit OTP entry step. The parent supplies what to do on verify /
 * resend; this component handles the input, loading, errors and resend cooldown.
 */
export function OtpStep({
  email,
  devCode,
  submitLabel,
  onVerify,
  onResend,
  onBack,
}: {
  email: string;
  devCode?: string;
  submitLabel: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onVerify(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      setLoading(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setError("");
    try {
      await onResend();
      setCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-zinc-100">
          Enter your code
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          We sent a 6-digit code to <span className="text-zinc-300">{email}</span>.
        </p>
      </div>

      {devCode && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/20">
          Dev mode (email not configured): your code is{" "}
          <span className="mono font-bold">{devCode}</span>
        </p>
      )}

      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="••••••"
        autoFocus
        className="mono w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-center text-2xl tracking-[0.5em] text-zinc-100 outline-none transition-colors placeholder:text-zinc-700 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
      />

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="btn-gold w-full disabled:opacity-60"
      >
        {loading ? "Verifying…" : submitLabel}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="font-medium text-gold-200 transition-colors hover:text-gold-100 disabled:text-zinc-600"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
