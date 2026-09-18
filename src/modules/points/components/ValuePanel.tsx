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
  shareDomain,
  allocationScenarios,
  fdvScenarios,
  bare = false,
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
  /** Host of the programme's own site, for the share card's logo. Absent simply
   *  means no logo, never someone else's. */
  shareDomain?: string;
  /** Quick-picks from the registry, shown under the field each one sets.
   *  These existed in the /tools calculator and were lost in the move - they
   *  are the difference between "type a number" and "compare the scenarios the
   *  programme actually published". */
  allocationScenarios?: { label: string; pct: number }[];
  fdvScenarios?: number[];
  /** Rendered inside a ProgramSection, which already supplies the card and the
   *  heading. Without this the page would show a card inside a card and repeat
   *  the programme's name twice. */
  bare?: boolean;
}) {
  // Naming the anchor matters more than it looks. "Linked" on its own is a
  // toggle with no referent: a reader cannot tell whether the number came from
  // live peers or from a hand-maintained scenario, and those deserve very
  // different amounts of trust.
  const anchorLabel = anchor === "comps" ? "from comparables" : "from programme";
  const Wrapper = bare ? "div" : "section";
  return (
    <Wrapper className={bare ? "" : "surface rounded-3xl p-5 sm:p-8"}>
      {!bare && (
        <>
          <h2 className="font-display text-xl font-semibold tracking-tight text-content sm:text-2xl">
            Your <span className="text-shine">share</span>, in dollars
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-content-muted">
            Points to share of the pool, pool to tokens, tokens to a price. Every input is yours to change.
          </p>
        </>
      )}

      {/* The share card leads with this, so it is the first field rather than
          an afterthought buried next to the button. Empty means "use the
          programme's name", which is why the placeholder shows it rather than
          pre-filling the input - a pre-filled value someone has to clear before
          typing their own is a worse default than an empty box. */}
      <label className={cn(bare ? "block" : "mt-6 block")}>
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
        <div>
          <CalcField
            label="Allocation to points"
            value={form.allocPct}
            onChange={(v) => set("allocPct", v)}
            suffix="% of supply"
          />
          {allocationScenarios && allocationScenarios.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allocationScenarios.map((sc) => (
                <ScenarioChip
                  key={sc.label}
                  active={Number(form.allocPct) === sc.pct}
                  onClick={() => set("allocPct", String(sc.pct))}
                >
                  {sc.label}
                </ScenarioChip>
              ))}
            </div>
          )}
        </div>
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
          {fdvScenarios && fdvScenarios.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fdvScenarios.map((v) => (
                <ScenarioChip
                  key={v}
                  active={Math.abs(Number(form.fdv) - v) < 1}
                  onClick={() => {
                    // A scenario is a manual choice, so it breaks the live
                    // anchor - otherwise the next render would silently undo
                    // the click and the button would look broken.
                    if (linked) set("fdvLinked", false);
                    set("fdv", String(v));
                  }}
                >
                  {usdCompact(v)} FDV
                </ScenarioChip>
              ))}
            </div>
          )}
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
            // ⚠️ This was hard-coded `""`, which is why no share card has ever
            // carried a venue logo. The card builds its image from
            // `favicon(domain)` and renders nothing when the domain is blank.
            //
            // Derived from the registry's own `links.website` rather than a
            // lookup table keyed by name, so a programme added tomorrow gets its
            // logo with no second place to remember to edit.
            domain: shareDomain ?? "",
            sharePct: value.sharePct,
            tokens: value.tokens,
            usd: value.grossUsd,
            fdv: Number(form.fdv) || 0,
          })}
        />
      </div>
    </Wrapper>
  );
}

/** The quick-pick pill used by both scenario rows. */
function ScenarioChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-gold-500/40 bg-gold-500/15 text-gold-200"
          : "border-hairline text-content-subtle hover:border-gold-500/30 hover:text-content-muted active:border-gold-500/30"
      )}
    >
      {children}
    </button>
  );
}
