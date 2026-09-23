import React from "react";
import SourceBadges from "@/components/labor/SourceBadges";
import { flagLabel, MARKET_COMPARE_WHY, NO_VERIFIED_MARKET_REFERENCE } from "@/domain/labor/marketCompare";

function money(value) {
  return `$${(Number(value) || 0).toFixed(2)}`;
}

function hours(value) {
  return `${(Number(value) || 0).toFixed(2)} hrs`;
}

function Flag({ flag }) {
  const label = flagLabel(flag);
  if (!label) return null;
  const tone = flag === "in_line"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
    : "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  return <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>;
}

export default function LaborMarketCompare({ comparison }) {
  if (!comparison) return null;
  const empty = comparison.lineCount === 0;

  return (
    <section data-testid="labor-market-compare" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">This estimate vs market reference</h2>
          <p className="mt-1 text-xs text-muted-foreground">{MARKET_COMPARE_WHY}</p>
        </div>
        {comparison.hasReference ? <Flag flag={comparison.flag} /> : null}
      </div>

      {empty ? (
        <p className="mt-4 text-sm text-muted-foreground">Add an estimate line to compare hours and labor dollars.</p>
      ) : !comparison.hasReference ? (
        <div className="mt-4 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-semibold">{NO_VERIFIED_MARKET_REFERENCE}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {comparison.emptyLineCount ? "Some lines have no labor pick. " : ""}
            {comparison.unmatchedLineCount ? "Some picks have no library match. " : ""}
            Imported Estim8r hours stay experimental. This is not a national average.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">This estimate</p>
            <p className="mt-1 text-lg font-black">{hours(comparison.estimateHours)}</p>
            <p className="text-sm font-semibold">{money(comparison.estimateLabor)} labor</p>
            {comparison.referencedLineCount < comparison.lineCount ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Compared hours: {hours(comparison.comparableHours)} · {money(comparison.comparableLabor)} on {comparison.referencedLineCount} referenced line{comparison.referencedLineCount === 1 ? "" : "s"}.
              </p>
            ) : null}
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Verified market range</p>
            <p className="mt-1 text-lg font-black">
              {hours(comparison.reference.hoursLow)}
              {comparison.reference.hoursLow !== comparison.reference.hoursHigh ? ` – ${hours(comparison.reference.hoursHigh)}` : ""}
            </p>
            <p className="text-sm font-semibold">
              {money(comparison.reference.laborLow)}
              {comparison.reference.laborLow !== comparison.reference.laborHigh ? ` – ${money(comparison.reference.laborHigh)}` : ""}
              <span className="ml-1 text-xs font-normal text-muted-foreground">at this crew rate</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Rollup of verified published MH × quantity. Dollars use this estimate’s wage, not a published dollar book.</p>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{comparison.message}</p>
      {comparison.hasReference ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Flag flag={comparison.laborFlag} />
          {comparison.laborFlag && comparison.laborFlag !== "none" ? (
            <span className="text-[11px] text-muted-foreground">Labor dollars</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function LineMarketCompare({ comparison }) {
  if (!comparison) return null;
  return (
    <div data-testid="line-market-compare" className="rounded-lg border border-border/70 bg-muted/20 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <SourceBadges badges={comparison.source.badges} />
        {comparison.source.sourceName ? (
          <span className="text-[11px] text-muted-foreground">{comparison.source.sourceName}</span>
        ) : null}
        {comparison.hasReference ? <Flag flag={comparison.flag} /> : null}
      </div>
      {comparison.hasReference ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Market: {comparison.reference.sourceName} {comparison.reference.edition}
          {comparison.reference.sourceReference ? ` · ${comparison.reference.sourceReference}` : ""}
          {" · "}
          {comparison.reference.mhPerUnit} MH
          {comparison.reference.lowMhPerUnit !== comparison.reference.highMhPerUnit
            ? ` (${comparison.reference.lowMhPerUnit}–${comparison.reference.highMhPerUnit})`
            : ""}
          {" · "}
          {hours(comparison.reference.hours)}
          {" / "}
          {money(comparison.reference.labor)} at this crew rate
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">{NO_VERIFIED_MARKET_REFERENCE}</p>
      )}
      {comparison.references.length > 1 ? (
        <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {comparison.references.map((row) => (
            <div key={row.id} className="rounded-md border border-border bg-background px-2 py-1 text-[11px]">
              <SourceBadges badges={["REFERENCE"]} />
              <span className="ml-1 font-semibold">{row.sourceName} {row.edition}</span>
              <span className="ml-1 text-muted-foreground">{row.mhPerUnit} MH · {hours(row.hours)} · {money(row.labor)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
