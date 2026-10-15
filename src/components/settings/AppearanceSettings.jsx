import React from "react";
import { useTheme, COLOR_TOKENS, FONT_OPTIONS } from "@/lib/ThemeContext";

export default function AppearanceSettings() {
  const { appearance, updateAppearance, resetAppearance } = useTheme();
  const colors = appearance.colors || {};
  return (
    <section className="mt-7 max-w-4xl rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="App appearance customization">
      <h2 className="text-xl font-bold">App appearance</h2>
      <p className="mt-2 text-sm text-muted-foreground">Choose your own fonts and colors. Changes appear immediately and are saved for this account on this browser. Reset restores the original app appearance.</p>
      <label className="mt-5 block text-sm font-semibold">App font
        <select className="mt-1 block w-full rounded-lg border border-input bg-background p-2 text-foreground" value={appearance.font || FONT_OPTIONS[0]} onChange={(e) => updateAppearance({ font: e.target.value })}>
          {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
        </select>
      </label>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COLOR_TOKENS.map((token) => (
          <label key={token} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
            <span className="min-w-0 break-words font-medium">{token.replaceAll("-", " ")}</span>
            <span className="flex shrink-0 items-center gap-2">
              <input aria-label={`Color for ${token}`} type="color" value={colors[token] || "#808080"} onChange={(e) => updateAppearance({ colors: { [token]: e.target.value } })} className="h-10 w-12 cursor-pointer" />
              {colors[token] ? <button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={() => updateAppearance({ colors: { [token]: null } })}>Default</button> : null}
            </span>
          </label>
        ))}
      </div>
      <button type="button" onClick={resetAppearance} className="mt-5 rounded-lg border border-border bg-background px-4 py-2 font-semibold">Reset all appearance settings</button>
    </section>
  );
}
