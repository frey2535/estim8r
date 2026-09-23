import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import EstimatePdfPreview from "@/components/estimate/EstimatePdfPreview";
import { readCompanyBranding } from "@/domain/estimate/branding";
import { buildEstimatePdf, printEstimatePdf } from "@/domain/estimate/estimatePdf";
import { downloadBlob } from "@/domain/estimate/projectDocuments";

export default function EstimatePdfActions({ estimate }) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function makePdf() {
    return buildEstimatePdf(estimate, readCompanyBranding());
  }

  function downloadPdf() {
    try {
      const { doc, fileName } = makePdf();
      downloadBlob(doc.output("blob"), fileName);
      setError("");
      setStatus(`Saved ${fileName}.`);
    } catch (nextError) {
      setStatus("");
      setError(nextError?.message || "Could not create the estimate PDF.");
    }
  }

  function printPdf() {
    try {
      const { doc } = makePdf();
      printEstimatePdf(doc);
      setError("");
      setStatus("Opened the estimate PDF for printing.");
    } catch (nextError) {
      setStatus("");
      setError(nextError?.message || "Could not print the estimate PDF.");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <EstimatePdfPreview estimate={estimate} />
        <button type="button" data-testid="download-estimate-pdf" onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white dark:bg-orange-500">
          <Download className="h-4 w-4" /> Download PDF
        </button>
        <button type="button" onClick={printPdf} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-muted">
          <Printer className="h-4 w-4" /> Print PDF
        </button>
        <Link to="/settings#estimate-pdf" className="text-sm font-semibold text-blue-600 dark:text-orange-500">
          PDF branding
        </Link>
      </div>
      {status ? <p className="text-sm text-muted-foreground" role="status">{status}</p> : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
