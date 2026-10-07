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
      <div><h2 className="text-lg font-black">PDF Designer</h2><p className="text-xs text-muted-foreground">Customer PDF uses the Buildr created-estimate layout. Heading stays Electrical. Logo stretch is independent on each axis.</p></div>
      <div className="flex gap-2"><EstimatePdfPreview estimate={previewEstimate} live embedded /><button type="button" onClick={() => onChange?.(DEFAULT_PDF_DESIGN)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold"><RotateCcw className="h-3.5 w-3.5"/> Reset layout</button></div>
    </div>
    <div className="grid items-start gap-5 p-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Group title="Document">
          <Text label="Document title" value={value.documentTitle} set={(v)=>patch("documentTitle",v)} />
          <Text label="Subtitle" value={value.subtitle} set={(v)=>patch("subtitle",v)} />
          <Text label="Footer text" value={value.footerText} set={(v)=>patch("footerText",v)} />
          <Text label="Terms" value={value.terms} set={(v)=>patch("terms",v)} />
        </Group>
        <Group title="Header">
          <Toggle label="Show header" value={value.showHeader !== false} set={(v)=>patch("showHeader",v)} />
          <Text label="Header title override" value={value.headerTitle} set={(v)=>patch("headerTitle",v)} />
          <Toggle label="Show header title" value={!value.hideHeaderTitle} set={(v)=>patch("hideHeaderTitle",!v)} />
          <Text label="Header details override" value={value.headerDetails} set={(v)=>patch("headerDetails",v)} />
          <Toggle label="Show header details" value={!value.hideHeaderDetails} set={(v)=>patch("hideHeaderDetails",!v)} />
          <Select label="Company text alignment" value={value.headerCompanyAlign || "left"} set={(v)=>patch("headerCompanyAlign",v)} options={[["left","Left"],["center","Center"],["right","Right"]]} />
          <Select label="Logo position" value={value.logoPosition || "left"} set={(v)=>patch("logoPosition",v)} options={[["left","Left"],["center","Center"],["right","Right"]]} />
          <div className="rounded-lg border border-border bg-muted/30 p-2">
            <p className="mb-2 text-xs font-bold">Logo stretch preview</p>
            <CompanyLogo branding={branding} design={value} />
          </div>
          <LogoStretchControls
            stretchX={stretchX}
            stretchY={stretchY}
            onChange={(key, next) => patch(key, next)}
          />
          <Range label={"Logo proportional size · "+(value.logoSizePt || 0)+" pt"+(value.logoSizePt ? "" : " (company default)")} min={0} max={140} value={value.logoSizePt || 0} set={(v)=>patch("logoSizePt",Number(v))} />
          <Range label={"Logo width override · "+(value.logoWidthPt || 0)+" pt"+(value.logoWidthPt ? "" : " (use horizontal stretch)")} min={0} max={280} value={value.logoWidthPt || 0} set={(v)=>patch("logoWidthPt",Number(v))} />
          <Range label={"Logo height override · "+(value.logoHeightPt || 0)+" pt"+(value.logoHeightPt ? "" : " (use vertical stretch)")} min={0} max={200} value={value.logoHeightPt || 0} set={(v)=>patch("logoHeightPt",Number(v))} />
          <Range label={"Logo horizontal · "+(value.logoOffsetX || 0)+" pt"} min={-180} max={180} value={value.logoOffsetX || 0} set={(v)=>patch("logoOffsetX",Number(v))} />
          <Range label={"Logo vertical · "+(value.logoOffsetY || 0)+" pt"} min={-30} max={30} value={value.logoOffsetY || 0} set={(v)=>patch("logoOffsetY",Number(v))} />
        </Group>
        <Group title="Sections">
          <Toggle label="Project & customer card" value={value.showProjectCard} set={(v)=>patch("showProjectCard",v)} />
          <Toggle label="Company contact card" value={value.showCompanyCard !== false} set={(v)=>patch("showCompanyCard",v)} />
          <Text label="Employee name" value={value.companyEmployeeName} set={(v)=>patch("companyEmployeeName",v)} />
          <Text label="Employee title" value={value.companyEmployeeTitle} set={(v)=>patch("companyEmployeeTitle",v)} />
          <Text label="Employee email" value={value.companyEmployeeEmail} set={(v)=>patch("companyEmployeeEmail",v)} />
          <Text label="Employee phone" value={value.companyEmployeePhone} set={(v)=>patch("companyEmployeePhone",v)} />
          <Toggle label="Scope notes" value={value.showScope} set={(v)=>patch("showScope",v)} />
          <Toggle label="Line notes" value={value.showNotes} set={(v)=>patch("showNotes",v)} />
          <Toggle label="Page numbers" value={value.showPageNumbers} set={(v)=>patch("showPageNumbers",v)} />\n          <Toggle label="Contractor & customer signatures" value={value.showSignatures !== false} set={(v)=>patch("showSignatures",v)} />
        </Group>
        <Group title="Estimate columns">
          <p className="text-xs text-muted-foreground">Printed table is Buildr&apos;s Description, Qty, Unit Price, and Total. These toggles stay for the on-screen estimate only.</p>
          {[
            ["showItemType","Type"],["showCategory","Category"],["showDescription","Description"],["showQuantity","Quantity"],
            ["showUnit","Unit"],["showMaterial","Material"],["showLabor","Labor"],["showAmount","Amount"]
          ].map(([key,label])=><Toggle key={key} label={label} value={value[key]} set={(v)=>patch(key,v)} />)}
        </Group>
        <button type="button" onClick={()=>setShowAdvanced(v=>!v)} className="text-sm font-bold text-blue-600 dark:text-orange-500">{showAdvanced ? "Hide advanced layout" : "Advanced layout"}</button>
        {showAdvanced ? <div className="space-y-4">
          <Group title="Page">
            <Range label={"Page margin · "+value.margin+" pt"} min={18} max={72} value={value.margin} set={(v)=>patch("margin",Number(v))} />
            <Toggle label="Page outline" value={value.pageBorderEnabled} set={(v)=>patch("pageBorderEnabled",v)} />
            <Color label="Page outline color" value={value.pageBorderColor} set={(v)=>patch("pageBorderColor",v)} />
            <Range label={"Page outline width · "+value.pageBorderWidth+" pt"} min={0} max={6} step={0.25} value={value.pageBorderWidth} set={(v)=>patch("pageBorderWidth",Number(v))} />
            <Range label={"Page outline inset · "+value.pageBorderInset+" pt"} min={0} max={36} value={value.pageBorderInset} set={(v)=>patch("pageBorderInset",Number(v))} />
          </Group>

          <Group title="Header size & spacing">
            <Range label={"Header height · "+(value.headerHeightPt || "Auto")+" pt"} min={0} max={220} value={value.headerHeightPt} set={(v)=>patch("headerHeightPt",Number(v))} />
            <Range label={"Header inner padding · "+value.headerPaddingPt+" pt"} min={0} max={40} value={value.headerPaddingPt} set={(v)=>patch("headerPaddingPt",Number(v))} />
            <Range label={"Space below header · "+value.headerBottomGapPt+" pt"} min={0} max={60} value={value.headerBottomGapPt} set={(v)=>patch("headerBottomGapPt",Number(v))} />
            <Color label="Header fill color" value={value.headerFillColor} set={(v)=>patch("headerFillColor",v)} />
            <Toggle label="Header outline" value={value.headerBorderEnabled} set={(v)=>patch("headerBorderEnabled",v)} />
            <Color label="Header outline color" value={value.headerBorderColor} set={(v)=>patch("headerBorderColor",v)} />
            <Range label={"Header outline width · "+value.headerBorderWidth+" pt"} min={0} max={8} step={0.25} value={value.headerBorderWidth} set={(v)=>patch("headerBorderWidth",Number(v))} />
            <Toggle label="Header divider" value={value.headerDividerEnabled !== false} set={(v)=>patch("headerDividerEnabled",v)} />
            <Range label={"Header divider width · "+value.headerDividerWidth+" pt"} min={0} max={6} step={0.25} value={value.headerDividerWidth} set={(v)=>patch("headerDividerWidth",Number(v))} />
          </Group>

          <Group title="Cards">
            <Range label={"Card height · "+value.cardHeightPt+" pt"} min={36} max={140} value={value.cardHeightPt} set={(v)=>patch("cardHeightPt",Number(v))} />
            <Range label={"Card padding · "+value.cardPaddingPt+" pt"} min={2} max={30} value={value.cardPaddingPt} set={(v)=>patch("cardPaddingPt",Number(v))} />
            <Range label={"Card corner radius · "+value.cardRadiusPt+" pt"} min={0} max={24} value={value.cardRadiusPt} set={(v)=>patch("cardRadiusPt",Number(v))} />
            <Toggle label="Card fill" value={value.cardFillEnabled !== false} set={(v)=>patch("cardFillEnabled",v)} />
            <Color label="Card fill color" value={value.cardFillColor} set={(v)=>patch("cardFillColor",v)} />
            <Toggle label="Card outline" value={value.cardBorderEnabled !== false} set={(v)=>patch("cardBorderEnabled",v)} />
            <Color label="Card outline color" value={value.cardBorderColor} set={(v)=>patch("cardBorderColor",v)} />
            <Range label={"Card outline width · "+value.cardBorderWidth+" pt"} min={0} max={6} step={0.25} value={value.cardBorderWidth} set={(v)=>patch("cardBorderWidth",Number(v))} />
          </Group>

          <Group title="Section spacing">
            <Range label={"Title → cards · "+value.gapTitlePt+" pt"} min={0} max={60} value={value.gapTitlePt} set={(v)=>patch("gapTitlePt",Number(v))} />
            <Range label={"Cards spacing · "+value.gapCardsPt+" pt"} min={0} max={60} value={value.gapCardsPt} set={(v)=>patch("gapCardsPt",Number(v))} />
            <Range label={"Cards → scope · "+value.gapScopePt+" pt"} min={0} max={60} value={value.gapScopePt} set={(v)=>patch("gapScopePt",Number(v))} />
            <Range label={"Scope → table · "+value.gapTablePt+" pt"} min={0} max={60} value={value.gapTablePt} set={(v)=>patch("gapTablePt",Number(v))} />
            <Range label={"Table → totals · "+value.gapTotalsPt+" pt"} min={0} max={60} value={value.gapTotalsPt} set={(v)=>patch("gapTotalsPt",Number(v))} />
            <Range label={"Totals → terms · "+value.gapTermsPt+" pt"} min={0} max={80} value={value.gapTermsPt} set={(v)=>patch("gapTermsPt",Number(v))} />
            <Range label={"Terms → signatures · "+value.signatureTopGapPt+" pt"} min={0} max={100} value={value.signatureTopGapPt} set={(v)=>patch("signatureTopGapPt",Number(v))} />
          </Group>

          <Group title="Typography & table">
            <Select label="Table style" value={value.tableStyle} set={(v)=>patch("tableStyle",v)} options={[["grid","Grid"],["clean","Clean"],["striped","Striped"]]} />
            <Select label="Row density" value={value.density} set={(v)=>patch("density",v)} options={[["compact","Compact"],["comfortable","Comfortable"],["spacious","Spacious"]]} />
            <Range label={"Title size · "+value.titleSize+" pt"} min={12} max={32} value={value.titleSize} set={(v)=>patch("titleSize",Number(v))} />
            <Range label={"Body size · "+value.bodySize+" pt"} min={6} max={14} value={value.bodySize} set={(v)=>patch("bodySize",Number(v))} />
          </Group>
        </div> : null}
      </div>
      <div className="min-h-[42rem] rounded-xl border border-border bg-muted/30 p-2 xl:sticky xl:top-4 xl:h-[calc(100dvh-2rem)] xl:max-h-[calc(100dvh-2rem)]">
        <EstimatePdfPreview estimate={previewEstimate} live embedded />
      </div>
    </div>
  </section>;
}
function Group({title,children}){return <div className="space-y-2 rounded-xl border border-border p-3"><h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</h3>{children}</div>}
function Text({label,value,set}){return <label className="block"><span className="mb-1 block text-xs font-bold">{label}</span><input value={value||""} onChange={e=>set(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"/></label>}
function Toggle({label,value,set}){return <label className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><button type="button" onClick={()=>set(!value)} className={value?"text-blue-600 dark:text-orange-500":"text-muted-foreground"}>{value?<Eye className="h-4 w-4"/>:<EyeOff className="h-4 w-4"/>}</button></label>}
function Select({label,value,set,options}){return <label className="block"><span className="mb-1 block text-xs font-bold">{label}</span><select value={value} onChange={e=>set(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
function Range({label,min,max,step=1,value,set}){return <label className="block"><span className="mb-1 block text-xs font-bold">{label}</span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>set(e.target.value)} className="w-full"/></label>}
function Color({label,value,set}){return <label className="flex items-center justify-between gap-3"><span className="text-xs font-bold">{label}</span><span className="flex items-center gap-2"><input type="color" value={value||"#000000"} onChange={e=>set(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-input bg-background p-1"/><input value={value||""} onChange={e=>set(e.target.value)} className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-xs"/></span></label>}
