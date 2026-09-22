import React, { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import LaborItemPicker from "@/components/estimate/LaborItemPicker";
import LaborSourceSelector from "@/components/labor/LaborSourceSelector";
import { categoriesForType, laborPickerPlaceholder, LINE_TYPES } from "@/domain/estimate/lineLaborCatalog";
import {
  conduitQtyHint,
  estimateLineHours,
  estimateLineLaborCost,
  findLibraryItem,
  laborItemLabel,
} from "@/domain/estimate/manualLineLabor";
import { estimateLineLaborNotice, estimateLineTitle } from "@/domain/estimate/linePresentation";
import { WORK_CATEGORY_ORDER, workCategoryForEstimateLine } from "@/domain/estimate/trueElectricalTakeoff";

const UNITS = ["STICK", "EA", "LF", "SF", "FT", "100 LF", "1000 LF", "HR", "DAY", "LOT"];

export default function EstimateLineCard({
  row,
  index = 0,
  library = [],
  itemized = false,
  sourcesOpen = false,
  canDelete = true,
  sourceOptions = [],
  onPatch,
  onPickLabor,
  onToggleSources,
  onDelete,
  onSelectSource,
  onAcknowledge,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const laborItem = findLibraryItem(library, row);
  const qty = Number(row.quantity) || 0;
  const material = qty * (Number(row.materialUnitCost) || 0);
  const hours = estimateLineHours(row, laborItem);
  const labor = estimateLineLaborCost(row, laborItem);
  const qtyHint = conduitQtyHint(row, laborItem);
  const title = estimateLineTitle(row, laborItem);
  const pickLabel = laborItemLabel(laborItem);
  const description = String(row.description || "").trim();
  const subtitle = pickLabel && description && description !== pickLabel ? description : "";
  const notice = estimateLineLaborNotice(row);
  const omitted = itemized && row.included === false;
  const includeLabel = title === "New line" ? "line" : title;
  const showNoticeText = notice && (notice.tone === "unmatched" || detailsOpen);

  return (
    <Card data-testid="estimate-line-card" className={`overflow-hidden shadow-sm ${omitted ? "opacity-60" : ""}`}>
      <div className="flex">
        <div className="w-1 shrink-0 bg-blue-600 dark:bg-orange-500" aria-hidden />
        <div className="min-w-0 flex-1 p-2.5 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Line {index + 1}</span>
                <h3 className="text-sm font-black leading-tight">{title}</h3>
              </div>
              {subtitle ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p> : null}
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {row.itemType ? <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{row.itemType}</Badge> : null}
                {row.category ? <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{row.category}</Badge> : null}
                {row.laborItemId ? <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{row.laborItemId}</Badge> : null}
                {notice ? (
                  <Badge
                    variant={notice.tone === "unmatched" ? "destructive" : "outline"}
                    className={`px-1.5 py-0 text-[10px] ${notice.tone === "unverified" || notice.tone === "overridden" ? "border-amber-500/50 text-amber-800 dark:text-amber-200" : ""}`}
                  >
                    {notice.badge}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <div className="text-right text-xs">
                <p className="font-semibold">{qty} {row.unit || "EA"}</p>
                <p className="text-muted-foreground">{hours.toFixed(2)} hrs</p>
                <p className="font-semibold">${labor.toFixed(2)} lab</p>
              </div>
              {itemized ? (
                <label className="flex items-center gap-1 text-[10px] font-semibold">
                  <input
                    type="checkbox"
                    checked={row.included !== false}
                    onChange={(e) => onPatch?.(row.id, "included", e.target.checked)}
                    aria-label={`Include ${includeLabel}`}
                  />
                  In
                </label>
              ) : null}
              <button
                type="button"
                onClick={onDelete}
                disabled={!canDelete}
                className="rounded-md p-1 text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Delete line"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {showNoticeText ? (
            <p className={`mt-1 text-[11px] ${notice.tone === "unmatched" ? "font-semibold text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}>
              {notice.text}
            </p>
          ) : null}

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-7">
            <Field label="Type">
              <Sel value={row.itemType} vals={LINE_TYPES} set={(v) => onPatch?.(row.id, "itemType", v)} placeholder="Type" />
            </Field>
            <Field label="Category">
              <Sel
                value={row.category}
                vals={categoriesForType(row.itemType)}
                set={(v) => onPatch?.(row.id, "category", v)}
                placeholder={row.itemType ? "Category" : "Type first"}
              />
            </Field>
            <div className="col-span-2 min-w-0 sm:col-span-2">
              <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Labor item</span>
              <LaborItemPicker
                items={library}
                value={row.laborItemId}
                itemType={row.itemType}
                category={row.category}
                placeholder={laborPickerPlaceholder(row)}
                onSelect={(item) => onPickLabor?.(row, item)}
              />
            </div>
            <Field label="Qty">
              <Cell type="number" value={row.quantity} set={(v) => onPatch?.(row.id, "quantity", v)} />
            </Field>
            <Field label="Unit">
              <Sel value={row.unit} vals={UNITS} set={(v) => onPatch?.(row.id, "unit", v)} />
            </Field>
            <Field label="MH/unit">
              <Cell type="number" value={row.laborMhPerUnit} set={(v) => onPatch?.(row.id, "laborMhPerUnit", v)} />
            </Field>
          </div>
          {qtyHint ? <p className="mt-1 text-[11px] text-muted-foreground">{qtyHint}</p> : null}

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mt-2">
            <CollapsibleTrigger className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
              {detailsOpen ? "Hide details" : "Details"}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Work category" className="col-span-2 sm:col-span-1">
                  <Sel
                    value={row.workCategory || workCategoryForEstimateLine(row)}
                    vals={WORK_CATEGORY_ORDER}
                    set={(v) => onPatch?.(row.id, "workCategory", v)}
                  />
                </Field>
                <Field label="Item / description" className="col-span-2">
                  <Cell value={row.description} set={(v) => onPatch?.(row.id, "description", v)} placeholder="Job description (does not change labor)" />
                </Field>
                <Field label="Model">
                  <Cell value={row.model || ""} set={(v) => onPatch?.(row.id, "model", v)} placeholder="If known" />
                </Field>
                <Field label="Labor $/hr">
                  <Cell type="number" value={row.laborRate} set={(v) => onPatch?.(row.id, "laborRate", v)} />
                </Field>
                <Field label="Material $/unit">
                  <Cell type="number" value={row.materialUnitCost} set={(v) => onPatch?.(row.id, "materialUnitCost", v)} />
                </Field>
                <Readout label="Hours" value={hours.toFixed(2)} />
                <Readout label="Material" value={`$${material.toFixed(2)}`} />
                <Readout label="Labor" value={`$${labor.toFixed(2)}`} />
                <Field label="Notes" className="col-span-2 sm:col-span-4">
                  <Cell value={row.notes} set={(v) => onPatch?.(row.id, "notes", v)} />
                </Field>
              </div>
              <button
                type="button"
                onClick={onToggleSources}
                className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted"
              >
                {sourcesOpen ? "Hide sources" : "Labor source"}
              </button>
              {sourcesOpen ? (
                <LaborSourceSelector
                  options={sourceOptions}
                  selectedSource={row.laborSelection?.selectedSource}
                  acknowledged={row.laborSelection?.acknowledgedUnverified}
                  onSelect={onSelectSource}
                  onAcknowledge={onAcknowledge}
                />
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Cell({ value, set, type = "text", placeholder = "" }) {
  return <input type={type} step={type === "number" ? "0.01" : undefined} value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm" />;
}

function Sel({ value, vals, set, placeholder = "" }) {
  const options = vals.includes(value) || !value ? vals : [value, ...vals];
  return (
    <select value={value} onChange={(e) => set(e.target.value)} className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function Readout({ label, value }) {
  return (
    <div className="min-w-0">
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="rounded-md bg-muted/50 px-2 py-1.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
