import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function UpdateAvailablePrompt() {
  const [update, setUpdate] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const onUpdateAvailable = (event) => {
      setUpdate(event.detail || { applyUpdate: () => window.location.reload() });
    };
    if (window.__estim8rPendingUpdate) setUpdate(window.__estim8rPendingUpdate);
    window.addEventListener("estim8r-update-available", onUpdateAvailable);
    return () => window.removeEventListener("estim8r-update-available", onUpdateAvailable);
  }, []);

  const applyUpdate = useCallback(async () => {
    if (applying) return;
    setApplying(true);
    try {
      if (typeof update?.applyUpdate === "function") {
        await update.applyUpdate();
        return;
      }
    } catch {
      /* fall through */
    }
    const next = new URL(window.location.href);
    next.searchParams.set("t", String(Date.now()));
    if (update?.targetSha) next.searchParams.set("build", update.targetSha);
    window.location.replace(next.toString());
  }, [applying, update]);

  if (!update) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-slate-950/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="estim8r-update-title"
        className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl p-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p id="estim8r-update-title" className="text-base font-bold text-foreground">Update available</p>
            <p className="text-sm text-muted-foreground mt-1">
              A newer version of Estim8r is ready. Update now to load the latest takeoff tools and fixes.
            </p>
            <button
              type="button"
              onClick={applyUpdate}
              disabled={applying}
              className="mt-4 w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold px-3 py-2.5 transition-colors"
            >
              {applying ? "Updating..." : "Update now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
