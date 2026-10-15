import React, { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { refreshCurrentFlowApp } from "@/lib/appRefresh";

export default function AppRefreshButton({ className }) {
  const [busy, setBusy] = useState(false);

  const onRefresh = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await refreshCurrentFlowApp();
    } catch {
      setBusy(false);
      window.location.reload();
    }
  }, [busy]);

  return (
    <button
      type="button"
      data-testid="app-refresh-button"
      onClick={() => void onRefresh()}
      disabled={busy}
      aria-label="Refresh Estim8r and load the latest build"
      title="Clear errors and load the latest Estim8r build. The open estimate and takeoff stay."
      className={cn(
        "inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white shadow-sm",
        "hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 dark:bg-orange-500 dark:hover:bg-orange-600",
        className,
      )}
    >
      <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
      <span>{busy ? "Refreshing…" : "Refresh"}</span>
    </button>
  );
}
