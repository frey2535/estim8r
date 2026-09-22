import React, { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { buildSupplyQuotePdf, supplyQuoteExcelFileName, supplyQuoteToExcel } from "@/domain/takeoff/supplyQuote";
import { downloadBlob } from "@/domain/estimate/projectDocuments";

export default function EstimateSupplyQuote({ quote, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [status, setStatus] = useState("");

  function downloadExcel() {
    downloadBlob(
      new Blob([supplyQuoteToExcel(quote)], { type: "application/vnd.ms-excel" }),
      supplyQuoteExcelFileName(quote),
    );
    setStatus(quote.rows.length
      ? `Downloaded ${supplyQuoteExcelFileName(quote)} for the supply house.`
      : "No estimate lines to quote yet.");
  }

  function downloadPdf() {
    const { doc, fileName } = buildSupplyQuotePdf(quote);
    downloadBlob(doc.output("blob"), fileName);
    setStatus(quote.rows.length
      ? `Downloaded ${fileName} for the supply house.`
      : "No estimate lines to quote yet.");
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <CollapsibleTrigger className="flex min-w-0 items-center gap-1.5 text-left">
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          <div className="min-w-0">
            <h3 className="text-sm font-bold">Supply house quote</h3>
            <p className="text-[11px] text-muted-foreground">
              Live from Estimate Lines. {quote.totals.items} item{quote.totals.items === 1 ? "" : "s"} · qty {quote.totals.quantity}
            </p>
          </div>
        </CollapsibleTrigger>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={downloadExcel} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted">
            <Download className="h-3 w-3" /> Quote Excel
          </button>
          <button type="button" onClick={downloadPdf} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted">
            <Download className="h-3 w-3" /> Quote PDF
          </button>
        </div>
      </div>
      <CollapsibleContent>
        <div className="border-t border-border px-3 pb-3 pt-2">
          <p className="mb-2 text-[11px] text-muted-foreground">
            Device, model if you entered one, description, and quantity. Models are never invented.
          </p>
          {quote.rows.length ? (
            <div className="max-h-64 overflow-auto rounded-md border border-border">
              <table className="w-full min-w-[28rem] text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5">Device / equipment</th>
                    <th className="px-2 py-1.5">Model</th>
                    <th className="px-2 py-1.5">Description</th>
                    <th className="px-2 py-1.5 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.rows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-1.5">{row.device || "—"}</td>
                      <td className="px-2 py-1.5">{row.model || "—"}</td>
                      <td className="px-2 py-1.5">{row.description}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{row.quantity}{row.unit ? ` ${row.unit}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
              Lines show up here as you enter Type, a labor pick, or a description. No separate re-entry.
            </p>
          )}
          {status ? <p className="mt-2 text-[11px] text-muted-foreground" role="status">{status}</p> : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
