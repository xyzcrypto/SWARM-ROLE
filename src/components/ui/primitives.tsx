import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-container px-5 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("relative py-14 sm:py-20 lg:py-24", className)}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="eyebrow text-gold-200">
      <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
      <span className="mono text-[11px] uppercase tracking-[0.18em]">{children}</span>
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl text-left",
        className
      )}
    >
      {eyebrow && (
        <div className={cn("mb-5", align === "center" && "flex justify-center")}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      )}
      <h2 className="font-display text-display-md font-semibold tracking-tight text-zinc-50">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-zinc-400">{subtitle}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "mint" | "sky" | "violet" | "zinc";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/5 text-zinc-300 ring-white/10",
    gold: "bg-gold-500/12 text-gold-200 ring-gold-500/30",
    mint: "bg-mint-500/12 text-mint-300 ring-mint-500/30",
    sky: "bg-sky-500/12 text-sky-300 ring-sky-500/30",
    violet: "bg-violet-500/12 text-violet-300 ring-violet-500/30",
    zinc: "bg-zinc-500/12 text-zinc-300 ring-zinc-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
