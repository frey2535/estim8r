import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { compositeWage, defaultCrew } from "@/domain/labor/employeeClasses";
import { openEstimateSession, writeEstimate, writeWageBook } from "@/domain/estimate/estimateStore";
import { estimateFileNameForSave, estimateGrandTotal, isDrawingFileName } from "@/domain/estimate/projectDocuments";
import SaveProjectDocuments from "@/components/estimate/SaveProjectDocuments";
import EstimatePdfActions from "@/components/estimate/EstimatePdfActions";
import { listCompanyLaborUnits, listCustomLabor, listLaborLibrary, listNamedCrews, saveLaborRates, saveNamedCrew } from "@/api/laborRepository";
import { defaultProductivityFactors, setFactorMultiplier } from "@/domain/labor/productivity";
import { applySelectionToLine, buildLaborSourceOptions, makeLaborSelection } from "@/domain/labor/selection";
import { findCustomLabor } from "@/domain/labor/customLabor";
import { crewFromNamed, namedFromCrew } from "@/domain/labor/crews";
import { defaultLaborRates } from "@/domain/labor/rates";
import LaborSourceSelector from "@/components/labor/LaborSourceSelector";
import ProductivityFactorEditor from "@/components/labor/ProductivityFactorEditor";
import NamedCrewPicker from "@/components/labor/NamedCrewPicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_VISIBLE_TOTALS, resolveVisibleTotals, setAllLinesIncluded, TOTAL_OPTIONS } from "@/domain/estimate/presentation";
import { calculateBidByScope, calculateWorkCategoryBreakdown, WORK_CATEGORY_ORDER, workCategoryForEstimateLine } from "@/domain/estimate/trueElectricalTakeoff";

const ITEM_TYPES = ["Material", "Labor", "Equipment", "Subcontract", "Allowance", "Fixture", "Device", "Conduit", "Wire", "Gear", "Other"];
const UNITS = ["EA", "LF", "SF", "FT", "100 LF", "1000 LF", "HR", "DAY", "LOT"];

function blankLine(rate) {
  return {
    id: crypto.randomUUID(),
    takeoffKey: "",
    source: "manual",
    itemType: "Material",
    category: "",
    description: "",
    quantity: 1,
    unit: "EA",
    materialUnitCost: 0,
    laborMhPerUnit: 0,
    laborRate: rate,
    notes: "",
    included: true,
    quantityEdited: true,
    laborRateEdited: false,
    laborMhEdited: true,
  };
}

const emptyHeader = {
  projectName: "",
  projectAddress: "",
  estimateNumber: "",
  customerCompany: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  estimatorName: "",
  bidDue: "",
  scopeNotes: "",
};

