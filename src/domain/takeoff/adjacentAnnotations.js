// Parse nearby drawing annotations conservatively without guessing unknown labels.
const clean = (value) => String(value ?? "").trim();
const EQUIPMENT = /^(?:EF|F|L|X|AHU|RTU|VFD|M|P|EX|EM|FCU|CU|WP)[- ]?\d+[A-Z]?$/i;
const CIRCUIT = /^\d{1,3}(?:\s*[,/&-]\s*\d{1,3})*$/;
const PANEL_CIRCUIT = /^([A-Z][A-Z0-9-]{0,12})\s*[-:]\s*(\d{1,3}(?:\s*[,/&]\s*\d{1,3})*)$/i;
const KNOWN_PANEL_CIRCUIT = /^(?:LP|HP|PP|MDP|DP|RP)\s*[-:]\s*\d{1,3}$/i;

export function classifyAdjacentAnnotation(value) {
  const text = clean(value);
  if (!text) return { kind: "none", text: "" };
  if (KNOWN_PANEL_CIRCUIT.test(text)) {
    const match = text.match(PANEL_CIRCUIT);
    return { kind: "circuit", text, panel: match[1], circuits: match[2].match(/\d+/g) || [] };
  }
  if (EQUIPMENT.test(text)) {
    return { kind: "equipment", text, equipmentId: text.toUpperCase().replace(/\s+/g, "") };
  }
  const panel = text.match(PANEL_CIRCUIT);
  if (panel) return { kind: "circuit", text, panel: panel[1], circuits: panel[2].match(/\d+/g) || [] };
  if (CIRCUIT.test(text)) return { kind: "circuit", text, circuits: text.match(/\d+/g) || [] };
  return { kind: "unresolved", text };
}

export function resolveAdjacentAnnotations(tokens = []) {
  const sorted = [...tokens].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  const result = { equipmentId: null, circuitNumbers: [], panel: null, unresolved: [] };
  for (const token of sorted) {
    const parsed = classifyAdjacentAnnotation(token.text);
    if (parsed.kind === "equipment" && !result.equipmentId) result.equipmentId = parsed.equipmentId;
    else if (parsed.kind === "circuit") {
      if (parsed.panel && !result.panel) result.panel = parsed.panel;
      result.circuitNumbers.push(...parsed.circuits);
    } else if (parsed.kind === "unresolved") result.unresolved.push(parsed.text);
  }
  result.circuitNumbers = [...new Set(result.circuitNumbers)];
  return result;
}
