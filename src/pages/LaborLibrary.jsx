import React, { useEffect, useMemo, useState } from "react";
import { Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { listLaborCategories, listLaborLibrary, listLaborTaxonomy, listCustomLabor, saveCustomLabor } from "@/api/laborRepository";
import { verificationSummary } from "@/domain/labor/auditedLibrary";
import { SOURCE_LABELS } from "@/domain/labor/sources";

const emptyCustom = { itemName: "", category: "", size: "", unit: "EA", normalMh: "", notes: "", laborItemId: "" };

export default function LaborLibrary() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taxonomy, setTaxonomy] = useState([]);
  const [customRows, setCustomRows] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState(emptyCustom);
  const [customError, setCustomError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listLaborCategories().then(setCategories).catch(() => setCategories([]));
    listLaborTaxonomy().then(setTaxonomy).catch(() => setTaxonomy([]));
    listCustomLabor().then(setCustomRows).catch(() => setCustomRows([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setRows(await listLaborLibrary({ search, category, subcategory }));
        setError("");
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search, category, subcategory]);

  const summary = useMemo(() => verificationSummary(rows), [rows]);
  const subcategories = (taxonomy.find((row) => row.category === category)?.subcategories || []);
  const visible = rows.filter((row) => {
    if (status === "all") return true;
    const unit = row.labor_units?.[0];
    if (status === "experimental") return unit?.source_type === "experimental";
    if (status === "verified") return unit?.verification_status === "verified";
    return unit?.verification_status === "unverified";
  });

  async function submitCustom(event) {
    event.preventDefault();
    setCustomError("");
    const hours = Number(custom.normalMh);
    if (!custom.itemName.trim()) {
      setCustomError("Name the custom labor item.");
      return;
    }
    if (!Number.isFinite(hours) || hours < 0) {
      setCustomError("Enter man-hours. Estim8r will not invent them.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveCustomLabor({
        laborItemId: custom.laborItemId,
        itemName: custom.itemName.trim(),
        category: custom.category,
        size: custom.size,
        unit: custom.unit,
        normalMh: hours,
        notes: custom.notes,
      });
      setCustomRows((current) => [saved, ...current.filter((row) => row.id !== saved.id)]);
      setCustom(emptyCustom);
    } catch (e) {
      setCustomError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 py-2">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Labor Intelligence</p>
        <h1 className="text-3xl font-black">Master Labor Library</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Taxonomy is separate from labor authority. The 1,921 imported rows are Estim8r Experimental / UNVERIFIED
          and are never a market average. Market comparison uses only a verified published labor unit with a named
          source and edition. NECA is not populated.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Items shown" value={loading ? "…" : visible.length} />
        <Stat label="Experimental" value={summary.experimental} />
        <Stat label="Unverified" value={summary.unverified} />
        <Stat label="Production-ready" value={summary.productionAllowed} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_14rem_12rem]">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search EMT, transformer, fiber, access control…" className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4" />
        </div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }} className="rounded-xl border border-input bg-background px-3 py-3">
          <option value="">All categories</option>
          {categories.map((name) => <option key={name}>{name}</option>)}
        </select>
        <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-3">
          <option value="">All subcategories</option>
          {subcategories.map((name) => <option key={name}>{name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-3">
          <option value="all">All verification</option>
          <option value="experimental">Experimental</option>
          <option value="unverified">Unverified</option>
          <option value="verified">Verified</option>
        </select>
      </div>

      {error ? <div className="rounded-lg bg-red-500/10 p-3 text-red-700 dark:text-red-200">{error}</div> : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Custom labor</h2>
        <p className="mt-1 text-sm text-muted-foreground">Company-isolated hours you enter. Leave hours blank and nothing is saved.</p>
        <form onSubmit={submitCustom} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label="Item name" value={custom.itemName} set={(v) => setCustom((c) => ({ ...c, itemName: v }))} />
          <Field label="Category" value={custom.category} set={(v) => setCustom((c) => ({ ...c, category: v }))} />
          <Field label="Size" value={custom.size} set={(v) => setCustom((c) => ({ ...c, size: v }))} />
          <Field label="Unit" value={custom.unit} set={(v) => setCustom((c) => ({ ...c, unit: v }))} />
          <Field label="Normal MH" type="number" value={custom.normalMh} set={(v) => setCustom((c) => ({ ...c, normalMh: v }))} />
          <div className="flex items-end">
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white dark:bg-orange-500">{saving ? "Saving…" : "Save custom"}</button>
          </div>
        </form>
        {customError ? <p className="mt-2 text-sm text-destructive">{customError}</p> : null}
        {customRows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No custom labor yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border text-sm">
            {customRows.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-semibold">{row.itemName}</span>
                <span className="text-muted-foreground">{row.normal_mh} MH / {row.unit}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-4">Item</th>
              <th>Taxonomy</th>
              <th>Size</th>
              <th>Unit</th>
              <th className="pr-4">Labor sources</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">Loading labor library…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No labor items match these filters.</td></tr>
            ) : visible.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-4">
                  <div className="font-semibold">{row.item_name}</div>
                  <div className="text-xs text-muted-foreground">{row.description}</div>
                </td>
                <td>
                  {row.category}
                  <div className="text-xs text-muted-foreground">{row.subcategory}</div>
                </td>
                <td>{row.size || "—"}</td>
                <td>{row.unit}</td>
                <td className="pr-4">
                  {(row.labor_units || []).length === 0 ? (
                    <span className="text-muted-foreground">No sourced labor yet</span>
                  ) : (row.labor_units || []).map((unit) => (
                    <div key={unit.id} className="my-1 flex items-center gap-2">
                      {unit.verification_status === "verified" && unit.production_allowed
                        ? <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        : <ShieldAlert className="h-4 w-4 text-amber-500" />}
                      <span>{SOURCE_LABELS[unit.source_type] || unit.source_name}: {unit.normal_mh ?? "—"} MH</span>
                      <span className="text-xs text-muted-foreground">{unit.verification_status}</span>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function Field({ label, value, set, type = "text" }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      <input type={type} step={type === "number" ? "0.01" : undefined} value={value} onChange={(e) => set(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2.5" />
    </label>
  );
}
