import React from "react";
import { useTheme, FONT_OPTIONS } from "@/lib/ThemeContext";
import { APPEARANCE_GROUPS, hslComponentsToHex } from "@/lib/appearanceLabels";

function shownColor(token, custom) {
  if (custom) return custom;
  if (typeof document === "undefined") return "#808080";
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  return hslComponentsToHex(raw) || "#808080";
}

export default function AppearanceSettings() {
  const { theme, appearance, updateAppearance, resetAppearance } = useTheme();
  const colors = appearance.colors || {};
  return (
    <section className="mt-7 max-w-4xl rounded-2xl border border-border bg-card p-4 sm:p-6" aria-label="App appearance customization" data-theme={theme}>
      <h2 className="text-xl font-bold">Colors and font</h2>
      <p className="mt-2 text-sm text-muted-foreground">Each control names the part of Estim8r it changes. The color you pick is saved for this account on this browser and shows up immediately. Restore original clears every custom color and the font.</p>
      <label className="mt-5 block text-sm font-semibold">
        Text font
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">The typeface used for menus, buttons, and pages.</span>
        <select className="mt-1 block w-full rounded-lg border border-input bg-background p-2 text-foreground" value={appearance.font || FONT_OPTIONS[0]} onChange={(e) => updateAppearance({ font: e.target.value })}>
          {FONT_OPTIONS.map((font) => <option key={font} value={font}>{font}</option>)}
        </select>
      </label>
      <div className="mt-6 space-y-6">
        {APPEARANCE_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-bold">{group.title}</h3>
            {group.detail ? <p className="mt-1 text-xs leading-4 text-muted-foreground">{group.detail}</p> : null}
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.colors.map((item) => (
                <label key={item.token} className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-xs font-normal leading-4 text-muted-foreground">{item.detail}</span>
                    {!colors[item.token] ? <span className="mt-1 block text-xs font-medium text-muted-foreground">Using the original color.</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <input
                      aria-label={item.label}
                      type="color"
                      value={shownColor(item.token, colors[item.token])}
                      onChange={(e) => updateAppearance({ colors: { [item.token]: e.target.value } })}
                      className="h-10 w-12 cursor-pointer"
                    />
                    {colors[item.token] ? (
                      <button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={() => updateAppearance({ colors: { [item.token]: null } })}>
                        Original color
                      </button>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={resetAppearance} className="mt-5 rounded-lg border border-border bg-background px-4 py-2 font-semibold">Restore original colors and font</button>
    </section>
  );
}
