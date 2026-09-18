import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Grid3X3 } from "lucide-react";
import { CURRENT_APP_ID, CURRENT_FLOW_APPS } from "@/config/currentFlowApps";

export default function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const current = CURRENT_FLOW_APPS.find((app) => app.id === CURRENT_APP_ID);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="h-8 rounded-full bg-muted hover:bg-muted/80 active:bg-muted/60 px-2.5 flex items-center gap-1.5 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Current Flow apps"
      >
        <Grid3X3 className="w-4 h-4 text-foreground" />
        <span className="hidden md:inline text-xs font-semibold text-foreground">{current?.name}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-[70] w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl"
        >
          <div className="border-b border-border px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Flow Apps</div>
            <div className="mt-1 text-xs text-muted-foreground">One account. One electrical platform.</div>
          </div>
          <div className="p-2">
            {CURRENT_FLOW_APPS.map((app) => {
              const isCurrent = app.id === CURRENT_APP_ID;
              if (isCurrent) {
                return (
                  <div key={app.id} className="rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-orange-500/10">
                    <div className="text-sm font-bold text-foreground">{app.name}</div>
                    <div className="text-xs text-muted-foreground">{app.label}</div>
                  </div>
                );
              }

              if (!app.active) {
                return (
                  <div key={app.id} className="rounded-xl px-3 py-2.5 opacity-55">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{app.name}</div>
                        <div className="text-xs text-muted-foreground">{app.label}</div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Link pending</span>
                    </div>
                  </div>
                );
              }

              return (
                <a
                  key={app.id}
                  href={app.url}
                  className="block rounded-xl px-3 py-2.5 hover:bg-muted transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <div className="text-sm font-semibold text-foreground">{app.name}</div>
                  <div className="text-xs text-muted-foreground">{app.label}</div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
