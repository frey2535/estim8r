import React, { useMemo, useState } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import EstimatePdfPreview from "./EstimatePdfPreview";

export const DEFAULT_PDF_DESIGN = {
  documentTitle: "Electrical Estimate",
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
  showPageNumbers: true,
  showHeader: true,
  headerCompanyAlign: "left",
  logoPosition: "left",
  logoOffsetX: 0,
  logoOffsetY: 0,
  logoSizePt: 0,
  logoWidthPt: 0,
  logoHeightPt: 0,
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
};

export function normalizePdfDesign(value = {}) {
  return { ...DEFAULT_PDF_DESIGN, ...(value && typeof value === "object" ? value : {}) };
}

export default function EstimatePdfDesigner({ estimate, design, onChange }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const value = useMemo(() => normalizePdfDesign(design), [design]);
  const patch = (key, next) => onChange?.({ ...value, [key]: next });
  const previewEstimate = useMemo(() => ({ ...estimate, pdfDesign: value }), [estimate, value]);

  return <section className="rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      <div><h2 className="text-lg font-black">PDF Designer</h2><p className="text-xs text-muted-foreground">Edit the customer estimate and see the actual generated PDF update while you work.</p></div>
      <div className="flex gap-2"><EstimatePdfPreview estimate={previewEstimate} live embedded /><button type="button" onClick={() => onChange?.(DEFAULT_PDF_DESIGN)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold"><RotateCcw className="h-3.5 w-3.5"/> Reset layout</button></div>
    </div>
    <div className="grid gap-5 p-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Group title="Document">
          <Text label="Document title" value={value.documentTitle} set={(v)=>patch("documentTitle",v)} />
          <Text label="Subtitle" value={value.subtitle} set={(v)=>patch("subtitle",v)} />
          <Text label="Footer text" value={value.footerText} set={(v)=>patch("footerText",v)} />
        </Group>
        <Group title="Header">\n          <Toggle label="Show header" value={value.showHeader !== false} set={(v)=>patch("showHeader",v)} />\n          <Text label="Header title override" value={value.headerTitle} set={(v)=>patch("headerTitle",v)} />\n          <Toggle label="Show header title" value={!value.hideHeaderTitle} set={(v)=>patch("hideHeaderTitle",!v)} />\n          <Text label="Header details override" value={value.headerDetails} set={(v)=>patch("headerDetails",v)} />\n          <Toggle label="Show header details" value={!value.hideHeaderDetails} set={(v)=>patch("hideHeaderDetails",!v)} />\n          <Select label="Company text alignment" value={value.headerCompanyAlign || "left"} set={(v)=>patch("headerCompanyAlign",v)} options={[["left","Left"],["center","Center"],["right","Right"]]} />\n          <Select label="Logo position" value={value.logoPosition || "left"} set={(v)=>patch("logoPosition",v)} options={[["left","Left"],["center","Center"],["right","Right"]]} />\n          <Range label={"Logo proportional size · "+(value.logoSizePt || 0)+" pt"+(value.logoSizePt ? "" : " (company default)")} min={0} max={140} value={value.logoSizePt || 0} set={(v)=>patch("logoSizePt",Number(v))} />\n          <Range label={"Logo width · "+(value.logoWidthPt || 0)+" pt"+(value.logoWidthPt ? "" : " (auto)")} min={0} max={220} value={value.logoWidthPt || 0} set={(v)=>patch("logoWidthPt",Number(v))} />\n          <Range label={"Logo height · "+(value.logoHeightPt || 0)+" pt"+(value.logoHeightPt ? "" : " (auto)")} min={0} max={140} value={value.logoHeightPt || 0} set={(v)=>patch("logoHeightPt",Number(v))} />\n          <Range label={"Logo horizontal · "+(value.logoOffsetX || 0)+" pt"} min={-180} max={180} value={value.logoOffsetX || 0} set={(v)=>patch("logoOffsetX",Number(v))} />\n          <Range label={"Logo vertical · "+(value.logoOffsetY || 0)+" pt"} min={-30} max={30} value={value.logoOffsetY || 0} set={(v)=>patch("logoOffsetY",Number(v))} />\n        </Group>\n        <Group title="Sections">
          <Toggle label="Project & customer card" value={value.showProjectCard} set={(v)=>patch("showProjectCard",v)} />\n          <Toggle label="Company contact card" value={value.showCompanyCard !== false} set={(v)=>patch("showCompanyCard",v)} />\n          <Text label="Employee name" value={value.companyEmployeeName} set={(v)=>patch("companyEmployeeName",v)} />\n          <Text label="Employee title" value={value.companyEmployeeTitle} set={(v)=>patch("companyEmployeeTitle",v)} />\n          <Text label="Employee email" value={value.companyEmployeeEmail} set={(v)=>patch("companyEmployeeEmail",v)} />\n          <Text label="Employee phone" value={value.companyEmployeePhone} set={(v)=>patch("companyEmployeePhone",v)} />
          <Toggle label="Scope notes" value={value.showScope} set={(v)=>patch("showScope",v)} />
          <Toggle label="Line notes" value={value.showNotes} set={(v)=>patch("showNotes",v)} />
          <Toggle label="Page numbers" value={value.showPageNumbers} set={(v)=>patch("showPageNumbers",v)} />\n          <Toggle label="Contractor & customer signatures" value={value.showSignatures !== false} set={(v)=>patch("showSignatures",v)} />
        </Group>
        <Group title="Estimate columns">
          {[
            ["showItemType","Type"],["showCategory","Category"],["showDescription","Description"],["showQuantity","Quantity"],
            ["showUnit","Unit"],["showMaterial","Material"],["showLabor","Labor"],["showAmount","Amount"]
          ].map(([key,label])=><Toggle key={key} label={label} value={value[key]} set={(v)=>patch(key,v)} />)}
        </Group>
        <button type="button" onClick={()=>setShowAdvanced(v=>!v)} className="text-sm font-bold text-blue-600 dark:text-orange-500">{showAdvanced ? "Hide advanced layout" : "Advanced layout"}</button>
        {showAdvanced ? <Group title="Layout">
          <Select label="Table style" value={value.tableStyle} set={(v)=>patch("tableStyle",v)} options={[["grid","Grid"],["clean","Clean"],["striped","Striped"]]} />
          <Select label="Row density" value={value.density} set={(v)=>patch("density",v)} options={[["compact","Compact"],["comfortable","Comfortable"],["spacious","Spacious"]]} />
          <Range label={"Title size · "+value.titleSize+" pt"} min={12} max={28} value={value.titleSize} set={(v)=>patch("titleSize",Number(v))} />
          <Range label={"Body size · "+value.bodySize+" pt"} min={7} max={12} value={value.bodySize} set={(v)=>patch("bodySize",Number(v))} />
          <Range label={"Page margin · "+value.margin+" pt"} min={20} max={72} value={value.margin} set={(v)=>patch("margin",Number(v))} />
        </Group> : null}
      </div>
      <div className="min-h-[42rem] rounded-xl border border-border bg-muted/30 p-2">
        <EstimatePdfPreview estimate={previewEstimate} live embedded />
      </div>
    </div>
  </section>;
}
function Group({title,children}){return <div className="space-y-2 rounded-xl border border-border p-3"><h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</h3>{children}</div>}
function Text({label,value,set}){return <label className="block"><span className="mb-1 block text-xs font-bold">{label}</span><input value={value||""} onChange={e=>set(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"/></label>}
function Toggle({label,value,set}){return <label className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><button type="button" onClick={()=>set(!value)} className={value?"text-blue-600 dark:text-orange-500":"text-muted-foreground"}>{value?<Eye className="h-4 w-4"/>:<EyeOff className="h-4 w-4"/>}</button></label>}
function Select({label,value,set,options}){return <label className="block"><span className="mb-1 block text-xs font-bold">{label}</span><select value={value} onChange={e=>set(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
function Range({label,min,max,value,set}){return <label className="block"><span className="mb-1 block text-xs font-bold">{label}</span><input type="range" min={min} max={max} value={value} onChange={e=>set(e.target.value)} className="w-full"/></label>}
