import { FileText, BarChart3, ShieldCheck, Star } from "lucide-react";

interface ResearchHeroStatsProps {
  totalReports: number;
  premiumCount?: number;
}

export function ResearchHeroStats({ totalReports }: ResearchHeroStatsProps) {
  const displayCount = totalReports > 0 ? `${totalReports}+` : "13+";

  const metrics = [
    {
      icon: FileText,
      title: `${displayCount} Research Reports`,
      subtitle: "Institutional-grade analysis",
      tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20 dark:border-amber-400/20",
    },
    {
      icon: BarChart3,
      title: "DeFi • AI • Restaking",
      subtitle: "Covering key narratives",
      tone: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20 dark:border-indigo-400/20",
    },
    {
      icon: ShieldCheck,
      title: "100% Unbiased",
      subtitle: "Data-driven & independent",
      tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 dark:border-emerald-400/20",
    },
    {
      icon: Star,
      title: "Pro Analyst Insights",
      subtitle: "Actionable deep dives",
      tone: "text-amber-700 dark:text-gold-400 bg-gold-500/10 border-amber-600/20 dark:border-gold-400/20",
    },
  ];

  return (
    <div className="neu-convex relative overflow-hidden rounded-3xl p-5 sm:p-6 lg:p-7 shadow-neu-lg border border-white/80 dark:border-white/[0.05]">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              className={`flex items-center gap-4 ${
                idx > 0
                  ? "lg:border-l lg:border-zinc-300/80 dark:lg:border-white/[0.06] lg:pl-6 lg:shadow-[-1px_0_0_rgba(255,255,255,0.8)] dark:lg:shadow-[-1px_0_0_rgba(0,0,0,0.7)]"
                  : ""
              }`}
            >
              {/* Tactile debossed socket */}
              <div
                className={`neu-inset flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl p-3 border shadow-neu-inset-sm transition-transform duration-200 hover:scale-105 active:scale-105 ${m.tone}`}
              >
                <Icon className="h-6 w-6 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm sm:text-[15px] font-bold text-zinc-900 dark:text-white tracking-tight">
                  {m.title}
                </h3>
                <p className="truncate text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {m.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
