"use client";

import { useState } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink-700/60 px-3.5 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-mint-500/50 focus:ring-2 focus:ring-mint-500/20";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="surface flex flex-col items-center rounded-2xl px-6 py-10 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-mint-500/15 text-mint-300 ring-1 ring-mint-500/30">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <p className="mt-4 font-display text-lg font-semibold text-zinc-50">Message sent</p>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-400">
          Thanks for reaching out - we&apos;ll get back to you at {email || "your email"} soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="surface space-y-4 rounded-2xl p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-zinc-400">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="Your name"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold text-zinc-400">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@email.com"
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold text-zinc-400">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="How can we help?"
          className={inputCls + " resize-none"}
        />
      </div>
      {error && <p className="text-[12px] text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60 sm:w-auto">
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" /> Send message
          </span>
        )}
      </button>
    </form>
  );
}