export default function EstimateBuilder() {
  const [params] = useSearchParams();
  const openFile = params.get("file") || "";
  const openSize = Number(params.get("size") || 0);
  const [header, setHeader] = useState(emptyHeader);
  const [crew, setCrew] = useState(() => defaultCrew());
  const [lines, setLines] = useState(() => [blankLine(68)]);
  const [contingency, setContingency] = useState(0);
  const [overhead, setOverhead] = useState(10);
  const [profit, setProfit] = useState(10);
  const [bondInsurance, setBondInsurance] = useState(0);
  const [itemized, setItemized] = useState(false);
  const [visibleTotals, setVisibleTotals] = useState(DEFAULT_VISIBLE_TOTALS);
  const [meta, setMeta] = useState({ fileName: "", fileSize: 0, scopeEdited: false });
  const [ready, setReady] = useState(false);
  const [factors, setFactors] = useState(() => defaultProductivityFactors());
  const [namedCrews, setNamedCrews] = useState([]);
  const [namedCrewId, setNamedCrewId] = useState("");
  const [library, setLibrary] = useState([]);
  const [companyUnits, setCompanyUnits] = useState([]);
  const [customUnits, setCustomUnits] = useState([]);
  const [openSources, setOpenSources] = useState("");
  const [trueTakeoff, setTrueTakeoff] = useState(null);
  const wage = compositeWage(crew);

  useEffect(() => {
    const stored = openEstimateSession({ fileName: openFile, fileSize: openSize });
    if (stored) {
      const nextCrew = stored.crew?.length ? stored.crew : defaultCrew();
      setHeader({ ...emptyHeader, ...stored.header });
      setCrew(nextCrew);
      setLines(stored.lines?.length ? stored.lines : [blankLine(compositeWage(nextCrew).rate)]);
      setContingency(stored.contingency ?? 0);
      setOverhead(stored.overhead ?? 10);
      setProfit(stored.profit ?? 10);
      setBondInsurance(stored.bondInsurance ?? 0);
      setItemized(Boolean(stored.itemized));
      setVisibleTotals(resolveVisibleTotals(stored));
      setFactors(stored.factors?.length ? stored.factors : defaultProductivityFactors());
      setNamedCrewId(stored.namedCrewId || "");
      setMeta({ fileName: stored.fileName || "", fileSize: stored.fileSize || 0, scopeEdited: Boolean(stored.scopeEdited) });
      setTrueTakeoff(stored.trueTakeoff || null);
    } else {
      const nextCrew = defaultCrew();
      setHeader({ ...emptyHeader });
      setCrew(nextCrew);
      setLines([blankLine(compositeWage(nextCrew).rate)]);
      setContingency(0);
      setOverhead(10);
      setProfit(10);
      setBondInsurance(0);
      setItemized(false);
      setVisibleTotals(DEFAULT_VISIBLE_TOTALS);
      setFactors(defaultProductivityFactors());
      setNamedCrewId("");
      setMeta({ fileName: "", fileSize: 0, scopeEdited: false });
      setTrueTakeoff(null);
    }
    setReady(true);
  }, [openFile, openSize]);

  useEffect(() => {
    listLaborLibrary({ limit: 2500 }).then(setLibrary).catch(() => setLibrary([]));
    listCompanyLaborUnits().then(setCompanyUnits).catch(() => setCompanyUnits([]));
    listCustomLabor().then(setCustomUnits).catch(() => setCustomUnits([]));
    listNamedCrews().then(setNamedCrews).catch(() => setNamedCrews([]));
  }, []);

  const storageFileName = estimateFileNameForSave({ fileName: meta.fileName, projectName: header.projectName });

  useEffect(() => {
    if (!ready) return;
    writeWageBook(crew);
    if (!storageFileName) return;
    writeEstimate({
      version: 1,
      fileName: storageFileName,
      fileSize: meta.fileSize || 0,
      header,
      crew,
      factors,
      namedCrewId,
      contingency: Number(contingency) || 0,
      overhead: Number(overhead) || 0,
      profit: Number(profit) || 0,
      bondInsurance: Number(bondInsurance) || 0,
      lines,
      itemized,
      visibleTotals,
      separateFromTakeoff: true,
      scopeEdited: meta.scopeEdited,
      trueTakeoff,
    });
  }, [ready, header, crew, lines, contingency, overhead, profit, bondInsurance, itemized, visibleTotals, meta, factors, namedCrewId, trueTakeoff, storageFileName]);

  const draft = useMemo(() => ({
    version: 1,
    fileName: storageFileName,
    fileSize: meta.fileSize || 0,
    header,
    crew,
    factors,
    namedCrewId,
    contingency: Number(contingency) || 0,
    overhead: Number(overhead) || 0,
    profit: Number(profit) || 0,
    bondInsurance: Number(bondInsurance) || 0,
    lines,
    itemized,
    visibleTotals,
    separateFromTakeoff: true,
    scopeEdited: meta.scopeEdited,
    trueTakeoff,
  }), [header, crew, factors, namedCrewId, contingency, overhead, profit, bondInsurance, lines, itemized, visibleTotals, meta, trueTakeoff, storageFileName]);

  const totals = useMemo(() => estimateGrandTotal(draft), [draft]);
  const cont = totals.contingency || 0;
  const oh = totals.overhead;
  const prof = totals.profit;
  const bond = totals.bondInsurance || 0;
  const grand = totals.total;
  const scopeTotals = useMemo(() => (
    trueTakeoff?.analysis
      ? calculateBidByScope(lines, {
          contingency: Number(contingency) || 0,
          overhead: Number(overhead) || 0,
          profit: Number(profit) || 0,
          bondInsurance: Number(bondInsurance) || 0,
        })
      : {}
  ), [trueTakeoff, lines, contingency, overhead, profit, bondInsurance]);
  const workCategoryTotals = useMemo(
    () => calculateWorkCategoryBreakdown(lines),
    [lines],
  );

  function setHeaderField(key, value) {
    setHeader((current) => ({ ...current, [key]: value }));
  }

  function applyCrew(next) {
    const rate = compositeWage(next).rate;
    setCrew(next);
    setLines((current) => current.map((line) => (line.laborRateEdited ? line : { ...line, laborRate: rate })));
    saveLaborRates(defaultLaborRates(Object.fromEntries(next.map((row) => [row.id, row.wage]))));
  }

  function toggleClass(id) {
    applyCrew(crew.map((row) => {
      if (row.id !== id) return row;
      const selected = !row.selected;
      return { ...row, selected, headcount: selected ? Math.max(1, Number(row.headcount) || 1) : 0 };
    }));
  }

  function patchLine(id, key, value) {
    setLines((current) => current.map((line) => {
      if (line.id !== id) return line;
      const next = { ...line, [key]: value };
      if (key === "quantity" || key === "unit") next.quantityEdited = true;
      if (key === "laborMhPerUnit") {
        next.laborMhEdited = true;
        if (next.laborSelection) {
          next.laborSelection = {
            ...next.laborSelection,
            estimatorOverrideMhPerUnit: Number(value) || 0,
            overrideReason: next.laborSelection.overrideReason || "Estimator override",
            effectiveMhPerUnit: Number(value) || 0,
          };
        }
      }
      if (key === "laborRate") next.laborRateEdited = true;
      if (key === "materialUnitCost") next.materialCostEdited = true;
      return next;
    }));
  }

  function lineOptions(line) {
    const item = library.find((row) => row.id === line.laborItemId)
      || library.find((row) => row.item_name === line.description && (!line.unit || row.unit === line.unit));
    const company = companyUnits.find((row) => (row.labor_item_id || row.laborItemId) === (item?.id || line.laborItemId));
    const custom = findCustomLabor(customUnits, { laborItemId: item?.id || line.laborItemId, itemName: line.description, unit: line.unit });
    return buildLaborSourceOptions({ laborItem: item, companyUnit: company, customUnit: custom });
  }

  function selectSource(line, option) {
    const selection = makeLaborSelection({
      laborItemId: line.laborItemId || "",
      option,
      factors,
      acknowledgedUnverified: line.laborSelection?.acknowledgedUnverified || false,
    });
    setLines((current) => current.map((row) => (
      row.id === line.id ? applySelectionToLine(row, selection, { rate: wage.rate }) : row
    )));
  }

  function acknowledgeLine(line, acknowledged) {
    if (!line.laborSelection) return;
    setLines((current) => current.map((row) => (
      row.id === line.id ? { ...row, laborSelection: { ...row.laborSelection, acknowledgedUnverified: acknowledged } } : row
    )));
  }

  function changeFactor(code, multiplier) {
    const next = setFactorMultiplier(factors, code, multiplier);
    setFactors(next);
    setLines((current) => current.map((line) => {
      if (!line.laborSelection || line.laborMhEdited) return line;
      const selection = { ...line.laborSelection, factors: next };
      return applySelectionToLine(line, makeLaborSelection({
        laborItemId: selection.laborItemId,
        option: {
          sourceType: selection.selectedSource,
          mh: selection.baseMhPerUnit,
          sourceRecordId: selection.sourceRecordId,
          sourceName: selection.sourceName,
          verificationStatus: selection.verificationStatus,
          productionAllowed: false,
          warning: selection.notes,
        },
        factors: next,
        acknowledgedUnverified: selection.acknowledgedUnverified,
      }), { rate: wage.rate });
    }));
  }

  async function saveCrew(name) {
    const named = namedFromCrew(name, crew, { id: namedCrewId || undefined });
    const saved = await saveNamedCrew(named);
    setNamedCrews((current) => [saved, ...current.filter((row) => row.id !== saved.id)]);
    setNamedCrewId(saved.id);
  }

  function loadCrew(id) {
    setNamedCrewId(id);
    if (!id) return;
    const named = namedCrews.find((row) => row.id === id);
    if (named) applyCrew(crewFromNamed(named));
  }

  return (
    <div className="w-full min-w-0 space-y-5 py-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-orange-500">Estimate Builder</p>
        <h1 className="text-3xl font-black">Electrical Estimate</h1>
        <p className="text-sm text-muted-foreground">
          Add items, quantities, labor, and markup here. Drawings and takeoff are optional and do not have to be started to save.
          {isDrawingFileName(meta.fileName) ? ` Drawing: ${meta.fileName}.` : ""}
        </p>
        <Link to="/takeoff" className="mt-2 inline-block text-sm font-semibold text-blue-600 dark:text-orange-500">Back to takeoff</Link>
        <div className="mt-3">
          {ready && <SaveProjectDocuments estimate={draft} onProjectName={(name) => setHeaderField("projectName", name)} />}
        </div>
      </div>

      <Tabs defaultValue="estimate" className="w-full min-w-0">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/70 p-1">
          <TabsTrigger value="estimate" className="px-4 py-2">Estimate</TabsTrigger>
          <TabsTrigger value="labor-markup" className="px-4 py-2">Labor &amp; markup</TabsTrigger>
          {draft.trueTakeoff?.analysis ? <TabsTrigger value="audit" className="px-4 py-2">Takeoff Audit</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="estimate" className="mt-4 space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">Project &amp; Customer</h2>
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Field label="Project name" value={header.projectName} set={(v) => setHeaderField("projectName", v)} required hint="Required to save" />
          <Field label="Estimate #" value={header.estimateNumber} set={(v) => setHeaderField("estimateNumber", v)} />
          <Field label="Customer / company" value={header.customerCompany} set={(v) => setHeaderField("customerCompany", v)} />
          <Field label="Contact name" value={header.customerName} set={(v) => setHeaderField("customerName", v)} />
          <Field label="Phone" type="tel" value={header.customerPhone} set={(v) => setHeaderField("customerPhone", v)} />
          <Field label="Email" type="email" value={header.customerEmail} set={(v) => setHeaderField("customerEmail", v)} />
          <Field label="Estimator" value={header.estimatorName} set={(v) => setHeaderField("estimatorName", v)} />
          <Field label="Bid due" type="datetime-local" value={header.bidDue} set={(v) => setHeaderField("bidDue", v)} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Field label="Project address" value={header.projectAddress} set={(v) => setHeaderField("projectAddress", v)} />
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-bold text-muted-foreground">Scope notes</span>
            <textarea value={header.scopeNotes} onChange={(e) => { setMeta((current) => ({ ...current, scopeEdited: true })); setHeaderField("scopeNotes", e.target.value); }} rows={4} className="w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2.5" />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Estimate Lines</h2>
            <p className="text-xs text-muted-foreground">Add quantities here. If this estimate came from takeoff, those quantities stay editable and do not change the takeoff sheet. Man-hours come from the labor library. Labor rate follows the selected classes unless you edit a line.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold">
              <input type="checkbox" checked={itemized} onChange={(e) => setItemized(e.target.checked)} />
              Itemized estimate
            </label>
            {itemized ? (
              <>
                <button type="button" onClick={() => setLines((current) => setAllLinesIncluded(current, true))} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                  Check all
                </button>
                <button type="button" onClick={() => setLines((current) => setAllLinesIncluded(current, false))} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                  Uncheck all
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => setLines((current) => [...current, blankLine(wage.rate)])} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white dark:bg-orange-500">
              <Plus className="h-4 w-4" />Add line
            </button>
          </div>
        </div>
        <div className="divide-y divide-border">
          {lines.map((row) => {
            const qty = Number(row.quantity) || 0;
            const mat = qty * (Number(row.materialUnitCost) || 0);
            const hours = qty * (Number(row.laborMhPerUnit) || 0);
            const lab = hours * (Number(row.laborRate) || 0);
            return (
              <div key={row.id} className={`grid grid-cols-1 gap-2 p-3 min-[520px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 ${itemized && row.included === false ? "opacity-60" : ""}`}>
                {itemized ? (
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={row.included !== false}
                      onChange={(e) => patchLine(row.id, "included", e.target.checked)}
                      aria-label={`Include ${row.description || "line"}`}
                    />
                    Include
                  </label>
                ) : null}
                <Field label="Type"><Sel value={row.itemType} vals={ITEM_TYPES} set={(v) => patchLine(row.id, "itemType", v)} /></Field>
                <Field label="Category"><Cell value={row.category} set={(v) => patchLine(row.id, "category", v)} /></Field>
                <Field label="Work category">
                  <Sel
                    value={row.workCategory || workCategoryForEstimateLine(row)}
                    vals={WORK_CATEGORY_ORDER}
                    set={(v) => patchLine(row.id, "workCategory", v)}
                  />
                </Field>
                <Field label="Item / description" className="min-[520px]:col-span-2"><Cell value={row.description} set={(v) => patchLine(row.id, "description", v)} placeholder="Item description" /></Field>
                <Field label="Qty"><Cell type="number" value={row.quantity} set={(v) => patchLine(row.id, "quantity", v)} /></Field>
                <Field label="Unit"><Sel value={row.unit} vals={UNITS} set={(v) => patchLine(row.id, "unit", v)} /></Field>
                <Field label="Material $/unit"><Cell type="number" value={row.materialUnitCost} set={(v) => patchLine(row.id, "materialUnitCost", v)} /></Field>
                <Field label="MH/unit"><Cell type="number" value={row.laborMhPerUnit} set={(v) => patchLine(row.id, "laborMhPerUnit", v)} /></Field>
                <Field label="Labor $/hr"><Cell type="number" value={row.laborRate} set={(v) => patchLine(row.id, "laborRate", v)} /></Field>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">Hours</span>
                  <div className="rounded-lg border border-transparent px-3 py-2.5 font-semibold">{hours.toFixed(2)}</div>
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">Material</span>
                  <div className="rounded-lg border border-transparent px-3 py-2.5 font-semibold">${mat.toFixed(2)}</div>
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">Labor</span>
                  <div className="rounded-lg border border-transparent px-3 py-2.5 font-semibold">${lab.toFixed(2)}</div>
                </label>
                <Field label="Notes" className="min-[520px]:col-span-2"><Cell value={row.notes} set={(v) => patchLine(row.id, "notes", v)} /></Field>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={() => setOpenSources((current) => current === row.id ? "" : row.id)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                    {openSources === row.id ? "Hide sources" : "Labor source"}
                  </button>
                  <button type="button" onClick={() => setLines((current) => (current.length === 1 ? current : current.filter((item) => item.id !== row.id)))} className="p-2 text-destructive" aria-label="Delete line">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {openSources === row.id ? (
                  <div className="min-[520px]:col-span-2 md:col-span-3 xl:col-span-4 2xl:col-span-6">
                    <LaborSourceSelector
                      options={lineOptions(row)}
                      selectedSource={row.laborSelection?.selectedSource}
                      acknowledged={row.laborSelection?.acknowledgedUnverified}
                      onSelect={(option) => selectSource(row, option)}
                      onAcknowledge={(value) => acknowledgeLine(row, value)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-bold">Estimate PDF</h2>
          <p className="mt-1 text-xs text-muted-foreground">Download or print the customer estimate. Company branding is set in Settings.</p>
          <div className="mt-3">
            <EstimatePdfActions estimate={draft} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-bold">Totals on this estimate</h2>
          <p className="mt-1 text-xs text-muted-foreground">Choose which totals appear here and on the customer PDF. Overhead and profit stay on Labor &amp; markup unless you turn them on.</p>
          <div className="mt-3 grid gap-2">
            {TOTAL_OPTIONS.map((option) => (
              <label key={option.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(visibleTotals[option.key])}
                  onChange={(e) => setVisibleTotals((current) => ({ ...current, [option.key]: e.target.checked }))}
                />
                {option.label}
              </label>
            ))}
          </div>
          <div className="mt-4">
            {visibleTotals.material ? <Sum label="Material Total" value={totals.material} /> : null}
            {visibleTotals.labor ? <Sum label="Labor Total" value={totals.labor} /> : null}
            {visibleTotals.overhead ? <Sum label="Overhead" value={oh} /> : null}
            {visibleTotals.profit ? <Sum label="Profit" value={prof} /> : null}
            {visibleTotals.total ? (
              <div className="mt-3 flex justify-between border-t border-border pt-4 text-xl font-black">
                <span>Total</span>
                <span className="text-blue-600 dark:text-orange-500">${grand.toFixed(2)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
        </TabsContent>

        <TabsContent value="labor-markup" className="mt-4 space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Employee class &amp; wage</h2>
            <p className="text-xs text-muted-foreground">Select one or more classes. Default is Journeyman at the Journeyman wage. Wages are dollars per man-hour. These values stay off the estimate and the PDF.</p>
          </div>
          <p className="text-sm font-bold">Crew rate ${wage.rate.toFixed(2)}/MH · {wage.label}</p>
        </div>
        <div className="mb-4">
          <NamedCrewPicker crews={namedCrews} selectedId={namedCrewId} onLoad={loadCrew} onSave={saveCrew} />
        </div>
        <div className="mt-4">
          <table className="w-full table-auto text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Use</th>
                <th className="p-2">Class</th>
                <th className="p-2">Hourly wage $/MH</th>
                <th className="p-2">Headcount</th>
              </tr>
            </thead>
            <tbody>
              {crew.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="p-2">
                    <input type="checkbox" checked={row.selected} onChange={() => toggleClass(row.id)} aria-label={`Select ${row.label}`} />
                  </td>
                  <td className="p-2 font-semibold">{row.label}{row.id === "journeyman" ? " (default)" : ""}</td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.wage}
                      aria-label={`${row.label} wage`}
                      onChange={(e) => applyCrew(crew.map((item) => item.id === row.id ? { ...item, wage: e.target.value } : item))}
                      className="w-full min-w-0 max-w-40 rounded-md border border-input bg-background px-2 py-1.5"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.headcount}
                      aria-label={`${row.label} headcount`}
                      onChange={(e) => applyCrew(crew.map((item) => {
                        if (item.id !== row.id) return item;
                        const headcount = e.target.value;
                        return { ...item, headcount, selected: Number(headcount) > 0 };
                      }))}
                      className="w-full min-w-0 max-w-28 rounded-md border border-input bg-background px-2 py-1.5"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <ProductivityFactorEditor factors={factors} onChange={changeFactor} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-bold">Bid markups</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Contingency %" type="number" value={contingency} set={setContingency} />
            <Field label="Overhead %" type="number" value={overhead} set={setOverhead} />
            <Field label="Profit %" type="number" value={profit} set={setProfit} />
            <Field label="Bond / insurance %" type="number" value={bondInsurance} set={setBondInsurance} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <Sum label="Material" value={totals.material} />
          <Sum label={`Labor (${totals.hours.toFixed(2)} hrs @ $${wage.rate.toFixed(2)})`} value={totals.labor} />
          <Sum label={`Contingency (${Number(contingency) || 0}%)`} value={cont} />
          <Sum label={`Overhead (${Number(overhead) || 0}%)`} value={oh} />
          <Sum label={`Profit (${Number(profit) || 0}%)`} value={prof} />
          <Sum label={`Bond / insurance (${Number(bondInsurance) || 0}%)`} value={bond} />
          <div className="mt-3 flex justify-between border-t border-border pt-4 text-xl font-black">
            <span>Estimate Total</span>
            <span className="text-blue-600 dark:text-orange-500">${grand.toFixed(2)}</span>
          </div>
        </div>
      </section>
        </TabsContent>

        {draft.trueTakeoff?.analysis ? (
          <TabsContent value="audit" className="mt-4 space-y-5">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">True Electrical Takeoff</p>
                  <h2 className="mt-1 text-xl font-black">Bid audit &amp; coverage</h2>
                  <p className="mt-1 text-sm text-muted-foreground">This is the scope intelligence generated from the drawing set, takeoff marks, scaled runs, panel/riser data, and mechanical equipment tags.</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-right dark:bg-emerald-500/5">
                  <div className="text-xs font-bold text-muted-foreground">Calculated bid</div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{`${grand.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AuditStat label="Sheets read" value={draft.trueTakeoff.analysis.sheetCount} />
                <AuditStat label="Devices counted" value={draft.trueTakeoff.analysis.totals.devices} />
                <AuditStat label="Measured conduit" value={`${draft.trueTakeoff.analysis.totals.conduitLf.toFixed(1)} LF`} />
                <AuditStat label="Bid-lock warnings" value={draft.trueTakeoff.analysis.warnings.length} />
              </div>
              {Object.keys(scopeTotals).length ? (
                <div className="mt-5">
                  <h3 className="text-sm font-bold">Base &amp; alternate rollup</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(scopeTotals).map(([scope, value]) => (
                      <div key={scope} className="rounded-lg border border-border bg-background p-3">
                        <div className="text-xs font-bold text-muted-foreground">{scope}</div>
                        <div className="mt-1 text-lg font-black">{`${value.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="font-bold">Service &amp; distribution</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {draft.trueTakeoff.analysis.panels.map((panel) => (
                    <div key={panel.name} className="flex justify-between border-b border-border py-2">
                      <span>Panel {panel.name}</span><strong>{panel.amps}A {panel.volts}</strong>
                    </div>
                  ))}
                  {draft.trueTakeoff.analysis.transformers.map((kva) => (
                    <div key={kva} className="flex justify-between border-b border-border py-2">
                      <span>Transformer</span><strong>{kva} kVA</strong>
                    </div>
                  ))}
                  {draft.trueTakeoff.analysis.utility.utilityVault ? <div className="flex justify-between border-b border-border py-2"><span>Utility vault</span><strong>Required</strong></div> : null}
                  {draft.trueTakeoff.analysis.utility.concreteEncasement ? <div className="flex justify-between border-b border-border py-2"><span>Concrete encasement</span><strong>Required</strong></div> : null}
                  {draft.trueTakeoff.analysis.utility.contractorTrenching ? <div className="flex justify-between border-b border-border py-2"><span>Contractor trenching</span><strong>Required</strong></div> : null}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="font-bold">Equipment found</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(draft.trueTakeoff.analysis.equipment).map(([key, tags]) => (
                    <div key={key} className="rounded-lg border border-border p-3">
                      <div className="text-xs font-bold uppercase text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</div>
                      <div className="mt-1 font-semibold">{tags.length ? tags.join(", ") : "None"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">Conduit wire makeup</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Calculated from conduit length, assigned circuits, poles, neutral requirement, conductor size, and one shared equipment grounding conductor per conduit.</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{draft.trueTakeoff.analysis.conduitWireMakeup?.length || 0} conduit runs</div>
                  <div>{(draft.trueTakeoff.analysis.wirePulling || []).reduce((sum, row) => sum + Number(row.feet || 0), 0).toFixed(0)} total conductor LF</div>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[980px] text-xs">
                  <thead className="border-b border-border text-left uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">C#</th>
                      <th className="p-2">Sheet</th>
                      <th className="p-2">Conduit</th>
                      <th className="p-2 text-right">LF</th>
                      <th className="p-2">Circuits / conductors</th>
                      <th className="p-2">Ground</th>
                      <th className="p-2 text-right">Total wire LF</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.trueTakeoff.analysis.conduitWireMakeup || []).map((row) => (
                      <tr key={row.conduitId} className={`border-b border-border ${row.status !== "ready" ? "bg-amber-50/70 dark:bg-amber-500/5" : ""}`}>
                        <td className="p-2 font-bold">C{row.runNumber || "?"}</td>
                        <td className="p-2">{row.sheet}</td>
                        <td className="p-2">{[row.conduitSize, row.conduitMaterial].filter(Boolean).join(" ")}</td>
                        <td className="p-2 text-right">{Number(row.lengthLf || 0).toFixed(1)}</td>
                        <td className="p-2">
                          {row.circuits.length ? row.circuits.map((circuit) => (
                            <div key={circuit.circuit}>
                              <strong>{circuit.circuit}</strong>: {circuit.hotCount} hot{circuit.neutralRequired ? " + 1 neutral" : ""} · {circuit.wireSize ? `#${circuit.wireSize}` : "size ?"} · {circuit.breakerAmps || "?"}A/{circuit.poles || "?"}P
                            </div>
                          )) : <span className="text-amber-700">No assigned circuits</span>}
                        </td>
                        <td className="p-2">{row.groundSize ? `#${row.groundSize} Cu` : "—"}</td>
                        <td className="p-2 text-right font-semibold">{Number(row.totalConductorFeet || 0).toFixed(1)}</td>
                        <td className="p-2">
                          <span className={row.status === "ready" ? "text-emerald-700" : "text-amber-700"}>{row.status === "ready" ? "Ready" : "Review"}</span>
                          {row.warnings.map((warning) => <div key={warning} className="mt-1 max-w-72 text-[10px] text-amber-700">{warning}</div>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(draft.trueTakeoff.analysis.wirePulling || []).length ? (
                <div className="mt-4">
                  <h4 className="text-sm font-bold">Wire pulling totals</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.trueTakeoff.analysis.wirePulling.map((wire) => (
                      <div key={wire.size} className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                        <strong>{wire.size.includes("GND") ? wire.size : `#${wire.size}`}</strong> · {Number(wire.feet || 0).toFixed(0)} LF
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-bold">Labor by work category</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Man-hours and labor dollars are rolled up from every included estimate line.</p>
                </div>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Category</th>
                      <th className="p-2 text-right">Lines</th>
                      <th className="p-2 text-right">Material</th>
                      <th className="p-2 text-right">Man-hours</th>
                      <th className="p-2 text-right">Labor</th>
                      <th className="p-2 text-right">Direct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workCategoryTotals.map((row) => (
                      <tr key={row.category} className={`border-b border-border ${row.category === "Other / Review" && row.lineCount ? "bg-amber-50/70 dark:bg-amber-500/5" : ""}`}>
                        <td className="p-2 font-bold">{row.category}</td>
                        <td className="p-2 text-right">{row.lineCount}</td>
                        <td className="p-2 text-right">{`${row.material.toFixed(2)}`}</td>
                        <td className="p-2 text-right font-bold">{row.hours.toFixed(2)}</td>
                        <td className="p-2 text-right font-bold">{`${row.labor.toFixed(2)}`}</td>
                        <td className="p-2 text-right">{`${row.direct.toFixed(2)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-bold">Complete takeoff</h3>
              <p className="mt-1 text-xs text-muted-foreground">Every included estimate line with quantity, labor unit, total man-hours, labor dollars, and assigned work category.</p>
              <div className="mt-4 max-h-[38rem] overflow-auto rounded-lg border border-border">
                <table className="w-full min-w-[1050px] text-xs">
                  <thead className="sticky top-0 bg-card text-left uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="p-2">Work category</th>
                      <th className="p-2">Source category</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2">Unit</th>
                      <th className="p-2 text-right">MH/unit</th>
                      <th className="p-2 text-right">Man-hours</th>
                      <th className="p-2 text-right">Labor rate</th>
                      <th className="p-2 text-right">Labor</th>
                      <th className="p-2 text-right">Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workCategoryTotals.flatMap((group) => group.lines.map((line) => (
                      <tr key={line.id || `${group.category}-${line.description}`} className="border-b border-border">
                        <td className="p-2 font-semibold">{group.category}</td>
                        <td className="p-2">{line.sourceCategory}</td>
                        <td className="p-2">{line.description}</td>
                        <td className="p-2 text-right">{line.quantity}</td>
                        <td className="p-2">{line.unit}</td>
                        <td className="p-2 text-right">{Number(lines.find((row) => row.id === line.id)?.laborMhPerUnit || 0).toFixed(3)}</td>
                        <td className="p-2 text-right font-semibold">{line.hours.toFixed(2)}</td>
                        <td className="p-2 text-right">{`${Number(lines.find((row) => row.id === line.id)?.laborRate || 0).toFixed(2)}`}</td>
                        <td className="p-2 text-right">{`${line.labor.toFixed(2)}`}</td>
                        <td className="p-2 text-right">{`${line.material.toFixed(2)}`}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-bold">Bid-lock warnings</h3>
              {draft.trueTakeoff.analysis.warnings.length ? (
                <div className="mt-3 space-y-2">
                  {draft.trueTakeoff.analysis.warnings.map((warning) => (
                    <div key={warning} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{warning}</div>
                  ))}
                </div>
              ) : <p className="mt-2 text-sm text-emerald-700">No unresolved bid-lock warnings.</p>}
            </section>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function Field({ label, value, set, type = "text", children, className = "", required = false, hint = "" }) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-bold text-muted-foreground">
        {label}
        {required ? <span className="ml-1 font-semibold text-blue-600 dark:text-orange-500">{hint || "Required"}</span> : null}
      </span>
      {children || <input type={type} value={value} onChange={(e) => set(e.target.value)} required={required} className="w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2.5" />}
    </label>
  );
}

function Cell({ value, set, type = "text", placeholder = "" }) {
  return <input type={type} step={type === "number" ? "0.01" : undefined} value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-2" />;
}

function Sel({ value, vals, set }) {
  const options = vals.includes(value) || !value ? vals : [value, ...vals];
  return (
    <select value={value} onChange={(e) => set(e.target.value)} className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-2">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

function Sum({ label, value }) {
  return <div className="flex justify-between border-b border-border py-2 text-sm"><span className="text-muted-foreground">{label}</span><strong>${value.toFixed(2)}</strong></div>;
}


function AuditStat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}
