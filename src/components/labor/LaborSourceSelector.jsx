import React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { SOURCE_LABELS } from "@/domain/labor/sources";

export default function LaborSourceSelector({ options = [], selectedSource, acknowledged, onSelect, onAcknowledge }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => {
          const selected = selectedSource === option.sourceType;
          const ready = option.productionAllowed && option.verificationStatus === "verified";
          return (
            <button
              key={option.sourceType}
              type="button"
              onClick={() => option.available && onSelect?.(option)}
              disabled={!option.available}
              className={`rounded-xl border p-3 text-left transition-colors ${
                selected
                  ? "border-blue-600 bg-blue-50 dark:border-orange-500 dark:bg-orange-500/10"
                  : option.available
                    ? "border-border bg-card hover:border-blue-500/60 dark:hover:border-orange-500/60"
                    : "cursor-not-allowed border-dashed border-border bg-muted/40 opacity-80"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{option.label || SOURCE_LABELS[option.sourceType]}</p>
                {ready ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-amber-500" />}
              </div>
              <p className="mt-2 text-lg font-black">{option.mh == null ? "—" : `${option.mh} MH`}</p>
              {option.sampleSize != null && option.sourceType === "company_history" ? (
                <p className="text-xs text-muted-foreground">n={option.sampleSize} · confidence {Math.round((option.confidenceLevel || 0) * 100)}%</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">{option.warning}</p>
            </button>
          );
        })}
      </div>
      {selectedSource === "experimental" || selectedSource === "estim8r_standard" ? (
        <label className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <input type="checkbox" checked={Boolean(acknowledged)} onChange={(e) => onAcknowledge?.(e.target.checked)} className="mt-1" />
          <span>I acknowledge this experimental / unverified labor is not a production rate.</span>
        </label>
      ) : null}
    </div>
  );
}
