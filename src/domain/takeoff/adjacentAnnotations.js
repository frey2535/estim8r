// Distinguish equipment designations from circuit identifiers without inventing classifications.
// This module is deliberately pure so detection and hover rendering can share it.
const clean = (value) => String(value ?? "").trim();
const EQUIPMENT = /^(?:EF|F|L|X|AHU|RTU|VFD|M|P|LP|HP|EX|EM|FCU|CU|WP)[- ]?\d+[A-Z]?$/i;
const CIRCUIT = /^\d{1,3}(?:\s*[,/&-]\s*\d{1,3})*$/;
const PANEL_CIRCUIT = /^([A-Z][A-Z0-9-]{0,12})\s*[-:]\s*(\d{1,3}(?:\s*[,/&]\s*\d{1,3})*)$/i;
export function classifyAdjacentAnnotation(value) {
  const text = clean(value);
  if (!text) return { kind: "none", text: "" };
  const panel = text.match(PANEL_CIRCUIT);
  if (panel) return { kind: "circuit", text, panel: panel[1], circuits: panel[2].match(/\d+/g) || [] };
  if (CIRCUIT.test(text)) return { kind: "circuit", text, circuits: text.match(/\d+/g) || [] };
  if (EQUIPMENT.test(text)) return { kind: "equipment", text, equipmentId: text.toUpperCase().replace(/\s+/g, "") };
  return { kind: "unresolved", text };
}
export function resolveAdjacentAnnotations(tokens = []) {
  const annotations = tokens.map((token) => ({
    ...classifyAdjacentAnnotation(token?.text ?? token),
    distance: Number(token?.distance ?? Infinity),
  })).sort((a,b) => a.distance - b.distance);
  const equipment = annotations.find((item) => item.kind === "equipment");
  const circuit = annotations.find((item) => item.kind === "circuit");
  return {
    equipmentId: equipment?.equipmentId || "",
    circuitNumbers: circuit?.circuits || [],
    panel: circuit?.panel || "",
    unresolved: annotations.filter((item) => item.kind === "unresolved").map((item) => item.text),
  };
}
