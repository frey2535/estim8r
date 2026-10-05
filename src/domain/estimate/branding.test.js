import {
  DEFAULT_BRANDING,
  COMPANY_BRANDING_KEY,
  brandingLayout,
  companyLines,
  normalizeBranding,
  readCompanyBranding,
  resolveLogoBox,
  writeCompanyBranding,
} from "./branding.js";

function assert(cond, message) {
  if (!cond) {
    console.error("FAIL", message);
    process.exitCode = 1;
  }
}

const cleaned = normalizeBranding({
  companyName: "  Current Flow  ",
  primaryColor: "blue",
  fontFamily: "comic-sans",
  headerSize: "huge",
  cardSize: "giant",
  logoDataUrl: "javascript:alert(1)",
});
assert(cleaned.companyName === "Current Flow", "company name is trimmed");
assert(cleaned.primaryColor === DEFAULT_BRANDING.primaryColor, "invalid color falls back");
assert(cleaned.fontFamily === "helvetica", "unknown font falls back");
assert(cleaned.headerSize === "medium", "unknown header size falls back");
assert(cleaned.cardSize === "comfortable", "unknown card size falls back");
assert(cleaned.logoDataUrl === "", "non-image logo is rejected");
assert(cleaned.logoStretchX === 100, "missing horizontal stretch defaults to 100");
assert(cleaned.logoStretchY === 100, "missing vertical stretch defaults to 100");

const stretched = normalizeBranding({ logoStretchX: 220, logoStretchY: 70 });
assert(stretched.logoStretchX === 220, "horizontal stretch is stored independently");
assert(stretched.logoStretchY === 70, "vertical stretch is stored independently");
assert(normalizeBranding({ logoStretchX: 8 }).logoStretchX === 20, "stretch has a floor");
assert(normalizeBranding({ logoStretchY: 900 }).logoStretchY === 400, "stretch has a ceiling");

const layout = brandingLayout({ headerSize: "large", cardSize: "compact", logoSize: "small", fontFamily: "times" });
assert(layout.headerHeight > brandingLayout({ headerSize: "small" }).headerHeight, "large header is taller");
assert(layout.cardPad < brandingLayout({ cardSize: "spacious" }).cardPad, "compact card uses less padding");
assert(layout.logo < brandingLayout({ logoSize: "large" }).logo, "small logo is smaller");
assert(layout.font === "times", "times maps to the PDF font");

const wide = brandingLayout({ logoSize: "medium", logoStretchX: 200, logoStretchY: 80 });
assert(wide.logoWidth > wide.logoHeight, "horizontal stretch widens without changing height lock");
assert(Math.abs(wide.logoWidth - wide.logo * 2) < 0.001, "horizontal stretch is 200% of base");
assert(Math.abs(wide.logoHeight - wide.logo * 0.8) < 0.001, "vertical stretch is 80% of base");

const box = resolveLogoBox({ logoSize: "small", logoStretchX: 100, logoStretchY: 100 }, { logoStretchX: 150, logoStretchY: 50 });
assert(box.width !== box.height, "PDF design stretch is independent per axis");
assert(box.width > box.height, "design horizontal stretch is wider than vertical");

assert(companyLines({
  companyAddress: "1 Main St",
  companyPhone: "555-0100",
  companyEmail: "bid@example.com",
  companyLicense: "E-12",
}).join(" ").includes("License E-12"), "company lines include license");

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => memory.set(key, String(value)),
};
const saved = writeCompanyBranding({ companyName: "Shelby Electric", textColor: "#111827", headerColor: "#7c2d12" });
assert(saved.textColor === "#111827", "text color is stored");
assert(saved.headerColor === "#7c2d12", "header color is stored");
assert(readCompanyBranding().companyName === "Shelby Electric", "branding persists");
assert(memory.get(COMPANY_BRANDING_KEY).includes("Shelby Electric"), "company branding key is used");

if (!process.exitCode) console.log("branding checks passed");
