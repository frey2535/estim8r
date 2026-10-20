import React, { useMemo, useState } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { DEFAULT_DOCUMENT_TITLE, normalizeDocumentTitle } from "@/domain/estimate/estimatePdf";
import CompanyLogo from "./CompanyLogo";
import EstimatePdfPreview from "./EstimatePdfPreview";
import LogoStretchControls from "./LogoStretchControls";
import { readCompanyBranding } from "@/domain/estimate/branding";

export const DEFAULT_PDF_DESIGN = {
  documentTitle: DEFAULT_DOCUMENT_TITLE,
  subtitle: "",
  showProjectCard: true,
  showScope: true,
  showItemType: false,
  showCategory: false,
  showDescription: true,
  showQuantity: true,
  showUnit: true,
  showMaterial: true,
  showLabor: true,
  showAmount: true,
  showNotes: true,
  tableStyle: "grid",
  density: "comfortable",
  titleSize: 18,
  bodySize: 9,
  margin: 40,
  footerText: "",
  terms: "",
  showPageNumbers: true,
  showHeader: true,
  headerCompanyAlign: "left",
  logoPosition: "left",
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoSizePt: 0,
  logoWidthPt: 0,
  logoHeightPt: 0,
  logoStretchX: 0,
  logoStretchY: 0,
  headerTitle: "",
  headerDetails: "",
  hideHeaderTitle: false,
  hideHeaderDetails: false,
  showCompanyCard: true,
  companyEmployeeName: "",
  companyEmployeeTitle: "",
  companyEmployeeEmail: "",
  companyEmployeePhone: "",
  showSignatures: true,

  // Page
  pageBorderEnabled: false,
  pageBorderColor: "#111827",
  pageBorderWidth: 1,
  pageBorderInset: 10,

  // Header
  headerHeightPt: 0,
  headerPaddingPt: 10,
  headerBottomGapPt: 10,
  headerFillColor: "#111827",
  headerBorderEnabled: false,
  headerBorderColor: "#111827",
  headerBorderWidth: 1,
  headerDividerEnabled: true,
  headerDividerWidth: 1,

  // Cards / section chrome
  cardHeightPt: 60,
  cardPaddingPt: 12,
  cardRadiusPt: 5,
  cardBorderEnabled: true,
  cardBorderColor: "#e5e7eb",
  cardBorderWidth: 0.5,
  cardFillEnabled: true,
  cardFillColor: "#f8fafc",

  // Spacing
  gapTitlePt: 10,
  gapCardsPt: 10,
  gapScopePt: 10,
  gapTablePt: 10,
  gapTotalsPt: 12,
  gapTermsPt: 14,
  signatureTopGapPt: 18,
  sectionSpacingMode: "custom",
};

export function normalizePdfDesign(value = {}) {
  const next = { ...DEFAULT_PDF_DESIGN, ...(value && typeof value === "object" ? value : {}) };
  next.documentTitle = normalizeDocumentTitle(next.documentTitle);
  next.logoStretchX = Number(next.logoStretchX) || 0;
  next.logoStretchY = Number(next.logoStretchY) || 0;
  [
    "pageBorderWidth", "pageBorderInset", "headerHeightPt", "headerPaddingPt",
    "headerBottomGapPt", "headerBorderWidth", "headerDividerWidth", "cardHeightPt", "cardPaddingPt",
    "cardRadiusPt", "cardBorderWidth", "gapTitlePt", "gapCardsPt", "gapScopePt",
    "gapTablePt", "gapTotalsPt", "gapTermsPt", "signatureTopGapPt",
  ].forEach((key) => { next[key] = Number(next[key]) || 0; });
  return next;
}

