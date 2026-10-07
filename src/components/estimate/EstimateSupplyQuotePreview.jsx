import React, { useEffect, useRef, useState } from "react";
import { Download, Eye } from "lucide-react";
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createSupplyQuotePdfPreview,
  supplyQuotePreviewKey,
} from "@/domain/estimate/estimateSupplyQuote";
import { downloadBlob } from "@/domain/estimate/projectDocuments";
import { getPdfDocument } from "@/lib/pdf-document";

if (!GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

async function renderPreviewPages(blob, widthCss) {
  const bytes = await blob.arrayBuffer();
  const pdf = await getPdfDocument(bytes);
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(0.5, (widthCss * dpr) / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    await page.render({ canvasContext: context, viewport }).promise;
    pages.push({
      pageNumber,
      src: canvas.toDataURL("image/png"),
      width: canvas.width / dpr,
      height: canvas.height / dpr,
    });
  }
  return pages;
}

function previewWidth() {
  if (typeof window === "undefined") return 612;
  const gutter = window.innerWidth < 768 ? 32 : 80;
  return Math.min(720, Math.max(280, window.innerWidth - gutter));
}

export default function EstimateSupplyQuotePreview({ quote }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [blob, setBlob] = useState(null);
  const [pages, setPages] = useState([]);
  const [retry, setRetry] = useState(0);
  const requestRef = useRef(0);

  const previewKey = supplyQuotePreviewKey(quote);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setError("");
      setPages([]);
      setBlob(null);
      return undefined;
    }

    let cancelled = false;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setStatus("loading");
    setError("");

    const timer = window.setTimeout(async () => {
      try {
        const preview = createSupplyQuotePdfPreview(quote);
        if (cancelled || requestRef.current !== requestId) return;
        setFileName(preview.fileName);
        if (preview.status === "empty") {
          setBlob(null);
          setPages([]);
          setStatus("empty");
          return;
        }
        const nextPages = await renderPreviewPages(preview.blob, previewWidth());
        if (cancelled || requestRef.current !== requestId) return;
        setBlob(preview.blob);
        setPages(nextPages);
        setStatus("ready");
      } catch (nextError) {
        if (cancelled || requestRef.current !== requestId) return;
        setBlob(null);
        setPages([]);
        setStatus("error");
        console.error("Supply quote PDF preview failed", nextError);
        setError("Could not create the supply house quote PDF.");
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, previewKey, quote, retry]);

  function downloadPreview() {
    if (!blob) return;
    downloadBlob(blob, fileName || "supply-quote.pdf");
  }

  return (
    <>
      <button
        type="button"
        data-testid="preview-supply-quote-pdf"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted"
      >
        <Eye className="h-3 w-3" /> Preview
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:h-[92vh] sm:max-w-4xl sm:rounded-lg">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-5">
            <DialogTitle>Supply house quote preview</DialogTitle>
            <DialogDescription>
              {fileName || "The same filtered quote PDF that Download produces."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/40 px-3 py-4 sm:px-6">
            {status === "loading" || status === "idle" ? (
              <div className="mx-auto flex w-full max-w-[45rem] flex-col items-center gap-3" role="status" data-testid="supply-quote-preview-loading">
                <Skeleton className="aspect-[612/792] w-full max-w-[22rem] sm:max-w-[28rem]" />
                <p className="text-sm text-muted-foreground">Building the supply house quote…</p>
              </div>
            ) : null}
            {status === "empty" ? (
              <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card p-6 text-center" data-testid="supply-quote-preview-empty">
                <h3 className="font-semibold">No supply-house items yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add equipment or material lines to preview the quote. Labor-only work such as Site/Earthwork, hand trenching, and sawcutting stays on the estimate.
                </p>
              </div>
            ) : null}
            {status === "error" ? (
              <Alert variant="destructive" className="mx-auto max-w-md" data-testid="supply-quote-preview-error">
                <AlertTitle>Quote preview failed</AlertTitle>
                <AlertDescription>
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => setRetry((count) => count + 1)}
                    className="mt-3 inline-flex items-center rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-semibold"
                  >
                    Try again
                  </button>
                </AlertDescription>
              </Alert>
            ) : null}
            {status === "ready" ? (
              <div className="mx-auto flex w-full max-w-[46rem] flex-col items-center gap-4" data-testid="supply-quote-preview-pages">
                {pages.map((page) => (
                  <figure key={page.pageNumber} className="w-full">
                    <img
                      src={page.src}
                      alt={`Supply house quote page ${page.pageNumber} of ${pages.length}`}
                      className="mx-auto h-auto w-full rounded-md border border-border bg-white shadow-sm"
                    />
                    {pages.length > 1 ? (
                      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                        Page {page.pageNumber} of {pages.length}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
            <p className="text-xs text-muted-foreground">
              Live from Estimate Lines. Labor-only catalog rows are left off this quote.
            </p>
            <button
              type="button"
              data-testid="download-supply-quote-pdf-from-preview"
              onClick={downloadPreview}
              disabled={!blob}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-orange-500"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
