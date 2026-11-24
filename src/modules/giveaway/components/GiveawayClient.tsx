"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, BookOpen, CheckCircle2, Circle, ExternalLink, Gift, ImagePlus, Loader2, Radio, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { cn, maskEmail } from "@/lib/utils";
import { compressImage } from "@shared/utils/compress-image";
import { BUNGEE_CODE, BUNGEE_LEARN_PATH, BUNGEE_LINKS, BUNGEE_PRIZE, BUNGEE_REF_URL } from "../lib/bungee";

type Status = {
  open: boolean;
  lessons: { total: number; done: number; list: { slug: string; title: string; done: boolean; score: number | null }[] };
  live: { held: number; played: number; score: number; correct: number };
  entry: { bungeeUid: string; bungeeEmail: string; telegram: string; hasProof: boolean; status: string; updatedAt: string } | null;
};

const INPUT =
  "w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-content outline-none transition-colors placeholder:text-content-subtle focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20";

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  pending: { text: "Submitted, waiting for review", tone: "text-gold-300" },
  verified: { text: "Verified: you are in the draw", tone: "text-mint-300" },
  winner: { text: "Winner! We will contact you on Telegram", tone: "text-mint-300" },
  rejected: { text: "Not eligible", tone: "text-red-400" },
};

async function fetchStatus(): Promise<Status | null> {
  const r = await fetch("/api/giveaway/bungee", { cache: "no-store" });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || "Could not load your progress.");
  return d?.guest ? null : (d as Status);
}

