import React from "react";
import { TrendingUp } from "lucide-react";

export default function Production() {
  return (
    <div className="py-4 sm:py-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Company Intelligence</p>
      <h1 className="text-3xl font-black text-foreground">Production Calibration</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">Approved field production will calculate your company’s actual MH/unit, averages, median, quartiles, sample size and confidence without changing the published master reference.</p>
      <div className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-sm">
        <TrendingUp className="h-9 w-9 text-blue-600 dark:text-orange-500" />
        <h2 className="mt-4 text-xl font-bold text-foreground">Company labor stays company-specific</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Production records are protected by organization RLS. As completed work is entered, Estim8r can compare estimated labor against actual performance and build a private labor book unique to each contractor.</p>
      </div>
    </div>
  );
}
