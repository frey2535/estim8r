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
  onAccept,
  onReject,
  onPrev,
  onNext,
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
            {instanceOnly
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
            {instanceOnly ? " · uncertain count" : ` · type ${mark?.typeCode || mark?.abbr || ""}`}
            {mark?.detectSource === "original-pdf" ? " · original PDF" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onPrev} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Previous</button>
            <button type="button" onClick={onNext} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Next</button>
            <button type="button" onClick={onAccept} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">Accept</button>
            <button type="button" onClick={onReject} className="rounded-lg border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10">Reject</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
