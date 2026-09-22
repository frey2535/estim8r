import React from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card data-testid="estimate-line-card" className={`overflow-hidden shadow-sm ${omitted ? "opacity-60" : ""}`}>
      <div className="flex">
        <div className="w-1.5 shrink-0 bg-blue-600 dark:bg-orange-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <CardHeader className="space-y-3 border-b border-border bg-muted/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Line {index + 1}</p>
                <CardTitle className="mt-1 text-lg font-black leading-snug">{title}</CardTitle>
                {subtitle ? <CardDescription className="mt-1">{subtitle}</CardDescription> : null}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {row.itemType ? <Badge variant="secondary">{row.itemType}</Badge> : null}
                  {row.category ? <Badge variant="outline">{row.category}</Badge> : null}
                  {row.laborItemId ? <Badge variant="outline">{row.laborItemId}</Badge> : null}
                  {notice ? (
                    <Badge
                      variant={notice.tone === "unmatched" ? "destructive" : "outline"}
                      className={notice.tone === "unverified" || notice.tone === "overridden" ? "border-amber-500/50 text-amber-800 dark:text-amber-200" : ""}
                    >
                      {notice.badge}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="text-sm sm:text-right">
                  <p className="font-semibold">{qty} {row.unit || "EA"}</p>
                  <p className="text-xs text-muted-foreground">{hours.toFixed(2)} hrs</p>
                  <p className="text-xs font-semibold">${material.toFixed(2)} mat · ${labor.toFixed(2)} lab</p>
                </div>
                {itemized ? (
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={row.included !== false}
                      onChange={(e) => onPatch?.(row.id, "included", e.target.checked)}
                      aria-label={`Include ${includeLabel}`}
                    />
                    Include
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={!canDelete}
                  className="rounded-lg p-2 text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Delete line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {notice ? (
              <p className={`text-xs ${notice.tone === "unmatched" ? "font-semibold text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}>
                {notice.text}
              </p>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-5 p-4">
            <FieldGroup title="Classification">
              <Field label="Type">
                <Sel value={row.itemType} vals={LINE_TYPES} set={(v) => onPatch?.(row.id, "itemType", v)} placeholder="Select type" />
              </Field>
              <Field label="Category">
                <Sel
                  value={row.category}
                  vals={categoriesForType(row.itemType)}
                  set={(v) => onPatch?.(row.id, "category", v)}
                  placeholder={row.itemType ? "Select category" : "Select type first"}
                />
              </Field>
              <Field label="Work category">
                <Sel
                  value={row.workCategory || workCategoryForEstimateLine(row)}
                  vals={WORK_CATEGORY_ORDER}
                  set={(v) => onPatch?.(row.id, "workCategory", v)}
                />
              </Field>
              <div className="min-w-0 sm:col-span-2 lg:col-span-3">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">Labor item</span>
                <LaborItemPicker
                  items={library}
                  value={row.laborItemId}
                  itemType={row.itemType}
                  category={row.category}
                  placeholder={laborPickerPlaceholder(row)}
                  onSelect={(item) => onPickLabor?.(row, item)}
                />
              </div>
              <Field label="Item / description" className="sm:col-span-2 lg:col-span-3">
                <Cell value={row.description} set={(v) => onPatch?.(row.id, "description", v)} placeholder="Job description (does not change labor)" />
              </Field>
            </FieldGroup>

            <FieldGroup title="Quantity" columns="sm:grid-cols-2 lg:grid-cols-2">
              <Field label="Qty">
                <Cell type="number" value={row.quantity} set={(v) => onPatch?.(row.id, "quantity", v)} />
                {qtyHint ? <p className="mt-1 text-xs text-muted-foreground">{qtyHint}</p> : null}
              </Field>
              <Field label="Unit">
                <Sel value={row.unit} vals={UNITS} set={(v) => onPatch?.(row.id, "unit", v)} />
              </Field>
            </FieldGroup>

            <FieldGroup title="Money">
              <Field label="Material $/unit">
                <Cell type="number" value={row.materialUnitCost} set={(v) => onPatch?.(row.id, "materialUnitCost", v)} />
              </Field>
              <Field label="MH/unit">
                <Cell type="number" value={row.laborMhPerUnit} set={(v) => onPatch?.(row.id, "laborMhPerUnit", v)} />
              </Field>
              <Field label="Labor $/hr">
                <Cell type="number" value={row.laborRate} set={(v) => onPatch?.(row.id, "laborRate", v)} />
              </Field>
              <Readout label="Hours" value={hours.toFixed(2)} />
              <Readout label="Material" value={`$${material.toFixed(2)}`} />
              <Readout label="Labor" value={`$${labor.toFixed(2)}`} />
            </FieldGroup>

            <FieldGroup title="Notes" columns="sm:grid-cols-1">
              <Field label="Notes">
                <Cell value={row.notes} set={(v) => onPatch?.(row.id, "notes", v)} />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleSources}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                >
                  {sourcesOpen ? "Hide sources" : "Labor source"}
                </button>
              </div>
              {sourcesOpen ? (
                <LaborSourceSelector
                  options={sourceOptions}
                  selectedSource={row.laborSelection?.selectedSource}
                  acknowledged={row.laborSelection?.acknowledgedUnverified}
                  onSelect={onSelectSource}
                  onAcknowledge={onAcknowledge}
                />
              ) : null}
            </FieldGroup>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

function FieldGroup({ title, children, columns = "sm:grid-cols-2 lg:grid-cols-3" }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
      <div className={`grid grid-cols-1 gap-3 ${columns}`}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Cell({ value, set, type = "text", placeholder = "" }) {
  return <input type={type} step={type === "number" ? "0.01" : undefined} value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-2" />;
}

function Sel({ value, vals, set, placeholder = "" }) {
  const options = vals.includes(value) || !value ? vals : [value, ...vals];
  return (
    <select value={value} onChange={(e) => set(e.target.value)} className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-2">
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function Readout({ label, value }) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      <div className="rounded-md border border-transparent bg-muted/50 px-3 py-2 font-semibold">{value}</div>
    </div>
  );
}
