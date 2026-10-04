import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPdfDocument } from "@/lib/pdf-document";
import { cropToViewportPixels, cropWindowForMark, reviewStatusForMark } from "@/domain/takeoff/accuracyReview";

async function paintCleanCrop(fileBytes, pageNumber, crop, canvas) {
  if (!fileBytes || !canvas) return;
  const pdf = await getPdfDocument(fileBytes);
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2.4 });
  const box = cropToViewportPixels(crop, viewport);
  const scratch = document.createElement("canvas");
  scratch.width = Math.max(1, Math.round(viewport.width));
  scratch.height = Math.max(1, Math.round(viewport.height));
  await page.render({ canvasContext: scratch.getContext("2d", { alpha: false }), viewport }).promise;
  const dest = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.max(1, Math.round(box.sw));
  canvas.height = Math.max(1, Math.round(box.sh));
  dest.drawImage(scratch, box.sx, box.sy, box.sw, box.sh, 0, 0, canvas.width, canvas.height);
}

export default function AccuracyPopout({
  open,
  onOpenChange,
  mark,
  fileBytes,
  index = 0,
  total = 0,
  instanceOnly = false,
  typeCount = 1,
  symbols = [],
  onAccept,
  onReject,
  onPrev,
  onNext,
  onChangeType,
  onMove,
  onResize,
  onAddMissed,
}) {
  const canvasRef = useRef(null);
  const [cropError, setCropError] = useState("");
  const crop = mark ? cropWindowForMark(mark) : null;
  const status = reviewStatusForMark(mark);

  useEffect(() => {
    if (!open || !mark || !fileBytes || !canvasRef.current || !crop) return undefined;
    let cancelled = false;
    setCropError("");
    paintCleanCrop(fileBytes, mark.sheet || 1, crop, canvasRef.current).then(() => {
      if (cancelled) return;
      setCropError("");
    }).catch((error) => {
      if (!cancelled) setCropError(error?.message || "Could not crop the original PDF.");
    });
    return () => { cancelled = true; };
  }, [open, mark, fileBytes, crop?.x, crop?.y, crop?.w, crop?.h]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,42rem)] overflow-auto p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle>Accuracy review</DialogTitle>
          <DialogDescription>
            {mark?.type === "coverage"
              ? "This plan region has no accepted detection yet. Confirm you scanned it, leave it unresolved, or add a missed device."
              : instanceOnly
                ? "AI was uncertain about this count. Verify this instance only."
                : `Verify this device type once. Accept or reject applies to ${typeCount} count${typeCount === 1 ? "" : "s"} of the same type.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <canvas ref={canvasRef} className="block h-auto w-full" />
            {cropError ? <p className="p-3 text-xs text-destructive">{cropError}</p> : null}
            {!fileBytes ? <p className="p-3 text-xs text-muted-foreground">Open a PDF to compare this count to the original sheet.</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <div className="font-bold text-muted-foreground">Type</div>
              <div>{mark?.typeCode || mark?.abbr || "—"}</div>
            </div>
            <div>
              <div className="font-bold text-muted-foreground">Label</div>
              <div>{mark?.symbolLabel || mark?.symbol || "—"}</div>
            </div>
            <div>
              <div className="font-bold text-muted-foreground">Detection</div>
              <div>{mark?.outlineSource === "vector" ? "Extracted outline" : "Text tag"}</div>
            </div>
            <div>
              <div className="font-bold text-muted-foreground">Review</div>
              <div>{status}</div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {index + 1} of {total} review item{total === 1 ? "" : "s"}
            {mark?.type === "coverage"
              ? " · unscanned region"
              : instanceOnly ? " · uncertain count" : ` · type ${mark?.typeCode || mark?.abbr || ""}`}
            {mark?.detectSource === "original-pdf" ? " · original PDF" : ""}
          </p>
          {mark?.type !== "coverage" && (onChangeType || onMove || onResize) ? (
            <div className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-2">
              {onChangeType ? (
                <label className="block text-[11px] sm:col-span-2">
                  <span className="mb-0.5 block font-bold text-muted-foreground">Change device type</span>
                  <select
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    value={mark?.symbol || ""}
                    onChange={(event) => {
                      const next = symbols.find((item) => item.id === event.target.value);
                      if (next) onChangeType(next);
                    }}
                  >
                    <option value="">{mark?.typeCode || "Select type"}</option>
                    {symbols.map((item) => (
                      <option key={item.id} value={item.id}>{item.abbr} — {item.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {onMove ? (
                <div className="grid grid-cols-2 gap-1">
                  <label className="text-[11px]">
                    <span className="mb-0.5 block font-bold text-muted-foreground">Move X</span>
                    <input type="number" step="0.1" className="w-full rounded-md border border-input bg-background px-1.5 py-1 text-xs" value={Number(mark?.x || 0).toFixed(1)} onChange={(event) => onMove({ x: Number(event.target.value), y: mark.y })} />
                  </label>
                  <label className="text-[11px]">
                    <span className="mb-0.5 block font-bold text-muted-foreground">Move Y</span>
                    <input type="number" step="0.1" className="w-full rounded-md border border-input bg-background px-1.5 py-1 text-xs" value={Number(mark?.y || 0).toFixed(1)} onChange={(event) => onMove({ x: mark.x, y: Number(event.target.value) })} />
                  </label>
                </div>
              ) : null}
              {onResize ? (
                <div className="grid grid-cols-2 gap-1">
                  <label className="text-[11px]">
                    <span className="mb-0.5 block font-bold text-muted-foreground">Width</span>
                    <input type="number" step="0.05" className="w-full rounded-md border border-input bg-background px-1.5 py-1 text-xs" value={Number(mark?.outline?.w || mark?.symbolBodyBounds?.w || 0.7).toFixed(2)} onChange={(event) => onResize({ w: Number(event.target.value), h: mark.outline?.h || mark.symbolBodyBounds?.h || 0.7 })} />
                  </label>
                  <label className="text-[11px]">
                    <span className="mb-0.5 block font-bold text-muted-foreground">Height</span>
                    <input type="number" step="0.05" className="w-full rounded-md border border-input bg-background px-1.5 py-1 text-xs" value={Number(mark?.outline?.h || mark?.symbolBodyBounds?.h || 0.7).toFixed(2)} onChange={(event) => onResize({ w: mark.outline?.w || mark.symbolBodyBounds?.w || 0.7, h: Number(event.target.value) })} />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onPrev} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Previous</button>
            <button type="button" onClick={onNext} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Next</button>
            <button type="button" onClick={onAccept} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">{mark?.type === "coverage" ? "Mark region scanned" : "Accept"}</button>
            <button type="button" onClick={onReject} className="rounded-lg border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">{mark?.type === "coverage" ? "Leave unresolved" : "Reject"}</button>
            {onAddMissed ? (
              <button type="button" onClick={onAddMissed} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Add missed device</button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
