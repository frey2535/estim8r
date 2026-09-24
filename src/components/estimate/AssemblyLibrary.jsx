import React, { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { normalizeAssembly, normalizeComponent, validateAssembly } from "@/domain/estimate/assemblies";

function emptyAssembly() {
  return normalizeAssembly({ name: "", description: "", category: "", components: [normalizeComponent({ quantity: 1 })] });
}

export default function AssemblyLibrary({ assemblies = [], onChange, onInsert }) {
  const [draft, setDraft] = useState(() => emptyAssembly());
  const [quantity, setQuantity] = useState(1);
  const validation = useMemo(() => validateAssembly(draft), [draft]);

  function patchComponent(id, key, value) {
    setDraft((current) => ({
      ...current,
      components: current.components.map((row) => row.id === id ? { ...row, [key]: value } : row),
    }));
  }

  function save() {
    if (!validation.valid) return;
    onChange?.([validation.assembly, ...assemblies.filter((row) => row.id !== validation.assembly.id)]);
    setDraft(emptyAssembly());
  }

  function edit(assembly) {
    setDraft(normalizeAssembly(assembly));
  }

  function remove(id) {
    onChange?.(assemblies.filter((row) => row.id !== id));
    if (draft.id === id) setDraft(emptyAssembly());
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-orange-500">Assemblies</p>
        <h2 className="mt-1 text-xl font-black">Assembly Library</h2>
        <p className="mt-1 text-sm text-muted-foreground">Build reusable electrical assemblies from material and labor components, then insert the entire assembly into an estimate at once.</p>
      </div>

      {assemblies.length ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {assemblies.map((assembly) => (
            <div key={assembly.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{assembly.name}</div>
                  <div className="text-xs text-muted-foreground">{assembly.category || "General"} · {assembly.components.length} components</div>
                </div>
                <button type="button" onClick={() => remove(assembly.id)} className="rounded-md p-1.5 hover:bg-muted" aria-label={"Delete " + assembly.name}><Trash2 className="h-4 w-4" /></button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{assembly.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => edit(assembly)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted">Edit</button>
                <button type="button" onClick={() => onInsert?.(assembly, quantity)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white dark:bg-orange-500">Add to estimate × {quantity}</button>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No assemblies saved yet. Create the first reusable assembly below.</p>}

      <div className="mt-5 border-t border-border pt-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Assembly name" value={draft.name} set={(value) => setDraft((current) => ({ ...current, name: value }))} />
          <Field label="Category" value={draft.category} set={(value) => setDraft((current) => ({ ...current, category: value }))} />
          <Field label="Insert quantity" type="number" value={quantity} set={(value) => setQuantity(Math.max(1, Number(value) || 1))} />
        </div>
        <div className="mt-3">
          <Field label="Description" value={draft.description} set={(value) => setDraft((current) => ({ ...current, description: value }))} />
        </div>

        <div className="mt-4 space-y-2">
          {draft.components.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(12rem,2fr)_7rem_7rem_8rem_8rem_auto]">
              <Field label="Component" value={row.description} set={(value) => patchComponent(row.id, "description", value)} />
              <Field label="Qty" type="number" value={row.quantity} set={(value) => patchComponent(row.id, "quantity", value)} />
              <Field label="Unit" value={row.unit} set={(value) => patchComponent(row.id, "unit", value)} />
              <Field label="Material/unit" type="number" value={row.materialUnitCost} set={(value) => patchComponent(row.id, "materialUnitCost", value)} />
              <Field label="MH/unit" type="number" value={row.laborMhPerUnit} set={(value) => patchComponent(row.id, "laborMhPerUnit", value)} />
              <button type="button" onClick={() => setDraft((current) => ({ ...current, components: current.components.filter((component) => component.id !== row.id) }))} className="self-end rounded-md border border-border p-2.5 hover:bg-muted" aria-label="Remove component"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setDraft((current) => ({ ...current, components: [...current.components, normalizeComponent({ quantity: 1 })] }))} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted"><Plus className="h-4 w-4" />Add component</button>
          <button type="button" onClick={save} disabled={!validation.valid} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-orange-500">Save assembly</button>
        </div>
        {!validation.valid ? <p className="mt-2 text-xs text-amber-700">{validation.errors.join(" ")}</p> : null}
      </div>
    </section>
  );
}

function Field({ label, value, set, type = "text" }) {
  return <label className="min-w-0"><span className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</span><input type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} value={value} onChange={(e) => set(e.target.value)} className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-2 text-sm" /></label>;
}
