import React, { useState } from "react";
import { parseSupplierPriceCsv, supplierComparison } from "@/domain/estimate/supplierPriceIntelligence";

export default function SupplierPriceIntelligence({ lines = [], books = [], onChange, onApplyPrice }) {
  const [supplier, setSupplier] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("");

  async function importFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseSupplierPriceCsv(text, { supplier, effectiveDate, reference });
      onChange?.([{ id: crypto.randomUUID(), supplier, effectiveDate, reference, fileName: file.name, importedAt: new Date().toISOString(), rows }, ...books]);
      setStatus("Imported " + rows.length + " supplier price rows from " + file.name + ".");
    } catch (error) { setStatus(error.message || "Could not import supplier prices."); }
  }

  const pricedLines = lines.filter((line) => line.description || line.model);
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-orange-500">Supplier Intelligence</p>
      <h2 className="mt-1 text-xl font-black">Supplier price books &amp; quotes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Import supplier CSV exports without an API. Estim8r matches model/SKU first, then description, and keeps the source visible before any price is applied.</p>
    </div>
    <div className="mt-4 grid gap-2 md:grid-cols-4">
      <Input label="Supplier" value={supplier} set={setSupplier} placeholder="Supplier name" />
      <Input label="Effective date" type="date" value={effectiveDate} set={setEffectiveDate} />
      <Input label="Quote / reference" value={reference} set={setReference} placeholder="Quote #" />
      <label className="min-w-0"><span className="mb-1 block text-[11px] font-bold text-muted-foreground">CSV price file</span><input type="file" accept=".csv,text/csv" onChange={(e) => importFile(e.target.files?.[0])} className="block w-full text-xs" /></label>
    </div>
    {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
    <div className="mt-4 space-y-3">
      {pricedLines.map((line) => {
        const matches = supplierComparison(line, books).slice(0, 4);
        if (!matches.length) return null;
        return <div key={line.id} className="rounded-xl border border-border p-3">
          <div className="font-bold">{line.description || line.model}</div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">{matches.map((match) => <div key={match.id + match.supplier} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-2 text-xs">
            <div><strong>{match.supplier || "Supplier"}</strong> · {money(match.unitCost)} / {match.unit || line.unit || "unit"}<div className="text-[10px] text-muted-foreground">{match.model || match.description} · match {match.matchScore}% · {match.effectiveDate || "undated"}</div></div>
            <button type="button" onClick={() => onApplyPrice?.(line, match)} className="rounded-md border border-border px-2 py-1 font-bold hover:bg-muted">Use price</button>
          </div>)}</div>
        </div>;
      })}
    </div>
  </section>;
}
function Input({ label, value, set, type = "text", placeholder = "" }) { return <label><span className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm" /></label>; }
function money(value) { return "$" + Number(value || 0).toFixed(2); }
