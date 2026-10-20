import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CARD_SIZE_OPTIONS,
  FONT_OPTIONS,
  SIZE_OPTIONS,
  fileToLogoDataUrl,
  normalizeBranding,
  readCompanyBranding,
  writeCompanyBranding,
} from "@/domain/estimate/branding";
import CompanyLogo from "./CompanyLogo";
import LogoStretchControls from "./LogoStretchControls";

function ColorField({ label, hint, value, onChange }) {
  return (
    <label className="min-w-0">
      <span className="mb-0.5 block text-xs font-bold text-muted-foreground">{label}</span>
      {hint ? <span className="mb-1 block text-[11px] font-normal leading-4 text-muted-foreground">{hint}</span> : null}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-sm"
        />
      </div>
    </label>
  );
}

function SelectField({ label, hint, value, options, onChange }) {
  return (
    <label className="min-w-0">
      <span className="mb-0.5 block text-xs font-bold text-muted-foreground">{label}</span>
      {hint ? <span className="mb-1 block text-[11px] font-normal leading-4 text-muted-foreground">{hint}</span> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2.5"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function CompanyBrandingForm({ showEstimateLink = false }) {
  const [branding, setBranding] = useState(() => readCompanyBranding());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setBranding(readCompanyBranding());
  }, []);

  function patch(key, value) {
    setBranding((current) => {
      const next = { ...current, [key]: value };
      if (key === "logoStretchX" || key === "logoStretchY") {
        return writeCompanyBranding(next);
      }
      return next;
    });
    setStatus("");
  }

  function save() {
    const next = writeCompanyBranding(normalizeBranding(branding));
    setBranding(next);
    setError("");
    setStatus("Estimate PDF branding saved for this company.");
  }

  async function onLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const logoDataUrl = await fileToLogoDataUrl(file);
      patch("logoDataUrl", logoDataUrl);
      setError("");
    } catch (nextError) {
      setError(nextError.message || "Could not use that logo.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Estimate PDF branding</h2>
        <p className="text-sm text-muted-foreground">
          These company settings apply to every downloaded or printed estimate PDF. The printed page uses the Buildr created-estimate layout. They do not appear on the Labor & markup tab.
        </p>
        {showEstimateLink ? (
          <Link to="/estimates/new" className="mt-2 inline-block text-sm font-semibold text-blue-600 dark:text-orange-500">
            Back to the estimate
          </Link>
        ) : null}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold">Company information</h3>
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          <label className="min-w-0 min-[480px]:col-span-2">
            <span className="mb-1 block text-xs font-bold text-muted-foreground">Company name</span>
            <input value={branding.companyName} onChange={(e) => patch("companyName", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5" />
          </label>
          <label className="min-w-0 min-[480px]:col-span-2">
            <span className="mb-1 block text-xs font-bold text-muted-foreground">Address</span>
            <input value={branding.companyAddress} onChange={(e) => patch("companyAddress", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-bold text-muted-foreground">Phone</span>
            <input type="tel" value={branding.companyPhone} onChange={(e) => patch("companyPhone", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-bold text-muted-foreground">Email</span>
            <input type="email" value={branding.companyEmail} onChange={(e) => patch("companyEmail", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-bold text-muted-foreground">Website</span>
            <input value={branding.companyWebsite} onChange={(e) => patch("companyWebsite", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5" />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-bold text-muted-foreground">License</span>
            <input value={branding.companyLicense} onChange={(e) => patch("companyLicense", e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5" />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold">Company logo</h3>
        <div className="flex flex-wrap items-start gap-4">
          <CompanyLogo branding={branding} />
          <div className="min-w-[14rem] flex-1 space-y-3">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void onLogo(e)} className="block text-sm" />
            {branding.logoDataUrl ? (
              <button type="button" onClick={() => patch("logoDataUrl", "")} className="text-sm font-semibold text-destructive">
                Remove logo
              </button>
            ) : null}
            <LogoStretchControls
              stretchX={branding.logoStretchX}
              stretchY={branding.logoStretchY}
              onChange={patch}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold">Colors, type, and sizes</h3>
        <p className="mb-3 text-xs leading-4 text-muted-foreground">Each label says which document uses that color or size. The preview under this section shows the header, page, and card colors.</p>
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3">
          <ColorField label="Quote column titles" hint="Background of the column headings on a supply-house quote PDF." value={branding.primaryColor} onChange={(v) => patch("primaryColor", v)} />
          <ColorField label="Quote top bar" hint="Background of the company bar at the top of a supply-house quote PDF." value={branding.secondaryColor} onChange={(v) => patch("secondaryColor", v)} />
          <ColorField label="Document text" hint="Body text on the customer estimate PDF and the supply quote." value={branding.textColor} onChange={(v) => patch("textColor", v)} />
          <ColorField label="Estimate header background" hint="The bar across the top of the customer estimate PDF." value={branding.headerColor} onChange={(v) => patch("headerColor", v)} />
          <ColorField label="Preview header text" hint="Text in the preview below. The downloaded estimate picks white or black from how dark the header is." value={branding.headerTextColor} onChange={(v) => patch("headerTextColor", v)} />
          <ColorField label="Card and quote row fill" hint="Project cards on the estimate PDF, and every other row on the supply quote." value={branding.cardColor} onChange={(v) => patch("cardColor", v)} />
          <ColorField label="Estimate page color" hint="The paper color of the customer estimate PDF." value={branding.pageColor} onChange={(v) => patch("pageColor", v)} />
          <ColorField label="Stored accent" hint="Saved with the company settings. It does not change the estimate PDF or the supply quote." value={branding.accentColor} onChange={(v) => patch("accentColor", v)} />
          <SelectField label="PDF typeface" hint="Helvetica, Times, or Courier on downloaded PDFs." value={branding.fontFamily} options={FONT_OPTIONS} onChange={(v) => patch("fontFamily", v)} />
          <SelectField label="Estimate header height" hint="Small, medium, or large changes how tall the company header is." value={branding.headerSize} options={SIZE_OPTIONS} onChange={(v) => patch("headerSize", v)} />
          <SelectField label="Estimate card padding" hint="How much space is inside the project and company cards." value={branding.cardSize} options={CARD_SIZE_OPTIONS} onChange={(v) => patch("cardSize", v)} />
          <SelectField label="Logo size before stretch" hint="Small, medium, or large. Width and height stretch below can change it further." value={branding.logoSize} options={SIZE_OPTIONS} onChange={(v) => patch("logoSize", v)} />
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-3 px-4 py-3 text-sm font-bold" style={{ background: branding.headerColor, color: branding.headerTextColor }}>
            <CompanyLogo branding={branding} />
            <span>{branding.companyName || "Company header preview"}</span>
          </div>
          <div className="p-4 text-sm" style={{ background: branding.pageColor, color: branding.textColor }}>
            <div className="rounded-lg" style={{ background: branding.cardColor, padding: branding.cardSize === "compact" ? 8 : branding.cardSize === "spacious" ? 20 : 14 }}>
              Estimate cards and totals use these colors and sizes.
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {status ? <p className="text-sm text-muted-foreground" role="status">{status}</p> : null}
      <button type="button" onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white dark:bg-orange-500">
        Save PDF branding
      </button>
    </div>
  );
}
