"use client";

/**
 * The static and sidebar pieces of the redesigned /news page.
 *
 * Everything here renders REAL data or nothing. The page used to be a header
 * and a feed; the redesign adds a hero, discovery sidebar, research and XYZ AI
 * sections, and each one is fed by something that already exists:
 *
 * - source count: `NEWS_SOURCES` (the feeds we actually aggregate)
 * - refresh cadence: `NEWS_REVALIDATE` (the real feed cache window)
 * - trending topics: counted from the stories currently loaded, never invented
 * - research: `/api/research` (public, CDN-cached, bodies already stripped)
 * - newsletter: `/api/subscribe`, success shown only on a 2xx
 * - community: the official links in `site.ts`
 *
 * There is deliberately no market-price widget and no events list: /news has no
 * events source, and a list we cannot keep current would show expired events as
 * upcoming. `news-redesign.test.ts` pins both absences.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Flame, Loader2, Mail, Sparkles, Users } from "lucide-react";
import { TelegramIcon, XIcon, YouTubeIcon, LinkedInIcon } from "@/components/BrandIcons";
import { XYZ_AI_OPEN_EVENT } from "@/components/XyzAiWidget";
import { RobotIcon } from "@/components/RobotIcon";
import { NEWS_SOURCES } from "@modules/news/lib/news-sources";
import type { NewsItem } from "@/lib/news";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const openXyzAi = () => window.dispatchEvent(new Event(XYZ_AI_OPEN_EVENT));

/** Section header shared by every block on the page, so they all line up. */
export function SectionHead({ icon, title, action, id }: { icon?: React.ReactNode; title: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-content sm:text-lg">
        {icon && <span className="text-gold-400">{icon}</span>}
        {title}
      </h2>
      {action}
    </div>
  );
}

/**
 * Left half of the hero. Server-rendered and visible without JavaScript: the
 * old `PageHeader` shipped its <h1> at opacity 0 until framer-motion hydrated
 * (audit SEO6). The entrance here is the CSS `hero-rise` pattern instead.
 */
