export const COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
  "sidebar-background",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
];

export const APPEARANCE_GROUPS = [
  {
    title: "Pages",
    colors: [
      { token: "background", label: "Page background", detail: "The color behind every screen." },
      { token: "foreground", label: "Main text", detail: "The color of ordinary words on that background." },
    ],
  },
  {
    title: "Cards and panels",
    colors: [
      { token: "card", label: "Card background", detail: "The fill of panels, such as Settings cards and the takeoff side panel." },
      { token: "card-foreground", label: "Card text", detail: "Text written on those cards." },
      { token: "border", label: "Dividing lines", detail: "The lines around cards, panels, and sections." },
    ],
  },
  {
    title: "Buttons",
    colors: [
      { token: "primary", label: "Main button", detail: "The fill of primary buttons, such as Create Estimate." },
      { token: "primary-foreground", label: "Main button text", detail: "The words on those primary buttons." },
      { token: "secondary", label: "Secondary surface", detail: "The fill of a few secondary controls, such as a toast action." },
      { token: "secondary-foreground", label: "Secondary text", detail: "Text on those secondary controls." },
    ],
  },
  {
    title: "Hints and menus",
    colors: [
      { token: "muted", label: "Quiet background", detail: "Soft fills, such as an empty drop area or a selected chip." },
      { token: "muted-foreground", label: "Hint text", detail: "Labels, help text, and other less prominent words." },
      { token: "accent", label: "Menu highlight", detail: "The background of a hovered or selected menu row." },
      { token: "accent-foreground", label: "Menu highlight text", detail: "The words on that highlighted menu row." },
    ],
  },
  {
    title: "Text boxes",
    colors: [
      { token: "input", label: "Text box outline", detail: "The border around fields you can type in." },
      { token: "ring", label: "Focus ring", detail: "The outline that appears when a field or button is selected with the keyboard." },
    ],
  },
  {
    title: "Side panel colors",
    detail: "These colors are stored for a side navigation panel. The current screens do not show that panel, so changing them does not change what you see.",
    colors: [
      { token: "sidebar-background", label: "Side panel background", detail: "Would fill that panel. It is not on screen." },
      { token: "sidebar-foreground", label: "Side panel text", detail: "Would color words in that panel. It is not on screen." },
      { token: "sidebar-primary", label: "Side panel selected item", detail: "Would fill the selected row. It is not on screen." },
      { token: "sidebar-primary-foreground", label: "Side panel selected text", detail: "Would color the words on the selected row. It is not on screen." },
      { token: "sidebar-accent", label: "Side panel hover", detail: "Would fill a hovered row. It is not on screen." },
      { token: "sidebar-accent-foreground", label: "Side panel hover text", detail: "Would color the words on a hovered row. It is not on screen." },
      { token: "sidebar-border", label: "Side panel divider", detail: "Would draw the lines in that panel. It is not on screen." },
    ],
  },
];

export function appearanceColor(token) {
  for (const group of APPEARANCE_GROUPS) {
    const found = group.colors.find((item) => item.token === token);
    if (found) return found;
  }
  return null;
}

export function hslComponentsToHex(value) {
  const match = String(value || "").trim().match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return null;
  const hue = ((Number(match[1]) % 360) + 360) % 360;
  const saturation = Math.min(100, Math.max(0, Number(match[2]))) / 100;
  const lightness = Math.min(100, Math.max(0, Number(match[3]))) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (sector < 1) [red, green, blue] = [chroma, x, 0];
  else if (sector < 2) [red, green, blue] = [x, chroma, 0];
  else if (sector < 3) [red, green, blue] = [0, chroma, x];
  else if (sector < 4) [red, green, blue] = [0, x, chroma];
  else if (sector < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];
  const matchLight = lightness - chroma / 2;
  const hex = [red, green, blue].map((channel) => {
    const byte = Math.round(Math.min(1, Math.max(0, channel + matchLight)) * 255);
    return byte.toString(16).padStart(2, "0");
  }).join("");
  return `#${hex}`;
}