export function GiveawayClient() {
  const { data: session, status: auth } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchStatus().then(
        (d) => {
          if (d) setStatus(d);
          setLoadErr(null);
        },
        (e: Error) => setLoadErr(e.message)
      ),
    []
  );

  useEffect(() => {
    if (auth !== "authenticated") return;
    let alive = true;
    fetchStatus().then(
      (d) => {
        if (!alive) return;
        if (d) setStatus(d);
        setLoadErr(null);
      },
      (e: Error) => alive && setLoadErr(e.message)
    );
    return () => {
      alive = false;
    };
  }, [auth]);

  const user = session?.user as { name?: string | null; email?: string | null; username?: string | null } | undefined;
  const lessonsDone = !!status && status.lessons.total > 0 && status.lessons.done >= status.lessons.total;

  return (
    <div>
      {/* Hero */}
      <section className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/[0.07] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">
          <Gift className="h-3.5 w-3.5" /> XYZ Crypto x Bungee Funded Perps
        </div>
        <h1 className="mx-auto mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight text-content sm:text-5xl">
          Win one of <span className="text-gold-gradient">3x $10K</span> funded accounts
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-content-muted">
          Learn how Bungee Funded Perps really works, prove it in the Bungee live quizzes, and submit your entry. Three winners get a $10,000 Bungee Funded
          Perps account each.
        </p>
      </section>

      {/* Steps */}
      <section className="mt-10 grid gap-3">
        <Step
          n={1}
          done={auth === "authenticated"}
          icon={<UserRound className="h-5 w-5" />}
          title="Sign up on xyzcrypto.io"
          body={
            auth === "authenticated"
              ? `Signed in as ${user?.username ? `@${user.username}` : user?.name || maskEmail(user?.email)}. This account is your entry.`
              : "Your XYZ Crypto account is your entry. One account per person."
          }
          action={
            auth === "unauthenticated" ? (
              <div className="flex flex-wrap gap-2">
                <Link href={`/signup?callbackUrl=${encodeURIComponent(BUNGEE_LINKS.giveaway)}`} className="btn-gold h-10 px-4 text-sm">
                  Sign up
                </Link>
                <Link href={`/login?callbackUrl=${encodeURIComponent(BUNGEE_LINKS.giveaway)}`} className="btn-ghost h-10 px-4 text-sm">
                  Log in
                </Link>
              </div>
            ) : null
          }
        />
        <Step
          n={2}
          done={lessonsDone}
          icon={<BookOpen className="h-5 w-5" />}
          title={`Complete all ${status?.lessons.total || 8} Bungee lessons`}
          body="Read each lesson in the Academy and pass its knowledge check (60% or more). Completion is verified automatically. Then take a screenshot of the track page showing every lesson completed."
          action={
            <Link href={BUNGEE_LEARN_PATH} className="btn-primary h-10 px-4 text-sm">
              Open the Bungee lessons <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          {status && status.lessons.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-content-subtle">
                <span>
                  {status.lessons.done} of {status.lessons.total} completed
                </span>
                <span>{Math.round((status.lessons.done / status.lessons.total) * 100)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-mint-400 transition-[width] duration-500" style={{ width: `${(status.lessons.done / status.lessons.total) * 100}%` }} />
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {status.lessons.list.map((l) => (
                  <li key={l.slug} className="min-w-0">
                    <Link href={`${BUNGEE_LEARN_PATH}/${l.slug}`} className="flex min-w-0 items-center gap-2 text-xs text-content-muted hover:text-gold-300">
                      {l.done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-mint-400" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-content-subtle" />}
                      <span className="truncate">{l.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Step>
        <Step
          n={3}
          done={!!status && status.live.played > 0}
          icon={<Radio className="h-5 w-5" />}
          title="Play the Bungee live quizzes until the giveaway ends"
          body={
            status
              ? `You have played ${status.live.played} of ${status.live.held} Bungee live quizzes${status.live.played ? ` (${status.live.correct} correct, ${status.live.score} points)` : ""}. Staying active shows you are genuinely interested.`
              : "Live rounds run until the giveaway ends. Your participation is tracked automatically."
          }
          action={
            <Link href={BUNGEE_LINKS.live} className="btn-ghost h-10 px-4 text-sm">
              Go to the live quiz <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
        <Step
          n={4}
          done={!!status?.entry}
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Have a Bungee account"
          body={`You need your Bungee UID and the email you use on Bungee. New to Bungee? Sign up through the XYZ Crypto link and use code ${BUNGEE_CODE} when you buy a challenge.`}
          action={
            <a href={BUNGEE_REF_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn-ghost h-10 px-4 text-sm">
              Open Bungee <ExternalLink className="h-4 w-4" />
            </a>
          }
        />
      </section>

      {/* Entry */}
      <section className="mt-10 rounded-3xl border border-gold-400/30 bg-gradient-to-br from-gold-400/[0.08] to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-300">
          <Trophy className="h-3.5 w-3.5" /> Step 5: submit your entry
        </div>
        {auth === "loading" || (auth === "authenticated" && !status && !loadErr) ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-content-subtle">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your progress...
          </div>
        ) : auth === "unauthenticated" ? (
          <p className="mt-3 text-sm text-content-muted">Sign up or log in first. Your entry is linked to your XYZ Crypto account.</p>
        ) : loadErr ? (
          <div className="mt-4 text-sm text-red-400">
            {loadErr}{" "}
            <button type="button" onClick={() => void load()} className="underline">
              Retry
            </button>
          </div>
        ) : status ? (
          <EntryForm status={status} lessonsDone={lessonsDone} onSaved={setStatus} />
        ) : null}
      </section>

      {/* Rules */}
      <section className="mt-10 grid gap-3 text-sm leading-relaxed text-content-muted">
        <h2 className="font-display text-lg font-semibold text-content">Rules</h2>
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>Prize: {BUNGEE_PRIZE}, one per winner. Three winners in total.</li>
          <li>One entry per person. Multiple accounts, shared Bungee UIDs or fake details disqualify every entry involved.</li>
          <li>All lessons must be completed on your own account. Completion is checked on our side, not only from the screenshot.</li>
          <li>Live quizzes are monitored: answer order is different for every player, instant answers score nothing, and leaving the quiz tab during a question is recorded.</li>
          <li>Winners are chosen by XYZ Crypto from complete, genuine entries, with activity in the Bungee live quizzes taken into account, and are contacted on Telegram.</li>
          <li>Bungee Funded Perps is not available in restricted jurisdictions, and funded accounts require Bungee KYC. Prizes follow Bungee&apos;s rules and terms.</li>
        </ul>
        <p className="text-xs text-content-subtle">Trading involves substantial risk. Past performance is not indicative of future results.</p>
      </section>
    </div>
  );
}

function Step({
  n,
  done,
  icon,
  title,
  body,
  action,
  children,
}: {
  n: number;
  done: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border bg-surface p-4 sm:p-5", done ? "border-mint-400/35" : "border-hairline")}>
      <div className="flex gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
            done ? "border-mint-400/40 bg-mint-400/10 text-mint-300" : "border-gold-400/30 bg-gold-400/[0.07] text-gold-300"
          )}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-subtle">Step {n}</div>
          <h3 className="mt-0.5 font-display text-base font-semibold text-content sm:text-lg">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-content-muted">{body}</p>
          {children}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}

function EntryForm({ status, lessonsDone, onSaved }: { status: Status; lessonsDone: boolean; onSaved: (s: Status) => void }) {
  const e = status.entry;
  const [uid, setUid] = useState(e?.bungeeUid ?? "");
  const [email, setEmail] = useState(e?.bungeeEmail ?? "");
  const [tg, setTg] = useState(e?.telegram ?? "");
  const [shot, setShot] = useState<string | null>(null);
  const [agree, setAgree] = useState(!!e);
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = e?.status === "winner" || e?.status === "rejected";

  if (!status.open && !e) return <p className="mt-3 text-sm text-content-muted">Entries are closed. Thank you to everyone who took part.</p>;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return setMsg({ ok: false, text: "Choose an image file." });
    try {
      setShot(await compressImage(file));
      setMsg(null);
    } catch {
      setMsg({ ok: false, text: "That image could not be read. Try a PNG or JPEG screenshot." });
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy || locked) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/giveaway/bungee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bungeeUid: uid, bungeeEmail: email, telegram: tg, proof: shot ?? undefined, agree, website: hp || undefined }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "Could not save your entry.");
      if (d?.status) onSaved(d.status as Status);
      setShot(null);
      setMsg({ ok: true, text: d?.updated ? "Entry updated." : "You are in! Keep playing the Bungee live quizzes until the giveaway ends." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const label = e ? STATUS_LABEL[e.status] ?? STATUS_LABEL.pending : null;

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4">
      {e && label && (
        <div className="rounded-2xl border border-hairline bg-surface p-4 text-sm">
          <span className="text-content-subtle">Your entry: </span>
          <span className={cn("font-semibold", label.tone)}>{label.text}</span>
          <span className="block text-xs text-content-subtle">Last saved {new Date(e.updatedAt).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC</span>
        </div>
      )}
      {!lessonsDone && (
        <div className="rounded-2xl border border-gold-400/30 bg-gold-400/[0.06] p-4 text-sm text-content-muted">
          Complete all {status.lessons.total} Bungee lessons first ({status.lessons.done} done). The form unlocks when every knowledge check is passed.
        </div>
      )}
      <fieldset disabled={!lessonsDone || locked || busy} className="grid gap-4 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bungee UID" hint="Exactly as shown in your Bungee dashboard">
            <input value={uid} onChange={(x) => setUid(x.target.value)} required maxLength={80} autoComplete="off" className={INPUT} placeholder="Your Bungee UID" />
          </Field>
          <Field label="Bungee account email" hint="The email you use to sign in on Bungee">
            <input type="email" value={email} onChange={(x) => setEmail(x.target.value)} required maxLength={160} autoComplete="email" className={INPUT} placeholder="you@example.com" />
          </Field>
          <Field label="Telegram" hint="@username or numeric id. Winners are contacted here">
            <input value={tg} onChange={(x) => setTg(x.target.value)} required maxLength={64} autoComplete="off" className={INPUT} placeholder="@yourname" />
          </Field>
          <Field label="XYZ Crypto account" hint="Linked automatically">
            <input value={status.entry ? "This account" : "This account (signed in)"} readOnly className={cn(INPUT, "opacity-70")} />
          </Field>
        </div>
        <Field label="Screenshot: all Bungee lessons completed" hint={e?.hasProof && !shot ? "Already uploaded. Choose a new one to replace it." : "PNG, JPEG or WebP"}>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-hairline bg-surface px-4 py-3 text-sm text-content-muted hover:border-gold-400/40">
            <ImagePlus className="h-5 w-5 text-gold-300" />
            <span className="min-w-0 flex-1 truncate">{shot ? "Screenshot ready" : e?.hasProof ? "Screenshot on file" : "Choose a screenshot"}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(x) => void pick(x.target.files?.[0])} />
          </label>
          {shot && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot} alt="Screenshot preview" className="mt-2 max-h-48 rounded-xl border border-hairline object-contain" />
          )}
        </Field>
        <input value={hp} onChange={(x) => setHp(x.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" name="website" />
        <label className="flex items-start gap-2 text-xs leading-relaxed text-content-muted">
          <input type="checkbox" checked={agree} onChange={(x) => setAgree(x.target.checked)} className="mt-0.5" required />
          <span>The details are mine and correct, I have one entry only, and I accept the giveaway rules below and Bungee&apos;s terms.</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-gold h-11 px-6 text-sm" disabled={!lessonsDone || locked || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {e ? "Update my entry" : "Submit my entry"}
          </button>
          {msg && <span className={cn("text-sm", msg.ok ? "text-mint-300" : "text-red-400")}>{msg.text}</span>}
        </div>
      </fieldset>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold text-content">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-content-subtle">{hint}</span>}
    </div>
  );
}
