export const COMPANY_BRANDING_KEY = "estim8r.companyBranding.v1";

export const FONT_OPTIONS = [
  { id: "helvetica", label: "Helvetica", pdf: "helvetica" },
  { id: "times", label: "Times", pdf: "times" },
  { id: "courier", label: "Courier", pdf: "courier" },
];

export const SIZE_OPTIONS = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

export const CARD_SIZE_OPTIONS = [
  { id: "compact", label: "Compact" },
  { id: "comfortable", label: "Comfortable" },
  { id: "spacious", label: "Spacious" },
];

export const DEFAULT_BRANDING = {
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyWebsite: "",
  companyLicense: "",
  logoDataUrl: "",
  primaryColor: "#1d4ed8",
  secondaryColor: "#0f172a",
  textColor: "#0f172a",
  headerColor: "#1d4ed8",
  headerTextColor: "#ffffff",
  cardColor: "#f8fafc",
  pageColor: "#ffffff",
  accentColor: "#1d4ed8",
  fontFamily: "helvetica",
  headerSize: "medium",
  cardSize: "comfortable",
  logoSize: "medium",
};

const HEX = /^#([0-9a-f]{6})$/i;

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function color(value, fallback) {
  const next = text(value, fallback).toLowerCase();
  return HEX.test(next) ? next : fallback;
}

function oneOf(value, options, fallback) {
  return options.some((option) => option.id === value) ? value : fallback;
}

export function normalizeBranding(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    companyName: text(source.companyName),
    companyAddress: text(source.companyAddress),
    companyPhone: text(source.companyPhone),
    companyEmail: text(source.companyEmail),
    companyWebsite: text(source.companyWebsite),
    companyLicense: text(source.companyLicense),
    logoDataUrl: /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(source.logoDataUrl || "") ? source.logoDataUrl : "",
    primaryColor: color(source.primaryColor, DEFAULT_BRANDING.primaryColor),
    secondaryColor: color(source.secondaryColor, DEFAULT_BRANDING.secondaryColor),
    textColor: color(source.textColor, DEFAULT_BRANDING.textColor),
    headerColor: color(source.headerColor, DEFAULT_BRANDING.headerColor),
    headerTextColor: color(source.headerTextColor, DEFAULT_BRANDING.headerTextColor),
    cardColor: color(source.cardColor, DEFAULT_BRANDING.cardColor),
    pageColor: color(source.pageColor, DEFAULT_BRANDING.pageColor),
    accentColor: color(source.accentColor, DEFAULT_BRANDING.accentColor),
    fontFamily: oneOf(source.fontFamily, FONT_OPTIONS, DEFAULT_BRANDING.fontFamily),
    headerSize: oneOf(source.headerSize, SIZE_OPTIONS, DEFAULT_BRANDING.headerSize),
    cardSize: oneOf(source.cardSize, CARD_SIZE_OPTIONS, DEFAULT_BRANDING.cardSize),
    logoSize: oneOf(source.logoSize, SIZE_OPTIONS, DEFAULT_BRANDING.logoSize),
  };
}

export function brandingLayout(branding = DEFAULT_BRANDING) {
  const next = normalizeBranding(branding);
  const headerHeight = { small: 56, medium: 78, large: 104 }[next.headerSize];
  const cardPad = { compact: 10, comfortable: 16, spacious: 24 }[next.cardSize];
  const cardRadius = { compact: 6, comfortable: 10, spacious: 14 }[next.cardSize];
  const logo = { small: 36, medium: 52, large: 72 }[next.logoSize];
  const font = FONT_OPTIONS.find((option) => option.id === next.fontFamily)?.pdf || "helvetica";
  return { ...next, headerHeight, cardPad, cardRadius, logo, font };
}

function storage() {
  if (typeof localStorage === "undefined") {
    return { getItem: () => null, setItem: () => {} };
  }
  return localStorage;
}

export function readCompanyBranding() {
  try {
    return normalizeBranding(JSON.parse(storage().getItem(COMPANY_BRANDING_KEY) || "null") || {});
  } catch {
    return normalizeBranding();
  }
}

export function writeCompanyBranding(input) {
  const next = normalizeBranding(input);
  try {
    storage().setItem(COMPANY_BRANDING_KEY, JSON.stringify(next));
  } catch {
    /* private mode or quota */
  }
  return next;
}

export function companyLines(branding = DEFAULT_BRANDING) {
  const next = normalizeBranding(branding);
  return [
    next.companyAddress,
    [next.companyPhone, next.companyEmail].filter(Boolean).join("  ·  "),
    next.companyWebsite,
    next.companyLicense ? `License ${next.companyLicense}` : "",
  ].filter(Boolean);
}

export async function fileToLogoDataUrl(file, maxEdge = 480) {
  if (!file || !/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
    throw new Error("Use a PNG, JPEG, or WebP logo.");
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the logo file."));
    reader.readAsDataURL(file);
  });
  if (typeof document === "undefined" || typeof Image === "undefined") return dataUrl;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height, 1));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Could not read the logo image."));
    image.src = dataUrl;
  });
}
