"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { markNewsletterSubscribed } from "@/shared/hooks/useNewsletterSubscribed";

export function WaitlistForm({
  source = "website",
  className,
  placeholder = "you@email.com",
  cta = "Get early access",
}: {
  source?: string;
  className?: string;
  placeholder?: string;
  cta?: string;
}) {
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  // Account holders are already "in" - compact confirmation, no waitlist form.
  if (session) {
    return (
      <div className={cn("flex items-center justify-between gap-2 rounded-xl border border-mint-500/30 bg-mint-500/10 px-3 py-2", className)}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-500/20 text-mint-300">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <p className="truncate text-[13px] text-mint-100">You&apos;re in - account has access.</p>
        </div>
        <Link href="/academy/research" className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-mint-200 hover:underline">
          Explore <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not subscribe.");
        setState("error");
        return;
      }
      setState("done");
      markNewsletterSubscribed();
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className={cn("flex items-center gap-3 rounded-2xl border border-mint-500/30 bg-mint-500/10 px-4 py-3.5", className)}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-mint-500/20 text-mint-300">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <p className="text-sm text-mint-100">
          You&apos;re on the list, we&apos;ll be in touch. 🎉
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={cn("w-full", className)}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          autoComplete="email"
          className="w-full flex-1 rounded-full border border-line bg-ink-700/70 px-5 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-mint-500/50 focus:ring-2 focus:ring-mint-500/15"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="btn-primary shrink-0 disabled:opacity-60"
        >
          {state === "loading" ? "Joining…" : cta}
          {state !== "loading" && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
      {state === "error" && (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      )}
      <p className="mt-2 text-[11px] text-zinc-600">
        No spam. Unsubscribe anytime. No wallet required.
      </p>
    </form>
  );
}
