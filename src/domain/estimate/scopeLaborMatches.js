/** Match explicit quantities and exact catalog names; never infer missing quantities. */
export function scopeLaborMatches(scope, library = []) {
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9/.-]+/g, " ").trim();
  const result = [];
  for (const clause of String(scope || "").split(/[;\n]+/)) {
    const match = normalize(clause).match(/^(?:install )?(\d+(?:\.\d+)?)\s+(?:(lf|ft|feet|ea)\s+)?(.+)$/);
    if (!match || Number(match[1]) <= 0) continue;
    const [, count, unit, name] = match;
    const candidates = library.filter(item => {
      if (!item.labor_units?.some(u => u.normal_mh != null)) return false;
      const length = ["LF", "100 LF", "1000 LF"].includes(item.unit);
      if (length ? !["lf", "ft", "feet"].includes(unit) : item.unit !== "EA" || (unit && unit !== "ea")) return false;
      return [normalize(item.item_name), normalize([item.item_name, item.size].filter(Boolean).join(" "))].includes(name);
    });
    if (candidates.length === 1 && !result.some(row => row.item.id === candidates[0].id)) result.push({ item: candidates[0], quantity: Number(count) });
  }
  return result;
}
