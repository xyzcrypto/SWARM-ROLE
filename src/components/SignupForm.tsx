"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { GoogleButton } from "./GoogleButton";
import { OtpStep } from "./OtpStep";

export function SignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | undefined>();

  async function startSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not start signup.");
        return;
      }
      setDevCode(data.devCode);
      setStep("otp");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(code: string) {
    const login = await signIn("credentials", {
      email,
      code,
      flow: "signup",
      redirect: false,
    });
    if (login?.error) {
      throw new Error("Incorrect or expired code. Please try again.");
    }
    router.push("/");
    router.refresh();
  }

  async function resend() {
    const res = await fetch("/api/auth/signup/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not resend code.");
    setDevCode(data.devCode);
  }

  if (step === "otp") {
    return (
      <OtpStep
        email={email}
        devCode={devCode}
        submitLabel="Verify & create account"
        onVerify={verify}
        onResend={resend}
        onBack={() => setStep("details")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <GoogleButton enabled={googleEnabled} label="Sign up with Google" />

      {googleEnabled && (
        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>
      )}

      <form onSubmit={startSignup} className="space-y-4">
        <Field label="Full name" type="text" value={name} onChange={setName} placeholder="Satoshi Nakamoto" autoComplete="name" />
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" autoComplete="new-password" />

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
          {loading ? "Sending code…" : "Continue"}
        </button>
      </form>

      <p className="text-center text-xs leading-relaxed text-zinc-600">
        We&apos;ll email you a 6-digit code to verify your address. By creating an
        account you agree to receive product updates. Opt out anytime.
      </p>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-gold-200 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        minLength={type === "password" ? 6 : undefined}
        className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
      />
    </label>
  );
}
