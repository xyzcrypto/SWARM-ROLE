"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FormField } from "./FormField";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send reset code.");
        return;
      }
      setDevCode(data.devCode);
      setInfo("If an account exists for that email, a 6-digit code is on its way.");
      setStep("reset");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not reset password.");
        return;
      }
      router.push("/login?reset=1");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "reset") {
    return (
      <form onSubmit={reset} className="space-y-4">
        {info && (
          <p className="rounded-lg bg-mint-500/10 px-3 py-2 text-sm text-mint-200 ring-1 ring-mint-500/20">
            {info}
          </p>
        )}
        {devCode && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/20">
            Dev mode (email not configured): your code is{" "}
            <span className="mono font-bold">{devCode}</span>
          </p>
        )}
        <FormField
          label="6-digit code"
          type="text"
          value={code}
          onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••"
          autoComplete="one-time-code"
        />
        <FormField
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 6 characters"
          autoComplete="new-password"
        />
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading || code.length !== 6} className="btn-gold w-full disabled:opacity-60">
          {loading ? "Resetting…" : "Reset password"}
        </button>
        <button
          type="button"
          onClick={() => setStep("email")}
          className="block w-full text-center text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4">
      <p className="text-sm text-zinc-500">
        Enter your email and we&apos;ll send a 6-digit code to reset your password.
      </p>
      <FormField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
        {loading ? "Sending…" : "Send reset code"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        Remembered it?{" "}
        <Link href="/login" className="tap-target-all font-semibold text-gold-200 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}