export function NewsHeroIntro({ onExplore }: { onExplore: () => void }) {
  const facts = [
    { k: String(NEWS_SOURCES.length), v: "Trusted sources" },
    { k: "2 min", v: "Feed refresh" },
    { k: "AI", v: "Summaries on every story" },
  ];
  return (
    <div className="relative flex min-w-0 flex-col justify-center gap-5 py-2 lg:py-6">
      <span className="hero-rise inline-flex w-fit items-center gap-2 rounded-full border border-gold-500/25 bg-gold-500/[0.07] px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-gold-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400/70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold-400" />
        </span>
        Live Web3 intelligence
      </span>
      <h1 className="hero-rise font-display text-[44px] font-bold leading-[0.98] tracking-[-0.04em] text-content sm:text-6xl xl:text-[68px]">
        <span>Web3 </span>
        <span className="text-shine">News</span>
      </h1>
      <p className="hero-rise max-w-[34rem] text-[16px] leading-relaxed text-content-muted sm:text-[17px]">
        The signal behind the noise. Real-time crypto news, research, and insights that move Web3 forward.
      </p>
      <div className="hero-rise flex flex-wrap gap-3">
        <button type="button" onClick={onExplore} className="btn-gold px-5 py-2.5 text-sm">
          Explore News <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={openXyzAi} className="btn-ghost px-5 py-2.5 text-sm">
          <RobotIcon className="h-4 w-4" /> Open XYZ AI
        </button>
      </div>
      <dl className="hero-rise mt-1 grid max-w-[34rem] grid-cols-3 gap-2 border-t border-hairline pt-5">
        {facts.map((f) => (
          <div key={f.v} className="min-w-0">
            <dt className="sr-only">{f.v}</dt>
            <dd className="font-mono text-lg font-semibold tabular-nums text-content">{f.k}</dd>
            <dd className="text-[12px] leading-snug text-content-subtle">{f.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * A restrained gold network behind the hero: a handful of hairlines,
 * static, drawn once. No animation loop, no blur orbs.
 */
export function HeroNetwork() {
  const nodes: [number, number][] = [[8, 22], [22, 70], [36, 34], [52, 82], [64, 18], [78, 56], [92, 30], [96, 84]];
  const links: [number, number][] = [[0, 2], [1, 2], [2, 4], [1, 3], [3, 5], [4, 6], [5, 6], [5, 7], [2, 5]];
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.55]" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="news-net" x1="0" x2="1">
          <stop offset="0" stopColor="#e2a72f" stopOpacity="0" />
          <stop offset="0.5" stopColor="#e2a72f" stopOpacity="0.35" />
          <stop offset="1" stopColor="#e2a72f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {links.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="url(#news-net)" strokeWidth="0.15" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/** Topics counted from the stories actually loaded. */
export function TrendingTopics({ items, active, onPick }: { items: NewsItem[]; active: string; onPick: (c: string) => void }) {
  const top = useMemo(() => {
    const n = new Map<string, number>();
    for (const i of items) for (const c of i.categories) n.set(c, (n.get(c) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [items]);
  if (!top.length) return null;
  return (
    <section className="surface rounded-3xl p-5" aria-labelledby="news-trending">
      <SectionHead id="news-trending" icon={<Flame className="h-4 w-4" />} title="Trending topics" />
      <ol className="grid gap-1">
        {top.map(([c, n], i) => (
          <li key={c}>
            <button
              type="button"
              onClick={() => onPick(c)}
              aria-pressed={active === c}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2",
                active === c && "bg-gold-500/10"
              )}
            >
              <span className="w-5 font-mono text-[12px] tabular-nums text-content-subtle">{i + 1}</span>
              <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", active === c ? "text-gold-300" : "text-content")}>{c}</span>
              <span className="font-mono text-[12px] tabular-nums text-content-subtle">{n}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12px] text-content-subtle">Story counts across the {items.length} stories loaded right now.</p>
    </section>
  );
}

type Post = { id: string; slug: string; title: string; excerpt: string; cover: string | null; category: string; premium: boolean; readMinutes?: number };

/**
 * XYZ Crypto's own research, from the public list endpoint. Fetched on the
 * client because /news is ISR and must not read the DB at build time; the
 * endpoint is `public, s-maxage=60`, so this is a CDN hit for almost everyone.
 */
export function FeaturedResearch() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/research?pageSize=3")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (alive) setPosts(Array.isArray(j?.posts) ? j.posts : []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  if (failed || (posts && !posts.length)) return null;
  return (
    <section aria-labelledby="news-research">
      <SectionHead
        id="news-research"
        icon={<BookOpen className="h-4 w-4" />}
        title="Featured research"
        action={<Link href="/research" className="inline-flex items-center gap-1 text-[13px] font-semibold text-gold-300 hover:text-gold-200">All research <ArrowRight className="h-3.5 w-3.5" /></Link>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {(posts ?? Array.from({ length: 3 }, () => null)).map((p, i) =>
          p ? (
            <Link key={p.id} href={`/research/${p.slug}`} className="surface surface-hover group flex flex-col overflow-hidden rounded-2xl">
              <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] group-active:scale-[1.04]" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-gold-500/25 via-ink-900 to-ink-950" />
                )}
                {p.premium && (
                  <span className="absolute left-3 top-3 rounded-full bg-gradient-to-br from-gold-200 to-gold-500 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">Premium</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold-400">{p.category}</span>
                <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-content group-hover:text-gold-200">{p.title}</h3>
                <p className="line-clamp-2 text-[13px] leading-relaxed text-content-muted">{p.excerpt}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[12px] font-semibold text-gold-300">
                  Read report{p.readMinutes ? <span className="font-normal text-content-subtle">· {p.readMinutes} min</span> : null}
                </span>
              </div>
            </Link>
          ) : (
            <div key={i} className="shimmer h-64 rounded-2xl bg-surface-2" />
          )
        )}
      </div>
    </section>
  );
}

/** XYZ AI band. Only advertises what exists: story summaries, "why this matters", and the assistant. */
export function XyzAiBand() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-gold-500/25 bg-surface p-6 sm:p-8" aria-labelledby="news-ai">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold-500/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="news-ai" className="font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">Go beyond the headlines.</h2>
            <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-content-muted">
              Understand the story, explore the narrative, and discover the bigger picture with XYZ AI. Summaries and context on every story, and an assistant for the questions that follow.
            </p>
          </div>
        </div>
        <button type="button" onClick={openXyzAi} className="btn-gold shrink-0 px-5 py-2.5 text-sm">
          Explore XYZ AI <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

/** Newsletter capture. Success is shown only when `/api/subscribe` returns 2xx. */
export function NewsletterPanel() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setState("error"); setMsg("Enter a valid email address."); return; }
    setState("loading"); setMsg("");
    try {
      const res = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), source: "news" }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setState("error"); setMsg(j?.error || "Could not subscribe. Please try again."); return; }
      setState("done");
    } catch {
      setState("error"); setMsg("Network error. Please try again.");
    }
  }
  return (
    <section className="surface rounded-3xl p-5" aria-labelledby="news-letter">
      <SectionHead id="news-letter" icon={<Mail className="h-4 w-4" />} title="Newsletter" />
      <p className="-mt-2 mb-4 text-[13px] leading-relaxed text-content-muted">The day&apos;s top Web3 news and research, in your inbox.</p>
      {state === "done" ? (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2.5 text-[13px] font-medium text-gold-200">
          <Check className="h-4 w-4" strokeWidth={3} /> You&apos;re subscribed.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="flex gap-2">
          <label htmlFor="news-letter-email" className="sr-only">Email address</label>
          <input
            id="news-letter-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
            placeholder="you@email.com"
            aria-invalid={state === "error"}
            aria-describedby={state === "error" ? "news-letter-err" : undefined}
            className="min-w-0 flex-1 rounded-xl border border-hairline bg-surface-2 px-3 py-2.5 text-sm text-content placeholder:text-content-subtle focus:border-gold-500/50 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
          />
          <button type="submit" disabled={state === "loading"} aria-label="Subscribe" className="btn-gold shrink-0 px-3.5 py-2.5 text-sm disabled:opacity-60">
            {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      )}
      {state === "error" && <p id="news-letter-err" role="alert" className="mt-2 text-[12px] text-amber-300">{msg}</p>}
    </section>
  );
}

/** The official community links from `site.ts`. No member counts. */
export function CommunityPanel() {
  const links = [
    { href: site.socials.telegram, label: "Telegram", Icon: TelegramIcon },
    { href: site.socials.x, label: "X", Icon: XIcon },
    { href: site.socials.youtube, label: "YouTube", Icon: YouTubeIcon },
    { href: site.socials.linkedin, label: "LinkedIn", Icon: LinkedInIcon },
  ];
  return (
    <section className="surface rounded-3xl p-5" aria-labelledby="news-community">
      <SectionHead id="news-community" icon={<Users className="h-4 w-4" />} title="Join the community" />
      <p className="-mt-2 mb-4 text-[13px] leading-relaxed text-content-muted">Discuss the news with traders, builders and researchers.</p>
      <div className="flex items-center gap-2">
        {links.map(({ href, label, Icon }) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`XYZ Crypto on ${label}`} className="grid h-10 w-10 place-items-center rounded-xl border border-hairline bg-surface-2 text-content-muted transition-colors hover:border-gold-500/40 hover:text-gold-300">
            <Icon className="h-4 w-4" />
          </a>
        ))}
        <Link href="/community" className="btn-gold ml-auto whitespace-nowrap px-4 py-2 text-[13px]">Open chat</Link>
      </div>
    </section>
  );
}
