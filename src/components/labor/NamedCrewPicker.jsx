import React, { useState } from "react";

export default function NamedCrewPicker({ crews = [], selectedId, onLoad, onSave }) {
  const [name, setName] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-[12rem] flex-1">
        <span className="mb-1 block text-xs font-bold text-muted-foreground">Saved crews</span>
        <select
          value={selectedId || ""}
          onChange={(e) => onLoad?.(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2"
        >
          <option value="">Current estimate crew</option>
          {crews.map((crew) => (
            <option key={crew.id} value={crew.id}>{crew.name}</option>
          ))}
        </select>
      </label>
      <label className="min-w-[10rem] flex-1">
        <span className="mb-1 block text-xs font-bold text-muted-foreground">Save current as</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Service pair" className="w-full rounded-lg border border-input bg-background px-3 py-2" />
      </label>
      <button
        type="button"
        onClick={() => {
          if (!name.trim()) return;
          onSave?.(name.trim());
          setName("");
        }}
        className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted"
      >
        Save crew
      </button>
    </div>
  );
}
