import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { COLOR_TOKENS } from "@/lib/appearanceLabels";

export { COLOR_TOKENS };

const ThemeContext = createContext({ theme: "light", toggleTheme: () => {}, appearance: {}, updateAppearance: () => {}, resetAppearance: () => {} });
const STORAGE_KEY = "estim8r-theme";
export const FONT_OPTIONS = ["Plus Jakarta Sans", "Inter", "Arial", "Georgia", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman", "Courier New", "system-ui"];
const validHex = (value) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
function hexToHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = 0, s = 0; const l = (max + min) / 2;
  if (delta) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) { case r: h = ((g - b) / delta) % 6; break; case g: h = (b - r) / delta + 2; break; default: h = (r - g) / delta + 4; }
    h *= 60;
  }
  return `${Math.round((h + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
function sanitize(input) {
  if (!input || typeof input !== "object") return {};
  const colors = {};
  for (const token of COLOR_TOKENS) if (validHex(input.colors?.[token])) colors[token] = input.colors[token];
  return { colors, font: FONT_OPTIONS.includes(input.font) ? input.font : FONT_OPTIONS[0] };
}
function userKey(user) {
  const id = user?.id || user?.email;
  return id ? `estim8r-appearance:${String(id)}` : null;
}
export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const key = userKey(user);
  const [appearance, setAppearance] = useState({});
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    try { setAppearance(key ? sanitize(JSON.parse(localStorage.getItem(key) || "{}")) : {}); }
    catch { setAppearance({}); }
  }, [key]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);
  useEffect(() => {
    const root = document.documentElement;
    for (const token of COLOR_TOKENS) {
      const color = appearance.colors?.[token];
      if (validHex(color)) root.style.setProperty(`--${token}`, hexToHsl(color));
      else root.style.removeProperty(`--${token}`);
    }
    const font = FONT_OPTIONS.includes(appearance.font) ? appearance.font : FONT_OPTIONS[0];
    root.style.setProperty("--font-inter", `"${font}", sans-serif`);
    return () => {
      for (const token of COLOR_TOKENS) root.style.removeProperty(`--${token}`);
      root.style.removeProperty("--font-inter");
    };
  }, [appearance, theme, key]);
  const updateAppearance = useCallback((next) => {
    if (!key) return;
    setAppearance((current) => {
      const updated = sanitize({ ...current, ...next, colors: { ...current.colors, ...next.colors } });
      try { localStorage.setItem(key, JSON.stringify(updated)); } catch { /* browser storage unavailable */ }
      return updated;
    });
  }, [key]);
  const resetAppearance = useCallback(() => {
    if (!key) return;
    try { localStorage.removeItem(key); } catch { /* browser storage unavailable */ }
    setAppearance({});
  }, [key]);
  const toggleTheme = useCallback(() => setTheme((current) => current === "dark" ? "light" : "dark"), []);
  return <ThemeContext.Provider value={{ theme, toggleTheme, appearance, updateAppearance, resetAppearance }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
