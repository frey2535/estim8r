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
import { readCompanyBranding } from "@/domain/estimate/branding";
import {
  createEstimatePdfPreview,
  estimatePdfPreviewKey,
} from "@/domain/estimate/estimatePdf";
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

export default function EstimatePdfPreview({ estimate }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [blob, setBlob] = useState(null);
  const [pages, setPages] = useState([]);
  const [retry, setRetry] = useState(0);
  const requestRef = useRef(0);

  const previewKey = estimatePdfPreviewKey(estimate, readCompanyBranding());

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
        const preview = createEstimatePdfPreview(estimate, readCompanyBranding());
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
        setError(nextError?.message || "Could not create the estimate PDF.");
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, previewKey, estimate, retry]);

  function downloadPreview() {
    if (!blob) return;
    downloadBlob(blob, fileName || "estimate.pdf");
  }

  return (
    <>
      <button
        type="button"
        data-testid="preview-estimate-pdf"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-muted"
      >
        <Eye className="h-4 w-4" /> Preview PDF
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:h-[92vh] sm:max-w-4xl sm:rounded-lg">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 pr-12 text-left sm:px-5">
            <DialogTitle>Estimate PDF preview</DialogTitle>
            <DialogDescription>
              {fileName || "The same branded customer PDF that Download produces."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/40 px-3 py-4 sm:px-6">
            {status === "loading" || status === "idle" ? (
              <div className="mx-auto flex w-full max-w-[45rem] flex-col items-center gap-3" role="status" data-testid="estimate-pdf-preview-loading">
                <Skeleton className="aspect-[612/792] w-full max-w-[22rem] sm:max-w-[28rem]" />
                <p className="text-sm text-muted-foreground">Building the estimate PDF…</p>
              </div>
            ) : null}
            {status === "empty" ? (
              <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-card p-6 text-center" data-testid="estimate-pdf-preview-empty">
                <h3 className="font-semibold">No Estimate Lines yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a line on this estimate to preview the branded customer PDF. Header, totals, and markup will show once there is something to print.
                </p>
              </div>
            ) : null}
            {status === "error" ? (
              <Alert variant="destructive" className="mx-auto max-w-md" data-testid="estimate-pdf-preview-error">
                <AlertTitle>PDF preview failed</AlertTitle>
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
              <div className="mx-auto flex w-full max-w-[46rem] flex-col items-center gap-4" data-testid="estimate-pdf-preview-pages">
                {pages.map((page) => (
                  <figure key={page.pageNumber} className="w-full">
                    <img
                      src={page.src}
                      alt={`Estimate PDF page ${page.pageNumber} of ${pages.length}`}
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
              Live from the current Estimate Lines, totals, markup, and header.
            </p>
            <button
              type="button"
              data-testid="download-estimate-pdf-from-preview"
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
