"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { SocialButtons, type SocialProviders } from "./SocialButtons";
import { PasswordField } from "./PasswordField";

// Friendly text for the ?error=<code> values NextAuth appends on an OAuth failure.
const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That email is already registered with a different sign-in method. Try that method, or use a different account.",
  OAuthSignin: "Couldn't start sign-in with that provider. Please try again.",
  OAuthCallback: "Sign-in was interrupted before it finished. Please try again.",
  OAuthCreateAccount: "Couldn't create your account from that provider. Please try again.",
  Callback: "Sign-in was interrupted before it finished. Please try again.",
  AccessDenied: "Access was denied. Please approve the permissions and try again.",
  Configuration: "Social sign-in is temporarily unavailable. Please try email, or try again later.",
  Verification: "This sign-in link has expired. Please request a new one.",
  default: "Couldn't sign you in. Please try again.",
};

export function LoginForm({ providers }: { providers: SocialProviders }) {
  const router = useRouter();
  const params = useSearchParams();
  // Open-redirect guard: only allow same-origin relative paths (block //evil.com,
  // https://…, and backslash tricks) so a crafted ?callbackUrl can't phish users.
  const rawCallback = params.get("callbackUrl") || "/";
  const callbackUrl = /^\/(?!\/)[^\\]*$/.test(rawCallback) ? rawCallback : "/";
  const justReset = params.get("reset") === "1";
  // NextAuth sends OAuth failures back here as ?error=<code>. Map the common
  // ones to plain-English messages so a failed Google/GitHub/X sign-in shows a
  // reason instead of silently dropping the user back on the login screen.
  const errorParam = params.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorParam ? (OAUTH_ERRORS[errorParam] ?? OAUTH_ERRORS.default) : "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        flow: "login",
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {justReset && (
        <p className="rounded-lg bg-mint-500/10 px-3 py-2 text-sm text-mint-200 ring-1 ring-mint-500/20">
          Password reset. Please log in with your new password.
        </p>
      )}
      <SocialButtons providers={providers} mode="in" />

      {(providers.google || providers.github || providers.twitter) && (
        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@email.com" autoComplete="email" />
        <div>
          <PasswordField label="Password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs font-medium text-gold-200 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-gold w-full disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        New to XYZ Crypto?{" "}
        <Link href="/signup" className="font-semibold text-gold-200 hover:underline">
          Create an account
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
        className="w-full rounded-xl border border-white/10 bg-ink-700/60 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
      />
    </label>
  );
}
