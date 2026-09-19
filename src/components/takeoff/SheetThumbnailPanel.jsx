import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsLeft, ChevronsRight, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPdfDocument } from "@/lib/pdf-document";

const THUMB_WIDTH = 112;
const OPEN_KEY = "estim8r.takeoff.thumbsOpen";

export function readThumbsOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeThumbsOpen(open) {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    /* private mode */
  }
}

async function renderPageThumb(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = THUMB_WIDTH / base.width;
  const viewport = page.getViewport({ scale: Math.min(0.4, scale) });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.72);
}

export default function SheetThumbnailPanel({
  fileBytes,
  fileUrl,
  isPdf,
  fileName,
  page,
  pageCount,
  marks,
  onSelectPage,
  open,
  onToggle,
  layout = "side",
}) {
  const [thumbs, setThumbs] = useState([]);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const counts = useMemo(() => {
    const next = new Map();
    for (const mark of marks || []) {
      const sheet = mark.sheet || 1;
      next.set(sheet, (next.get(sheet) || 0) + 1);
    }
    return next;
  }, [marks]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      if (!isPdf) {
        setThumbs(fileUrl ? [{ page: 1, src: fileUrl, label: "Sheet 1" }] : []);
        return;
      }
      if (!fileBytes) {
        setThumbs([]);
        return;
      }
      try {
        const pdf = await getPdfDocument(fileBytes);
        if (cancelled) return;
        const labels = await pdf.getPageLabels().catch(() => null);
        const pages = Array.from({ length: pdf.numPages }, (_, index) => index + 1);
        setThumbs(pages.map((number) => ({
          page: number,
          src: "",
          label: labels?.[number - 1] || `Sheet ${number}`,
        })));
        for (const number of pages) {
          const src = await renderPageThumb(pdf, number);
          if (cancelled) return;
          setThumbs((current) => current.map((item) => (
            item.page === number ? { ...item, src } : item
          )));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Sheet thumbnails failed", err);
          setError(err?.message || "Unable to render sheet thumbnails.");
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [fileBytes, fileUrl, isPdf]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector(`[data-sheet="${page}"]`);
    active?.scrollIntoView({ block: layout === "side" ? "nearest" : "nearest", inline: "nearest" });
  }, [layout, open, page]);

  const side = layout === "side";
  const total = Math.max(pageCount || thumbs.length || 1, thumbs.length || 1);

  if (!open) {
    return (
      <div className={cn(
        "flex shrink-0 border-border bg-card",
        side ? "h-full w-9 flex-col border-r" : "h-9 w-full flex-row border-b",
      )}>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground",
            side ? "h-full w-9 flex-col py-3" : "h-9 w-full flex-row px-3",
          )}
          aria-expanded={false}
          aria-label="Show sheet thumbnails"
          title="Show sheets"
        >
          <ChevronsRight className={cn("h-4 w-4", !side && "rotate-90")} />
          <span className={cn(side && "mt-2 [writing-mode:vertical-rl] rotate-180")}>Sheets ({total})</span>
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex shrink-0 border-border bg-card",
      side ? "h-full w-[158px] flex-col border-r" : "w-full flex-col border-b",
    )}>
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-border px-2 py-1.5">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sheets</div>
          <div className="truncate text-xs font-semibold text-foreground">{total} in {fileName || "drawing"}</div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-expanded={true}
          aria-label="Hide sheet thumbnails"
          title="Hide sheets"
        >
          <ChevronsLeft className={cn("h-4 w-4", !side && "-rotate-90")} />
        </button>
      </div>
      {error && <p className="px-2 py-2 text-[11px] text-destructive">{error}</p>}
      <div
        ref={listRef}
        className={cn(
          "min-h-0 flex-1 gap-2 p-2",
          side ? "overflow-y-auto" : "flex overflow-x-auto",
        )}
      >
        {(thumbs.length ? thumbs : Array.from({ length: total }, (_, index) => ({ page: index + 1, src: "", label: `Sheet ${index + 1}` }))).map((item) => {
          const active = item.page === page;
          const markCount = counts.get(item.page) || 0;
          return (
            <button
              key={item.page}
              type="button"
              data-sheet={item.page}
              onClick={() => onSelectPage(item.page)}
              className={cn(
                "group block rounded-lg border p-1.5 text-left transition-colors",
                side ? "w-full" : "w-[132px] shrink-0",
                active
                  ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/30 dark:border-orange-500 dark:bg-orange-500/10 dark:ring-orange-500/30"
                  : "border-border bg-background hover:border-blue-300 hover:bg-muted",
              )}
            >
              <div className="relative overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
                {item.src ? (
                  <img src={item.src} alt={item.label} className="block h-auto w-full bg-white" />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                {markCount > 0 && (
                  <span className="absolute right-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-orange-500">
                    {markCount}
                  </span>
                )}
              </div>
              <div className={cn("mt-1 truncate text-[11px] font-semibold", active ? "text-blue-700 dark:text-orange-300" : "text-foreground")}>
                {item.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
