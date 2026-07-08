"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, ExternalLink, Loader2, Newspaper } from "lucide-react";
import { RobotIcon } from "./RobotIcon";
import { compactUsd, pct } from "@/lib/markets";
import { cn } from "@/lib/utils";

type Protocol = {
  type: string;
  slug: string;
  name: string;
  logo: string | null;
  metric: "volume" | "fees";
  total24h: number;
  total7d: number;
  total30d: number;
  totalAllTime: number;
  change1d: number;
  change7d: number;
  change30d: number;
  chains: string[];
  description: string;
  url: string | null;
  chart: number[];
  live: boolean;
  ts?: number;
};

type NewsItem = { title: string; url: string; source: string; publishedAt: number };

const KIND: Record<string, string> = { derivatives: "Perp DEX", dexs: "DEX", fees: "Fee Protocol" };

export function ProtocolDetailClient({ type, slug }: { type: string; slug: string }) {
  const { data: session } = useSession();
  const [p, setP] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/markets/protocol/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const j = (await r.json()) as Protocol;
        if (stop) return;
        if (j && j.live) {
          setP(j);
          setFailed(false);
        } else if (!p) {
          setFailed(true);
        }
      } catch {
        if (!stop && !p) setFailed(true);
      } finally {
        if (!stop) setLoading(false);
      }
    };
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 120_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, slug]);

  if (loading && !p) return <ProtocolSkeleton />;
  if (failed && !p)
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-amber-300">Couldn&apos;t load this protocol.</p>
        <Link href="/markets" className="mt-3 inline-block text-sm text-gold-200 hover:underline">← Back to Markets</Link>
      </div>
    );
  if (!p) return <ProtocolSkeleton />;

  const kind = KIND[p.type] ?? "Protocol";
  const metricLabel = p.metric === "fees" ? "Fees" : "Volume";
  const up7 = p.change7d >= 0;

  return (
    <div className="space-y-6">
      <Link href="/markets" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-100">
        <ArrowLeft className="h-4 w-4" /> Markets
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          {p.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logo} alt="" width={44} height={44} className="h-11 w-11 rounded-full ring-1 ring-white/10" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-zinc-50 sm:text-3xl">{p.name}</h1>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">{kind}</span>
            </div>
            <FreshnessPill ts={p.ts} />
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">24h {metricLabel}</p>
          <div className="mono text-3xl font-bold text-zinc-50 sm:text-4xl">{compactUsd(p.total24h)}</div>
          <div className={cn("mono text-sm font-semibold", up7 ? "text-mint-400" : "text-red-400")}>{pct(p.change7d)} (7d)</div>
        </div>
      </div>

      {/* Chart */}
      <div className="surface rounded-2xl p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
          <span>{metricLabel} — recent trend</span>
          <span className="mono">{pct(p.change30d)} (30d)</span>
        </div>
        <TrendChart data={p.chart} up={up7} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`24h ${metricLabel}`} value={compactUsd(p.total24h)} sub={p.change1d ? `${pct(p.change1d)} (24h)` : undefined} />
        <Stat label={`7d ${metricLabel}`} value={compactUsd(p.total7d)} />
        <Stat label={`30d ${metricLabel}`} value={compactUsd(p.total30d)} />
        <Stat label={`All-Time ${metricLabel}`} value={compactUsd(p.totalAllTime)} />
      </div>

      {/* Chains */}
      {p.chains.length > 0 && (
        <div className="surface rounded-2xl p-4 sm:p-5">
          <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">Chains ({p.chains.length})</p>
          <div className="flex flex-wrap gap-2">
            {p.chains.map((c) => (
              <span key={c} className="rounded-full bg-white/5 px-2.5 py-1 text-[12px] text-zinc-300">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* AI take */}
      <AiTake p={p} kind={kind} loggedIn={Boolean(session?.user)} />

      {/* Related news */}
      <RelatedNews name={p.name} />

      {/* About */}
      {p.description && (
        <div className="surface rounded-2xl p-4 sm:p-5">
          <p className="mb-2 text-sm font-semibold text-zinc-100">About {p.name}</p>
          <p className="text-[13px] leading-relaxed text-zinc-400">{p.description}</p>
          {p.url && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[12px] text-gold-200 hover:underline">
              Official site <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-zinc-600">Data from DeFiLlama. Not financial advice.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface rounded-xl p-3">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mono mt-1 text-sm font-semibold text-zinc-100">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-500">{sub}</p>}
    </div>
  );
}

function TrendChart({ data, up }: { data: number[]; up: boolean }) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return null;
    const W = 600;
    const H = 140;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const step = W / (data.length - 1);
    const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / span) * H).toFixed(1)}`);
    return { d: `M ${pts.join(" L ")}`, W, H, area: `M 0,${H} L ${pts.join(" L ")} L ${W},${H} Z` };
  }, [data]);

  if (!path) return <div className="flex h-[140px] items-center justify-center text-xs text-zinc-600">Chart unavailable</div>;
  const color = up ? "var(--chart-mint)" : "#ef4444";
  return (
    <svg viewBox={`0 0 ${path.W} ${path.H}`} preserveAspectRatio="none" className="h-32 w-full sm:h-40" role="img" aria-label="recent trend chart">
      <defs>
        <linearGradient id="protoArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#protoArea)" />
      <path d={path.d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function FreshnessPill({ ts }: { ts?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return null;
  const s = Math.max(0, Math.round((now - ts) / 1000));
  const label = s < 3 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
      <span className={cn("h-1.5 w-1.5 rounded-full", s < 600 ? "bg-mint-400" : "bg-amber-400")} />
      Updated {label} · USD
    </span>
  );
}

function AiTake({ p, kind, loggedIn }: { p: Protocol; kind: string; loggedIn: boolean }) {
  const [state, setState] = useState<{ loading: boolean; text: string | null; err: string | null }>({ loading: false, text: null, err: null });

  const run = useCallback(async () => {
    if (!loggedIn) {
      setState({ loading: false, text: null, err: "Log in to use XYZ AI." });
      return;
    }
    if (state.text || state.loading) return;
    setState({ loading: true, text: null, err: null });
    try {
      const res = await fetch("/api/ai/protocol-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name, kind, metric: p.metric, total24h: p.total24h, total7d: p.total7d, change7d: p.change7d, chains: p.chains }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ loading: false, text: null, err: j.error || "Couldn't generate." });
        return;
      }
      setState({ loading: false, text: j.text, err: null });
    } catch {
      setState({ loading: false, text: null, err: "Network error." });
    }
  }, [p, kind, loggedIn, state.text, state.loading]);

  return (
    <div className="rounded-2xl border border-gold-500/20 bg-gold-500/[0.05] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-200">
          <RobotIcon className="h-4 w-4" /> XYZ AI take
        </p>
        {!state.text && (
          <button onClick={run} disabled={state.loading} className="inline-flex items-center gap-1.5 rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-200 transition-colors hover:bg-gold-500/20 disabled:opacity-50">
            {state.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RobotIcon className="h-3.5 w-3.5" />} Generate
          </button>
        )}
      </div>
      {state.text && <p className="mt-2 text-[13px] leading-relaxed text-zinc-200">{state.text}</p>}
      {state.err && <p className="mt-2 text-[11px] text-amber-300">{state.err}</p>}
      {!state.text && !state.err && <p className="mt-1 text-[11px] text-zinc-500">A neutral, education-only read on {p.name} from the live numbers. Not financial advice.</p>}
    </div>
  );
}

function RelatedNews({ name }: { name: string }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let stop = false;
    fetch(`/api/news?q=${encodeURIComponent(name)}&pageSize=6`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!stop) setItems(Array.isArray(j.items) ? j.items : []);
      })
      .catch(() => {})
      .finally(() => !stop && setLoading(false));
    return () => {
      stop = true;
    };
  }, [name]);

  if (loading || !items.length) return null;
  return (
    <div className="surface rounded-2xl p-4 sm:p-5">
      <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
        <Newspaper className="h-4 w-4 text-gold-300" /> {name} in the news
      </p>
      <ul className="divide-y divide-white/5">
        {items.map((n) => (
          <li key={n.url}>
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 py-2.5 transition-colors hover:bg-white/[0.03]">
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[13px] text-zinc-200">{n.title}</span>
                <span className="mt-0.5 block text-[11px] text-zinc-500">{n.source}</span>
              </span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProtocolSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
      <div className="h-12 w-64 animate-pulse rounded bg-white/[0.06]" />
      <div className="h-40 w-full animate-pulse rounded-2xl bg-white/[0.06]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.06]" />
        ))}
      </div>
    </div>
  );
}
