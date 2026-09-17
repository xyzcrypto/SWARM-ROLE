"use client";

import { Unlink, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalcField, ResultTile } from "@modules/tools/components/CalcField";
import { SHARE_NAME_MAX, shareName, usdCompact, type CompVenue, type ValueResult } from "@modules/points/lib/points";
import { ShareResultButton } from "./ShareResultButton";

export function ValuePanel({
  form,
  set,
  value,
  target,
  linked,
  anchor,
  anchorFdv,
  programName,
}: {
  form: any;
  set: (k: any, v: any) => void;
  value: ValueResult;
  target: CompVenue | null;
  linked: boolean;
  /** Which source the linked FDV is following, so the field can name it. */
  anchor: "comps" | "program" | "none";
  anchorFdv: number;
  programName: string | null;
}) {
  // Naming the anchor matters more than it looks. "Linked" on its own is a
  // toggle with no referent: a reader cannot tell whether the number came from
  // live peers or from a hand-maintained scenario, and those deserve very
  // different amounts of trust.
  const anchorLabel = anchor === "comps" ? "from comparables" : "from programme";
  return (
    <section className="surface rounded-3xl p-5 sm:p-8">
      <h2 className="font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">
        Your <span className="text-shine">share</span>, in dollars
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-muted">
        Points to share of the pool, pool to tokens, tokens to a price. Every input is yours to change.
      </p>

      {/* The share card leads with this, so it is the first field rather than
          an afterthought buried next to the button. Empty means "use the
          programme's name", which is why the placeholder shows it rather than
          pre-filling the input - a pre-filled value someone has to clear before
          typing their own is a worse default than an empty box. */}
      <label className="mt-6 block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-content-muted">
          Name this calculation
        </span>
        <input
          type="text"
          value={form.label}
          maxLength={SHARE_NAME_MAX}
          onChange={(e) => set("label", e.target.value)}
          placeholder={programName ?? "Your position"}
          className="w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-content outline-none transition-colors placeholder:text-content-subtle focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/20"
        />
        <span className="mt-1 block text-[11px] text-content-subtle">
          Appears on the share card. {form.label.length}/{SHARE_NAME_MAX}
        </span>
      </label>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <CalcField label="Your points" value={form.yourPoints} onChange={(v) => set("yourPoints", v)} />
        <CalcField
          label="Total points in the pool"
          value={form.totalPoints}
          onChange={(v) => set("totalPoints", v)}
          hint={`Your share: ${value.sharePct.toFixed(4)}%`}
        />
        <CalcField
          label="Allocation to points"
          value={form.allocPct}
          onChange={(v) => set("allocPct", v)}
          suffix="% of supply"
        />
        <CalcField label="Total token supply" value={form.supply} onChange={(v) => set("supply", v)} />
        <CalcField
          label="Unlocked at TGE"
          value={form.tgeUnlock}
          onChange={(v) => set("tgeUnlock", v)}
          suffix="%"
          hint="The rest vests. Only this part is sellable on day one."
        />
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">FDV</span>
            {anchorFdv > 0 && (
              <button
                type="button"
                onClick={() => set("fdvLinked", !linked)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                  linked
                    ? "bg-mint-500/15 text-mint-200 hover:bg-mint-500/25"
                    : "text-content-subtle hover:text-content-muted"
                )}
              >
                {linked ? <Link2 className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
                {linked ? anchorLabel : "manual"}
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              value={form.fdv}
              // Typing breaks the link rather than fighting the effect that
              // keeps it in sync - otherwise every keystroke would be undone
              // on the next render and the field would feel broken.
              onChange={(e) => {
                if (linked) set("fdvLinked", false);
                set("fdv", e.target.value);
              }}
              className={cn(
                "w-full rounded-xl border bg-surface-2 px-4 py-3 text-sm text-content outline-none transition-colors focus:ring-2 focus:ring-gold-500/20",
                linked ? "border-mint-500/30" : "border-hairline focus:border-gold-500/50"
              )}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-content-subtle">
              USD
            </span>
          </div>
          <span className="mt-1 block text-[11px] text-content-subtle">
            Implied price: ${value.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 6 })}
            {linked && anchor === "comps" && target ? ` · peers of ${target.name}` : ""}
            {linked && anchor === "program" && programName ? ` · ${programName} scenario` : ""}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ResultTile
          label="Tokens"
          value={value.tokens.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          hint={`${value.sharePct.toFixed(4)}% of the pool`}
        />
        <ResultTile
          label="Liquid at TGE"
          value={usdCompact(value.liquidAtTgeUsd)}
          tone="mint"
          hint="What you could actually sell on day one"
        />
        <ResultTile
          label="Gross, fully vested"
          value={usdCompact(value.grossUsd)}
          tone="gold"
          hint={`${usdCompact(value.lockedUsd)} still locked`}
        />
      </div>

      <div className="mt-5">
        <ShareResultButton
          payload={() => ({
            // The name the reader gave it, else the programme - "Variational",
            // not whichever venue the comparables happened to anchor on.
            //
            // ⚠️ Trimmed to SHARE_NAME_MAX because the share API's zod schema
            // caps `platform` at 40 characters and REJECTS anything longer. A
            // long name would have failed with "Couldn't create the share
            // link" and no indication that the name was the reason.
            platform: shareName(form.label, programName, target?.name),
            domain: "",
            sharePct: value.sharePct,
            tokens: value.tokens,
            usd: value.grossUsd,
            fdv: Number(form.fdv) || 0,
          })}
        />
      </div>
    </section>
  );
}