export default function EstimatePdfDesigner({ estimate, design, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const value = useMemo(() => normalizePdfDesign(design), [design]);
  const patch = (key, next) => onChange?.({ ...value, [key]: next });
  const previewEstimate = useMemo(() => ({ ...estimate, pdfDesign: value }), [estimate, value]);
  const branding = readCompanyBranding();
  const stretchX = value.logoStretchX || branding.logoStretchX;
  const stretchY = value.logoStretchY || branding.logoStretchY;

  return <section className="rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      <div><h2 className="text-lg font-black">PDF layout</h2><p className="text-xs text-muted-foreground">Each control says what it changes on the customer PDF. Sizes are in points, and 72 points is one inch. Controls marked as stored do not change the downloaded PDF.</p></div>
      <div className="flex gap-2"><EstimatePdfPreview estimate={previewEstimate} live embedded /><button type="button" onClick={() => onChange?.(DEFAULT_PDF_DESIGN)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold"><RotateCcw className="h-3.5 w-3.5"/> Restore the original PDF layout</button></div>
    </div>
    <div className="grid items-start gap-5 p-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Group title="Document">
          <Text label="PDF heading" hint="The large title on the estimate page and the customer PDF. Leave it blank and it prints Electrical." value={value.documentTitle} set={(v)=>patch("documentTitle",v)} />
          <Text label="Terms paragraph" hint="The terms printed under the totals. This replaces the fallback below." value={value.terms} set={(v)=>patch("terms",v)} />
          <Text label="Terms fallback" hint="Printed only when the terms paragraph above is empty." value={value.footerText} set={(v)=>patch("footerText",v)} />
        </Group>
        <Group title="Header and logo" hint="These change the colored bar at the top of the PDF.">
          <Toggle label="Show the company header" hint="Hides or shows the colored bar, logo, and contact names." value={value.showHeader !== false} set={(v)=>patch("showHeader",v)} />
          <div className="rounded-lg border border-border bg-muted/30 p-2">
            <p className="mb-1 text-xs font-bold">Logo preview</p>
            <p className="mb-2 text-[11px] text-muted-foreground">This is the logo that prints in the header.</p>
            <CompanyLogo branding={branding} design={value} />
          </div>
          <LogoStretchControls
            stretchX={stretchX}
            stretchY={stretchY}
            onChange={(key, next) => patch(key, next)}
          />
          <Range label={`Logo size, width and height together · ${value.logoSizePt || 0} points`} hint={value.logoSizePt ? "Sets both sides before stretch. A separate width or height below replaces that side." : "Zero uses the company logo size from Settings."} min={0} max={140} value={value.logoSizePt || 0} set={(v)=>patch("logoSizePt",Number(v))} />
          <Range label={`Logo width · ${value.logoWidthPt || 0} points`} hint={value.logoWidthPt ? "Forces the printed width. Stretch is ignored for width." : "Zero lets the width stretch control the width."} min={0} max={280} value={value.logoWidthPt || 0} set={(v)=>patch("logoWidthPt",Number(v))} />
          <Range label={`Logo height · ${value.logoHeightPt || 0} points`} hint={value.logoHeightPt ? "Forces the printed height. Stretch is ignored for height." : "Zero lets the height stretch control the height."} min={0} max={200} value={value.logoHeightPt || 0} set={(v)=>patch("logoHeightPt",Number(v))} />
        </Group>
        <Group title="What the PDF includes">
          <Toggle label="Project and customer card" hint="The bill-to and project boxes under the heading." value={value.showProjectCard} set={(v)=>patch("showProjectCard",v)} />
          <Toggle label="Show the employee in the header" hint="Adds a contact column when a name, title, email, or phone is filled in. The office column still uses the company settings." value={value.showCompanyCard !== false} set={(v)=>patch("showCompanyCard",v)} />
          <Text label="Employee name on the PDF" hint="Printed in the header contact column and on the contractor signature line." value={value.companyEmployeeName} set={(v)=>patch("companyEmployeeName",v)} />
          <Text label="Employee job title" hint="The small label above the employee name. Blank prints Estimator." value={value.companyEmployeeTitle} set={(v)=>patch("companyEmployeeTitle",v)} />
          <Text label="Employee email" hint="Printed under the employee name in the header." value={value.companyEmployeeEmail} set={(v)=>patch("companyEmployeeEmail",v)} />
          <Text label="Employee phone" hint="Printed under the employee name in the header." value={value.companyEmployeePhone} set={(v)=>patch("companyEmployeePhone",v)} />
          <Toggle label="Scope of work" hint="The scope paragraph. Hidden when this is off." value={value.showScope} set={(v)=>patch("showScope",v)} />
          <Toggle label="Signature lines" hint="Contractor and customer signature lines at the bottom." value={value.showSignatures !== false} set={(v)=>patch("showSignatures",v)} />
        </Group>
        <Group title="Stored, not printed" hint="These values are saved with the layout. Changing them does not change the downloaded PDF. The printed table is always Description, Qty, Unit Price, and Total.">
          <Text label="Subtitle" hint="Not printed." value={value.subtitle} set={(v)=>patch("subtitle",v)} />
          <Text label="Custom header title" hint="Not printed. The PDF uses the heading above." value={value.headerTitle} set={(v)=>patch("headerTitle",v)} />
          <Toggle label="Show the custom header title" hint="Not printed." value={!value.hideHeaderTitle} set={(v)=>patch("hideHeaderTitle",!v)} />
          <Text label="Custom header details" hint="Not printed. The PDF uses the company phone and email." value={value.headerDetails} set={(v)=>patch("headerDetails",v)} />
          <Toggle label="Show the custom header details" hint="Not printed." value={!value.hideHeaderDetails} set={(v)=>patch("hideHeaderDetails",!v)} />
          <Select label="Company name alignment" hint="Not printed. The PDF centers the company name." value={value.headerCompanyAlign || "left"} set={(v)=>patch("headerCompanyAlign",v)} options={[["left","Left"],["center","Center"],["right","Right"]]} />
          <Select label="Logo side" hint="Not printed. The PDF centers the logo." value={value.logoPosition || "left"} set={(v)=>patch("logoPosition",v)} options={[["left","Left"],["center","Center"],["right","Right"]]} />
          <Range label={`Move logo sideways · ${value.logoOffsetX || 0} points`} hint="Not printed. The PDF does not shift the logo." min={-180} max={180} value={value.logoOffsetX || 0} set={(v)=>patch("logoOffsetX",Number(v))} />
          <Range label={`Move logo up or down · ${value.logoOffsetY || 0} points`} hint="Not printed. The PDF does not shift the logo." min={-30} max={30} value={value.logoOffsetY || 0} set={(v)=>patch("logoOffsetY",Number(v))} />
          <Toggle label="Line item notes" hint="Not printed." value={value.showNotes} set={(v)=>patch("showNotes",v)} />
          <Toggle label="Page numbers" hint="Not printed." value={value.showPageNumbers} set={(v)=>patch("showPageNumbers",v)} />
          {[
            ["showItemType", "Type column", "Not printed."],
            ["showCategory", "Category column", "Not printed."],
            ["showDescription", "Description column", "Not printed. The PDF always includes Description."],
            ["showQuantity", "Quantity column", "Not printed. The PDF always includes Qty."],
            ["showUnit", "Unit column", "Not printed."],
            ["showMaterial", "Material column", "Not printed."],
            ["showLabor", "Labor column", "Not printed."],
            ["showAmount", "Amount column", "Not printed. The PDF always includes Total."],
          ].map(([key, label, hint]) => <Toggle key={key} label={label} hint={hint} value={value[key]} set={(v)=>patch(key,v)} />)}
        </Group>
        <button type="button" onClick={()=>setShowAdvanced(v=>!v)} className="text-sm font-bold text-blue-600 dark:text-orange-500">{showAdvanced ? "Hide advanced layout" : "Advanced layout"}</button>
        {showAdvanced ? <div className="space-y-4">
          <Group title="Page edge" hint="72 points is one inch.">
            <Range label={`Space from the page edge to the content · ${value.margin} points`} hint="The blank margin around the estimate." min={18} max={72} value={value.margin} set={(v)=>patch("margin",Number(v))} />
            <Toggle label="Draw a box around the page" hint="A rectangle inside the paper edge." value={value.pageBorderEnabled} set={(v)=>patch("pageBorderEnabled",v)} />
            <Color label="Page box color" hint="The color of that rectangle." value={value.pageBorderColor} set={(v)=>patch("pageBorderColor",v)} />
            <Range label={`Page box thickness · ${value.pageBorderWidth} points`} hint="How heavy the rectangle is." min={0} max={6} step={0.25} value={value.pageBorderWidth} set={(v)=>patch("pageBorderWidth",Number(v))} />
            <Range label={`Page box distance from the paper edge · ${value.pageBorderInset} points`} hint="How far the rectangle sits inside the page." min={0} max={36} value={value.pageBorderInset} set={(v)=>patch("pageBorderInset",Number(v))} />
          </Group>

          <Group title="Header size and color">
            <Range label={`Header height · ${value.headerHeightPt || "automatic"} points`} hint="Zero lets the logo and contacts decide the height." min={0} max={220} value={value.headerHeightPt} set={(v)=>patch("headerHeightPt",Number(v))} />
            <Range label={`Space inside the header · ${value.headerPaddingPt} points`} hint="Padding between the header edge and the logo." min={0} max={40} value={value.headerPaddingPt} set={(v)=>patch("headerPaddingPt",Number(v))} />
            <Range label={`Space under the header · ${value.headerBottomGapPt} points`} hint="The gap before the heading." min={0} max={60} value={value.headerBottomGapPt} set={(v)=>patch("headerBottomGapPt",Number(v))} />
            <Color label="Header background" hint="Replaces the company header color for this estimate." value={value.headerFillColor} set={(v)=>patch("headerFillColor",v)} />
            <Toggle label="Draw a box around the header" hint="An outline on the colored header bar." value={value.headerBorderEnabled} set={(v)=>patch("headerBorderEnabled",v)} />
            <Color label="Header box color" hint="The color of that header outline." value={value.headerBorderColor} set={(v)=>patch("headerBorderColor",v)} />
            <Range label={`Header box thickness · ${value.headerBorderWidth} points`} hint="How heavy the header outline is." min={0} max={8} step={0.25} value={value.headerBorderWidth} set={(v)=>patch("headerBorderWidth",Number(v))} />
            <Toggle label="Line under the logo" hint="The short line between the logo and the contact names." value={value.headerDividerEnabled !== false} set={(v)=>patch("headerDividerEnabled",v)} />
            <Range label={`Line under the logo thickness · ${value.headerDividerWidth} points`} hint="How heavy that short line is." min={0} max={6} step={0.25} value={value.headerDividerWidth} set={(v)=>patch("headerDividerWidth",Number(v))} />
          </Group>

          <Group title="Project cards">
            <Range label={`Card height · ${value.cardHeightPt} points`} hint="How tall the project and customer boxes are." min={36} max={140} value={value.cardHeightPt} set={(v)=>patch("cardHeightPt",Number(v))} />
            <Range label={`Space inside each card · ${value.cardPaddingPt} points`} hint="Padding around the words in those boxes." min={2} max={30} value={value.cardPaddingPt} set={(v)=>patch("cardPaddingPt",Number(v))} />
            <Range label={`Card corner roundness · ${value.cardRadiusPt} points`} hint="Zero is a square corner." min={0} max={24} value={value.cardRadiusPt} set={(v)=>patch("cardRadiusPt",Number(v))} />
            <Toggle label="Fill the cards" hint="Turns the card background on or off." value={value.cardFillEnabled !== false} set={(v)=>patch("cardFillEnabled",v)} />
            <Color label="Card background" hint="Replaces the company card color for this estimate." value={value.cardFillColor} set={(v)=>patch("cardFillColor",v)} />
            <Toggle label="Draw a box around each card" hint="The outline of the project and customer boxes." value={value.cardBorderEnabled !== false} set={(v)=>patch("cardBorderEnabled",v)} />
            <Color label="Card box color" hint="The color of that outline." value={value.cardBorderColor} set={(v)=>patch("cardBorderColor",v)} />
            <Range label={`Card box thickness · ${value.cardBorderWidth} points`} hint="How heavy the card outline is." min={0} max={6} step={0.25} value={value.cardBorderWidth} set={(v)=>patch("cardBorderWidth",Number(v))} />
          </Group>

          <Group title="Space between sections">
            <Range label={`Space from the header to the heading · ${value.gapTitlePt} points`} hint="How far the title sits below the colored header." min={0} max={60} value={value.gapTitlePt} set={(v)=>patch("gapTitlePt",Number(v))} />
            <Range label={`Space from the heading to the cards · ${value.gapCardsPt} points`} hint="How far the customer and project cards sit below the title." min={0} max={60} value={value.gapCardsPt} set={(v)=>patch("gapCardsPt",Number(v))} />
            <Range label={`Space before the scope · ${value.gapScopePt} points`} hint="Gap between the cards and the scope of work." min={0} max={60} value={value.gapScopePt} set={(v)=>patch("gapScopePt",Number(v))} />
            <Range label={`Space before the price table · ${value.gapTablePt} points`} hint="Gap between the scope and the line items." min={0} max={60} value={value.gapTablePt} set={(v)=>patch("gapTablePt",Number(v))} />
            <Range label={`Space before the totals · ${value.gapTotalsPt} points`} hint="Gap between the price table and the totals." min={0} max={60} value={value.gapTotalsPt} set={(v)=>patch("gapTotalsPt",Number(v))} />
            <Range label={`Space before the terms · ${value.gapTermsPt} points`} hint="Gap between the totals and the terms paragraph." min={0} max={80} value={value.gapTermsPt} set={(v)=>patch("gapTermsPt",Number(v))} />
            <Range label={`Space before the signatures · ${value.signatureTopGapPt} points`} hint="Gap between the terms and the signature lines." min={0} max={100} value={value.signatureTopGapPt} set={(v)=>patch("signatureTopGapPt",Number(v))} />
          </Group>

          <Group title="Type and table rows">
            <Select label="Table style" hint="Stored with the layout. The PDF always prints a lined table." value={value.tableStyle} set={(v)=>patch("tableStyle",v)} options={[["grid","Grid"],["clean","Clean"],["striped","Striped"]]} />
            <Select label="Table row height" hint="Compact, comfortable, or spacious changes how tall each price row is." value={value.density} set={(v)=>patch("density",v)} options={[["compact","Compact"],["comfortable","Comfortable"],["spacious","Spacious"]]} />
            <Range label={`Heading size · ${value.titleSize} points`} hint="The size of the PDF heading." min={12} max={32} value={value.titleSize} set={(v)=>patch("titleSize",Number(v))} />
            <Range label={`Body text size · ${value.bodySize} points`} hint="The PDF keeps body text between 9 and 10 points." min={6} max={14} value={value.bodySize} set={(v)=>patch("bodySize",Number(v))} />
          </Group>
        </div> : null}
      </div>
      <div className="min-h-[42rem] rounded-xl border border-border bg-muted/30 p-2 xl:sticky xl:top-4 xl:h-[calc(100dvh-2rem)] xl:max-h-[calc(100dvh-2rem)]">
        <EstimatePdfPreview estimate={previewEstimate} live embedded />
      </div>
    </div>
  </section>;
}
function Hint({ children }) {
  return children ? <span className="mt-0.5 block text-[11px] font-normal leading-4 text-muted-foreground">{children}</span> : null;
}
function Group({ title, hint, children }) {
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</h3>
      {hint ? <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}
function Text({ label, hint, value, set }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold">{label}</span>
      <Hint>{hint}</Hint>
      <input value={value || ""} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" />
    </label>
  );
}
function Toggle({ label, hint, value, set }) {
  return (
    <label className="block text-sm">
      <span className="flex items-center justify-between gap-3">
        <span className="font-semibold">{label}</span>
        <button type="button" aria-pressed={value} onClick={() => set(!value)} className={value ? "text-blue-600 dark:text-orange-500" : "text-muted-foreground"}>{value ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
      </span>
      <Hint>{hint}</Hint>
    </label>
  );
}
function Select({ label, hint, value, set, options }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold">{label}</span>
      <Hint>{hint}</Hint>
      <select value={value} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}
function Range({ label, hint, min, max, step = 1, value, set }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold">{label}</span>
      <Hint>{hint}</Hint>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(e.target.value)} className="mt-1 w-full" />
    </label>
  );
}
function Color({ label, hint, value, set }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold">{label}</span>
        <span className="flex items-center gap-2">
          <input type="color" aria-label={label} value={value || "#000000"} onChange={(e) => set(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-input bg-background p-1" />
          <input aria-label={`${label} hex`} value={value || ""} onChange={(e) => set(e.target.value)} className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
        </span>
      </span>
      <Hint>{hint}</Hint>
    </label>
  );
}
