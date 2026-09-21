import { assignLaborHours } from "../labor/libraryDocument.js";
import { compositeWage, defaultCrew, journeymanWage } from "../labor/employeeClasses.js";

export const DEFAULT_TRUE_BID_SETTINGS = Object.freeze({
  laborRate: 72,
  contingency: 3,
  overhead: 10,
  profit: 8,
  bondInsurance: 1.5,
});

const MATERIAL_BASELINES = Object.freeze({
  lighting: 180,
  receptacle: 28,
  switch: 24,
  sensor: 85,
  equipment: 125,
  "panels / mcc": 0,
  raceway: 1.5,
  wire: 0.75,
});

const SERVICE_GEAR_BASELINES = Object.freeze({
  "panel-150": 5000,
  "panel-200": 4500,
  transformer45: 5500,
  spd: 1200,
  meter: 2500,
  contactor: 1800,
  utilityVault: 6500,
});

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function num(value) {
  return Number(value) || 0;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function wholeText(drawingDocs) {
  return (drawingDocs?.pages || [])
    .map((page) => page.text || "")
    .filter(Boolean)
    .join("\n");
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function tagMatches(text, prefix) {
  const re = new RegExp(`\\b${prefix}-\\d+\\b`, "gi");
  return uniq((String(text || "").match(re) || []).map((value) => value.toUpperCase())).sort();
}

function parsePanels(text) {
  const rows = [];
  const seen = new Set();
  const patterns = [
    /\b([A-Z][A-Z0-9-]{0,8})\s+(\d{2,4})A\s+(\d{2,3})\/(\d{2,3})V\s+MCB\b/gi,
    /\bBRANCH\s+PANEL:\s*([A-Z][A-Z0-9-]{0,8})[\s\S]{0,220}?MCB\s+RATING:\s*(\d{2,4})\s*A[\s\S]{0,220}?VOLTS:\s*(\d{2,3})\/(\d{2,3})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of String(text || "").matchAll(pattern)) {
      const name = String(match[1] || "").toUpperCase();
      const amps = Number(match[2]) || 0;
      const low = Number(match[3]) || 0;
      const high = Number(match[4]) || 0;
      const volts = low && high ? `${low}/${high}V` : "";
      const key = `${name}|${amps}|${volts}`;
      if (!name || !amps || seen.has(key)) continue;
      seen.add(key);
      rows.push({ name, amps, volts });
    }
  }
  return rows;
}

function parseTransformers(text) {
  const values = [];
  for (const match of String(text || "").matchAll(/\b(\d+(?:\.\d+)?)\s*KVA\s+TRANSFORMER\b/gi)) {
    values.push(Number(match[1]));
  }
  return uniq(values).sort((a, b) => a - b);
}

function parseFutureStubs(text) {
  const rows = [];
  for (const match of String(text || "").matchAll(/STUB\s+OUT\s+(\d+)\s*-\s*([\d-]+(?:\/[\d]+)?)\s*"?C\.?\s+FROM\s+([^\n]+)/gi)) {
    rows.push({
      quantity: Number(match[1]) || 1,
      size: `${String(match[2]).trim()}"`,
      description: String(match[3] || "").trim(),
    });
  }
  return rows;
}

function parseUtilityRequirements(text) {
  const value = String(text || "");
  return {
    utilityVault: /NEW\s+UTILITY\s+VAULT[\s\S]{0,80}INSTALLED\s+BY\s+CONTRACTOR/i.test(value),
    concreteEncasement: /ALL\s+CONDUIT\s+TO\s+BE\s+ENCASED\s+IN\s+12"?\s+OF\s+CONCRETE/i.test(value),
    contractorTrenching: /ALL\s+DITCHES\s+OPENED\s+AND\s+CLOSED\s+BY\s+CONTRACTOR/i.test(value),
    fourInchMinimum: /CONDUIT\s+SIZE\s*-\s*MINIMUM\s+4"/i.test(value),
    spareFourInch: /PROVIDE\s+4"\s+SPARE\s+CONDUIT/i.test(value),
    minBurialDepth: Number(value.match(/MINIMUM\s+(\d+)"\s+DEPTH/i)?.[1] || 0) || null,
    futureFieldLighting: /FUTURE\s+(?:MUSCO\s+)?FIELD\s+LIGHTING/i.test(value),
    futureFoodTruck: /FUTURE\s+EXTERIOR\s+RECEPTACLES\s+FOR\s+FOOD\s+TRUCKS/i.test(value),
    spd: /\bSPD\b|SURGE\s+PROTECTIVE\s+DEVICE/i.test(value),
    meter: /\bMETER\b/i.test(value),
    lightingContactor: /6\s+POLE[\s\S]{0,120}?LIGHTING\s+CONTACTOR/i.test(value),
    photocell: /PHOTOCELL|PHOTOELECTRIC\s+CELL/i.test(value),
  };
}

function parseLongCircuitRule(text) {
  const match = String(text || "").match(/OVER\s+(\d+)\s+FEET[\s\S]{0,90}?CONDUCTORS\s+TO\s+BE\s+#(\d+)/i);
  if (!match) return null;
  return { thresholdFeet: Number(match[1]), conductorAwg: Number(match[2]) };
}

function alternateTags(text, tags) {
  const value = String(text || "");
  const result = { base: [], alternate1: [], alternate2: [], alternate3: [], unresolved: [] };
  for (const tag of tags) {
    const index = value.search(new RegExp(`\\b${tag.replace("-", "\\-")}\\b`, "i"));
    if (index < 0) {
      result.unresolved.push(tag);
      continue;
    }
    const around = value.slice(Math.max(0, index - 500), Math.min(value.length, index + 500));
    if (/ALTERNATE\s*1/i.test(around)) result.alternate1.push(tag);
    else if (/ALTERNATE\s*2/i.test(around)) result.alternate2.push(tag);
    else if (/ALTERNATE\s*3/i.test(around)) result.alternate3.push(tag);
    else if (/BASE\s+BID/i.test(around)) result.base.push(tag);
    else result.unresolved.push(tag);
  }
  return result;
}

function scopeForTag(alternates, tag) {
  if ((alternates?.alternate1 || []).includes(tag)) return "Alternate 1";
  if ((alternates?.alternate2 || []).includes(tag)) return "Alternate 2";
  if ((alternates?.alternate3 || []).includes(tag)) return "Alternate 3";
  if ((alternates?.base || []).includes(tag)) return "Base";
  return "Base/Common";
}

function materialBaseline(category, description, unit) {
  const key = String(category || "").toLowerCase();
  const text = String(description || "").toLowerCase();
  if (unit === "LF" && /wire|conductor|thhn|thwn/.test(text)) return MATERIAL_BASELINES.wire;
  if (unit === "LF" || key === "raceway") return MATERIAL_BASELINES.raceway;
  if (/occupancy|sensor|photocell/.test(text)) return MATERIAL_BASELINES.sensor;
  if (/recept|gfci|duplex|outlet/.test(text) || key === "receptacles") return MATERIAL_BASELINES.receptacle;
  if (/switch|dimmer/.test(text) || key === "switches") return MATERIAL_BASELINES.switch;
  if (/light|fixture|luminaire|downlight|strip/.test(text) || key === "lighting") return MATERIAL_BASELINES.lighting;
  if (/panel|transformer|switchboard|mcc|gear/.test(text) || key === "panels / mcc") return MATERIAL_BASELINES["panels / mcc"];
  return MATERIAL_BASELINES.equipment;
}

function laborFor({ category, description, unit }) {
  const found = assignLaborHours({ category, symbol: description, unit });
  if (num(found?.mhPerUnit) > 0) {
    return {
      mhPerUnit: num(found.mhPerUnit),
      laborItemId: found.laborItemId || "",
      laborSource: found.sourceName || "Estim8r labor library",
      laborNote: found.note || "",
      verificationStatus: found.verificationStatus || "unverified",
    };
  }
  const fallback = unit === "LF"
    ? 0.06
    : /panel|transformer|gear/i.test(description) ? 10
      : /light|fixture/i.test(description) ? 1
        : 1.25;
  return {
    mhPerUnit: fallback,
    laborItemId: "",
    laborSource: "Estim8r fallback baseline",
    laborNote: "Fallback labor baseline. Replace with a verified labor-library unit before bid lock.",
    verificationStatus: "unverified",
  };
}

function makeEstimateLine({
  key,
  category,
  description,
  quantity,
  unit,
  materialUnitCost,
  laborRate,
  scope = "Base/Common",
  confidence = "medium",
  source = "true-takeoff",
  notes = "",
}) {
  const labor = laborFor({ category, description, unit });
  return {
    id: key,
    takeoffKey: key,
    source,
    itemType: unit === "LF" ? (/wire|conductor/i.test(description) ? "Wire" : "Conduit") : (/panel|transformer|gear|spd/i.test(description) ? "Gear" : "Device"),
    category,
    description,
    quantity: money(quantity),
    unit,
    materialUnitCost: money(materialUnitCost),
    laborMhPerUnit: money(labor.mhPerUnit),
    laborRate: money(laborRate),
    laborItemId: labor.laborItemId,
    laborSource: labor.laborSource,
    notes: [notes, labor.laborNote, `Scope: ${scope}`, `Confidence: ${confidence}`].filter(Boolean).join(" · "),
    included: true,
    quantityEdited: false,
    laborRateEdited: false,
    laborMhEdited: false,
    trueTakeoff: {
      scope,
      confidence,
      verificationStatus: labor.verificationStatus,
      costSource: "estim8r-budget-baseline",
    },
  };
}

function mergeGeneratedLines(existingLines, generatedLines) {
  const prior = new Map((existingLines || []).map((line) => [line.takeoffKey || line.id, line]));
  const generatedKeys = new Set(generatedLines.map((line) => line.takeoffKey));
  const next = generatedLines.map((line) => {
    const old = prior.get(line.takeoffKey);
    if (!old) return line;
    return {
      ...line,
      materialUnitCost: old.materialCostEdited ? old.materialUnitCost : line.materialUnitCost,
      quantity: old.quantityEdited ? old.quantity : line.quantity,
      unit: old.quantityEdited ? old.unit : line.unit,
      laborMhPerUnit: old.laborMhEdited ? old.laborMhPerUnit : line.laborMhPerUnit,
      laborRate: old.laborRateEdited ? old.laborRate : line.laborRate,
      materialCostEdited: Boolean(old.materialCostEdited),
      quantityEdited: Boolean(old.quantityEdited),
      laborMhEdited: Boolean(old.laborMhEdited),
      laborRateEdited: Boolean(old.laborRateEdited),
    };
  });
  for (const line of existingLines || []) {
    const key = line.takeoffKey || line.id;
    if (generatedKeys.has(key)) continue;
    if (line.source === "true-takeoff") continue;
    next.push(line);
  }
  return next;
}

function addIfMissing(lines, seenText, args) {
  const signature = slug(args.description);
  if (seenText.has(signature)) return;
  seenText.add(signature);
  lines.push(makeEstimateLine(args));
}

export function analyzeElectricalTakeoff({ drawingDocs, rollup, runs = [], marks = [] } = {}) {
  const text = wholeText(drawingDocs);
  const panels = parsePanels(text);
  const transformers = parseTransformers(text);
  const utility = parseUtilityRequirements(text);
  const futureStubs = parseFutureStubs(text);
  const longCircuitRule = parseLongCircuitRule(text);
  const equipment = {
    heaters: tagMatches(text, "EH"),
    exhaustFans: tagMatches(text, "EF"),
    ventilationFans: tagMatches(text, "VF"),
    ptacs: tagMatches(text, "PTAC"),
    airHandlers: tagMatches(text, "AHU"),
    rooftopUnits: tagMatches(text, "RTU"),
  };
  const allEquipmentTags = uniq(Object.values(equipment).flat());
  const alternates = alternateTags(text, allEquipmentTags);
  const measuredRuns = (runs || []).map((run) => ({
    ...run,
    lf: money(run.lf),
    confidence: run.calibrated ? "high" : "review",
    longCircuitUpgrade: Boolean(longCircuitRule && num(run.lf) > longCircuitRule.thresholdFeet),
  }));
  const unreviewedAi = (marks || []).filter((mark) => mark.source === "ai" && mark.reviewStatus !== "accepted" && mark.reviewStatus !== "rejected");
  const serviceMeasurement = measuredRuns.find((run) => /4"?\s*(?:pvc|conduit)|primary|service/i.test(String(run.type || "")));
  const warnings = [];
  if (!rollup?.calibrated) warnings.push("Drawing scale is not calibrated. LF/SF values are not bid-ready.");
  if (unreviewedAi.length) warnings.push(`${unreviewedAi.length} AI detections still require review.`);
  if ((utility.fourInchMinimum || utility.concreteEncasement) && !serviceMeasurement) {
    warnings.push("Utility/service ductbank requirements were detected, but no calibrated utility run is tagged. Trace the service route before bid lock.");
  }
  if (!drawingDocs?.pages?.some((page) => /spec/i.test(page.kind || ""))) {
    warnings.push("No dedicated electrical specification sheet was identified. Verify Division 26, addenda, bonding, permits, testing, and approved manufacturers.");
  }
  if (panels.length || transformers.length) warnings.push("Major gear uses budget material allowances until vendor quotes replace them.");
  const coverage = {
    drawingText: Boolean(text.trim()),
    scaleCalibrated: Boolean(rollup?.calibrated),
    deviceTakeoff: num(rollup?.totals?.count) > 0,
    measuredRuns: measuredRuns.length > 0,
    serviceScope: panels.length > 0 || transformers.length > 0 || utility.utilityVault,
    mechanicalConnections: allEquipmentTags.length > 0,
    alternatesDetected: /ALTERNATE\s*[123]/i.test(text),
    aiReviewComplete: unreviewedAi.length === 0,
  };
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sheetCount: drawingDocs?.pages?.length || 0,
    totals: {
      devices: num(rollup?.totals?.count),
      lf: money(rollup?.totals?.lf),
      sf: money(rollup?.totals?.sf),
      conduitLf: money(measuredRuns.reduce((sum, run) => sum + num(run.lf), 0)),
    },
    panels,
    transformers,
    utility,
    futureStubs,
    longCircuitRule,
    equipment,
    alternates,
    measuredRuns,
    coverage,
    warnings,
  };
}

export function buildTrueElectricalEstimateLines({
  analysis,
  rollup,
  runs = [],
  laborRate = DEFAULT_TRUE_BID_SETTINGS.laborRate,
} = {}) {
  const lines = [];
  const seenText = new Set();

  const hasRuns = (runs || []).length > 0;
  for (const row of rollup?.rows || []) {
    const category = row.category || "Electrical";
    const description = row.symbol || category;
    if (hasRuns && String(category).toLowerCase() === "raceway" && row.hasLength) continue;
    if (num(row.count) > 0) {
      addIfMissing(lines, seenText, {
        key: `true|takeoff|${slug(category)}|${slug(description)}|ea`,
        category,
        description,
        quantity: row.count,
        unit: "EA",
        materialUnitCost: materialBaseline(category, description, "EA"),
        laborRate,
        confidence: "high",
        notes: "Quantity from reviewed takeoff schedule.",
      });
    }
    if (row.hasLength && num(row.lf) > 0) {
      addIfMissing(lines, seenText, {
        key: `true|takeoff|${slug(category)}|${slug(description)}|lf`,
        category,
        description,
        quantity: row.lf,
        unit: "LF",
        materialUnitCost: materialBaseline(category, description, "LF"),
        laborRate,
        confidence: rollup?.calibrated ? "high" : "review",
        notes: "Length from calibrated takeoff geometry.",
      });
    }
  }

  for (const run of analysis?.measuredRuns || []) {
    const description = run.type || `Conduit run ${run.runNumber}`;
    lines.push(makeEstimateLine({
      key: `true|run|${run.id || run.runNumber}`,
      category: "Raceway",
      description,
      quantity: run.lf,
      unit: "LF",
      materialUnitCost: materialBaseline("Raceway", description, "LF"),
      laborRate,
      confidence: run.confidence,
      notes: [
        `Measured run ${run.runNumber || ""} on sheet ${run.sheet || ""}`,
        run.longCircuitUpgrade && analysis?.longCircuitRule
          ? `Run exceeds ${analysis.longCircuitRule.thresholdFeet} ft; drawing note requires #${analysis.longCircuitRule.conductorAwg} branch conductors where applicable.`
          : "",
      ].filter(Boolean).join(". "),
    }));
  }

  for (const panel of analysis?.panels || []) {
    const unitCost = panel.amps >= 200 ? SERVICE_GEAR_BASELINES["panel-200"] : SERVICE_GEAR_BASELINES["panel-150"];
    lines.push(makeEstimateLine({
      key: `true|gear|panel|${slug(panel.name)}`,
      category: "Panels / MCC",
      description: `Panel ${panel.name} - ${panel.amps}A ${panel.volts}`,
      quantity: 1,
      unit: "EA",
      materialUnitCost: unitCost,
      laborRate,
      confidence: "high",
      notes: "Detected from panel/riser schedule. Replace budget material allowance with quoted gear.",
    }));
  }

  for (const kva of analysis?.transformers || []) {
    lines.push(makeEstimateLine({
      key: `true|gear|transformer|${kva}`,
      category: "Panels / MCC",
      description: `${kva} kVA transformer`,
      quantity: 1,
      unit: "EA",
      materialUnitCost: kva === 45 ? SERVICE_GEAR_BASELINES.transformer45 : Math.max(2500, kva * 120),
      laborRate,
      confidence: "high",
      notes: "Detected from electrical riser. Replace budget material allowance with vendor quote.",
    }));
  }

  if (analysis?.utility?.spd) {
    lines.push(makeEstimateLine({
      key: "true|gear|spd",
      category: "Panels / MCC",
      description: "Surge protective device",
      quantity: 1,
      unit: "EA",
      materialUnitCost: SERVICE_GEAR_BASELINES.spd,
      laborRate,
      confidence: "high",
      notes: "SPD detected on electrical riser/schedule.",
    }));
  }
  if (analysis?.utility?.meter) {
    lines.push(makeEstimateLine({
      key: "true|gear|meter-service",
      category: "Panels / MCC",
      description: "Meter / service equipment allowance",
      quantity: 1,
      unit: "EA",
      materialUnitCost: SERVICE_GEAR_BASELINES.meter,
      laborRate,
      confidence: "medium",
      notes: "Metering detected on service riser. Verify utility-furnished versus contractor-furnished equipment.",
    }));
  }
  if (analysis?.utility?.lightingContactor) {
    lines.push(makeEstimateLine({
      key: "true|gear|lighting-contactor",
      category: "Controls",
      description: "6-pole lighting contactor",
      quantity: 1,
      unit: "EA",
      materialUnitCost: SERVICE_GEAR_BASELINES.contactor,
      laborRate,
      confidence: "high",
      notes: "Electrically held lighting contactor detected from riser note.",
    }));
  }
  if (analysis?.utility?.photocell) {
    lines.push(makeEstimateLine({
      key: "true|controls|photocell",
      category: "Switches",
      description: "Exterior lighting photocell",
      quantity: 1,
      unit: "EA",
      materialUnitCost: MATERIAL_BASELINES.sensor,
      laborRate,
      confidence: "high",
      notes: "Photocell control detected from site/riser notes.",
    }));
  }

  if (analysis?.utility?.utilityVault) {
    lines.push(makeEstimateLine({
      key: "true|site|utility-vault",
      category: "Site / Utility",
      description: "Contractor-installed utility vault",
      quantity: 1,
      unit: "EA",
      materialUnitCost: SERVICE_GEAR_BASELINES.utilityVault,
      laborRate,
      confidence: "high",
      notes: "Utility vault requirement detected on electrical site plan.",
    }));
  }
  if (analysis?.utility?.concreteEncasement) {
    const primary = (analysis.measuredRuns || []).find((run) => /4"?|primary|service/i.test(String(run.type || "")));
    lines.push(makeEstimateLine({
      key: "true|site|concrete-encasement",
      category: "Site / Utility",
      description: "Concrete encasement for utility/service ductbank",
      quantity: primary?.lf || 1,
      unit: primary?.lf ? "LF" : "LOT",
      materialUnitCost: primary?.lf ? 22 : 0,
      laborRate,
      confidence: primary?.lf ? "high" : "review",
      notes: primary?.lf ? "Quantity follows tagged primary/service run." : "Scope detected, but route length is not yet measured. Trace the utility ductbank before bid lock.",
    }));
  }
  if (analysis?.utility?.contractorTrenching) {
    const primary = (analysis.measuredRuns || []).find((run) => /4"?|primary|service/i.test(String(run.type || "")));
    lines.push(makeEstimateLine({
      key: "true|site|utility-trenching",
      category: "Site / Utility",
      description: "Utility trench excavation and backfill",
      quantity: primary?.lf || 1,
      unit: primary?.lf ? "LF" : "LOT",
      materialUnitCost: primary?.lf ? 10 : 0,
      laborRate,
      confidence: primary?.lf ? "high" : "review",
      notes: "Contractor trench/open-close requirement detected.",
    }));
  }

  for (const stub of analysis?.futureStubs || []) {
    const description = `${stub.quantity} x ${stub.size} future stub conduits - ${stub.description}`;
    lines.push(makeEstimateLine({
      key: `true|future-stub|${slug(description)}`,
      category: "Site / Utility",
      description,
      quantity: stub.quantity,
      unit: "EA",
      materialUnitCost: 150,
      laborRate,
      confidence: "medium",
      notes: "Stub quantity/size parsed from electrical site/riser notes. Field length still requires trace or estimator allowance.",
    }));
  }

  const rollupText = new Set((rollup?.rows || []).map((row) => slug(row.symbol || row.category)));
  const equipmentGroups = [
    ["Electric heater", analysis?.equipment?.heaters || [], 180],
    ["Exhaust fan", analysis?.equipment?.exhaustFans || [], 150],
    ["Ventilation fan", analysis?.equipment?.ventilationFans || [], 150],
    ["PTAC", analysis?.equipment?.ptacs || [], 350],
    ["Air handler", analysis?.equipment?.airHandlers || [], 350],
    ["RTU", analysis?.equipment?.rooftopUnits || [], 450],
  ];
  for (const [label, tags, baseline] of equipmentGroups) {
    for (const tag of tags) {
      if ([...rollupText].some((text) => text.includes(slug(tag)))) continue;
      lines.push(makeEstimateLine({
        key: `true|equipment|${slug(tag)}`,
        category: "Mechanical Connections",
        description: `${label} ${tag} electrical connection`,
        quantity: 1,
        unit: "EA",
        materialUnitCost: baseline,
        laborRate,
        scope: scopeForTag(analysis?.alternates, tag),
        confidence: "high",
        notes: "Equipment tag detected from mechanical/electrical drawings; verify disconnect and conductor requirements against equipment schedule.",
      }));
    }
  }

  return lines;
}

export function calculateTrueBidSummary(lines, settings = DEFAULT_TRUE_BID_SETTINGS) {
  const totals = (lines || []).reduce((acc, line) => {
    if (line.included === false) return acc;
    const quantity = num(line.quantity);
    const material = quantity * num(line.materialUnitCost);
    const hours = quantity * num(line.laborMhPerUnit);
    const labor = hours * num(line.laborRate || settings.laborRate);
    acc.material += material;
    acc.hours += hours;
    acc.labor += labor;
    return acc;
  }, { material: 0, hours: 0, labor: 0 });
  const direct = totals.material + totals.labor;
  const contingency = direct * (num(settings.contingency) / 100);
  const overhead = (direct + contingency) * (num(settings.overhead) / 100);
  const profit = (direct + contingency + overhead) * (num(settings.profit) / 100);
  const bondInsurance = (direct + contingency + overhead + profit) * (num(settings.bondInsurance) / 100);
  return {
    ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, money(value)])),
    direct: money(direct),
    contingency: money(contingency),
    overhead: money(overhead),
    profit: money(profit),
    bondInsurance: money(bondInsurance),
    total: money(direct + contingency + overhead + profit + bondInsurance),
  };
}


export function calculateBidByScope(lines, settings = DEFAULT_TRUE_BID_SETTINGS) {
  const grouped = {};
  for (const line of lines || []) {
    const scope = line.trueTakeoff?.scope || "Base/Common";
    if (!grouped[scope]) grouped[scope] = [];
    grouped[scope].push(line);
  }
  return Object.fromEntries(
    Object.entries(grouped).map(([scope, scopedLines]) => [
      scope,
      calculateTrueBidSummary(scopedLines, settings),
    ]),
  );
}

export function buildTrueElectricalEstimateDraft(existing, {
  fileName,
  fileSize,
  drawingDocs,
  rollup,
  runs,
  marks,
  settings = DEFAULT_TRUE_BID_SETTINGS,
} = {}) {
  const crew = existing?.crew?.length ? existing.crew : defaultCrew();
  const crewRate = compositeWage(crew).rate || journeymanWage(crew) || num(settings.laborRate);
  const laborRate = num(settings.laborRate) || crewRate;
  const analysis = analyzeElectricalTakeoff({ drawingDocs, rollup, runs, marks });
  const generated = buildTrueElectricalEstimateLines({ analysis, rollup, runs, laborRate });
  const lines = mergeGeneratedLines(existing?.lines || [], generated);
  const scopeNotes = [
    existing?.header?.scopeNotes,
    "TRUE ELECTRICAL TAKEOFF AUDIT",
    `${analysis.sheetCount} sheets reviewed · ${analysis.totals.devices} device counts · ${analysis.totals.conduitLf.toFixed(1)} measured conduit LF.`,
    analysis.warnings.length ? `Bid-lock warnings: ${analysis.warnings.join(" | ")}` : "No bid-lock warnings remain.",
    "Budget material baselines must be replaced by vendor quotes for major gear and specified fixtures before final bid.",
  ].filter(Boolean).join("\n");
  return {
    ...existing,
    version: Math.max(2, Number(existing?.version) || 0),
    fileName: fileName || existing?.fileName || "",
    fileSize: fileSize || existing?.fileSize || 0,
    header: {
      ...(existing?.header || {}),
      projectName: existing?.header?.projectName || drawingDocs?.titleBlock?.projectName || String(fileName || "Electrical estimate").replace(/\.[^.]+$/, ""),
      projectAddress: existing?.header?.projectAddress || drawingDocs?.titleBlock?.projectAddress || "",
      scopeNotes,
    },
    crew,
    lines,
    overhead: num(settings.overhead),
    profit: num(settings.profit),
    contingency: num(settings.contingency),
    bondInsurance: num(settings.bondInsurance),
    trueTakeoff: {
      analysis,
      settings: { ...settings, laborRate },
      summary: calculateTrueBidSummary(lines, { ...settings, laborRate }),
      byScope: calculateBidByScope(lines, { ...settings, laborRate }),
      workCategories: calculateWorkCategoryBreakdown(lines),
      updatedAt: new Date().toISOString(),
    },
    separateFromTakeoff: true,
  };
}

export function trueTakeoffCsv(analysis, lines, summary) {
  const csv = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const rows = [
    ["TRUE ELECTRICAL TAKEOFF"],
    ["Sheets", analysis?.sheetCount || 0],
    ["Devices", analysis?.totals?.devices || 0],
    ["Measured conduit LF", analysis?.totals?.conduitLf || 0],
    [],
    ["Work Category", "Source Category", "Description", "Qty", "Unit", "Material $/Unit", "MH/Unit", "Total MH", "Labor $/Hr", "Labor $", "Scope", "Confidence", "Notes"],
  ];
  for (const line of lines || []) {
    const qty = num(line.quantity);
    const mh = qty * num(line.laborMhPerUnit);
    const labor = mh * num(line.laborRate);
    rows.push([
      workCategoryForEstimateLine(line),
      line.category,
      line.description,
      line.quantity,
      line.unit,
      line.materialUnitCost,
      line.laborMhPerUnit,
      money(mh),
      line.laborRate,
      money(labor),
      line.trueTakeoff?.scope || "",
      line.trueTakeoff?.confidence || "",
      line.notes || "",
    ]);
  }
  rows.push([]);
  rows.push(["WORK CATEGORY TOTALS"]);
  rows.push(["Work Category", "Lines", "Material", "Man-hours", "Labor", "Direct"]);
  for (const row of calculateWorkCategoryBreakdown(lines)) {
    rows.push([row.category, row.lineCount, row.material, row.hours, row.labor, row.direct]);
  }
  rows.push([]);
  rows.push(["Material", summary?.material || 0]);
  rows.push(["Labor hours", summary?.hours || 0]);
  rows.push(["Labor", summary?.labor || 0]);
  rows.push(["Direct", summary?.direct || 0]);
  rows.push(["Contingency", summary?.contingency || 0]);
  rows.push(["Overhead", summary?.overhead || 0]);
  rows.push(["Profit", summary?.profit || 0]);
  rows.push(["Bond / insurance", summary?.bondInsurance || 0]);
  rows.push(["Bid total", summary?.total || 0]);
  if (analysis?.warnings?.length) {
    rows.push([]);
    rows.push(["BID-LOCK WARNINGS"]);
    for (const warning of analysis.warnings) rows.push([warning]);
  }
  return rows.map((row) => row.map(csv).join(",")).join("\n");
}


export const WORK_CATEGORY_ORDER = [
  "Rough-in",
  "Wire / Cable Pulling",
  "Equipment Termination",
  "Device Install",
  "Other / Review",
];

export function workCategoryForEstimateLine(line) {
  const category = String(line?.category || "").toLowerCase();
  const itemType = String(line?.itemType || "").toLowerCase();
  const text = `${line?.description || ""} ${line?.category || ""} ${line?.itemType || ""}`.toLowerCase();

  if (
    itemType === "wire"
    || /\bwire\b|\bcable\b|conductor|thhn|thwn|mc cable|romex|fiber|cat\s*6|cat6|pull(?:ing)?\s+(?:wire|cable)/i.test(text)
  ) return "Wire / Cable Pulling";

  if (
    category === "raceway"
    || /conduit|emt\b|pvc\b|rigid|rmc\b|imc\b|wiremold|raceway|cable tray|ladder tray|basket tray|junction box|pull box|device box|unistrut|strut|rack|support|sleeve|trench|ductbank|duct bank|concrete encasement/i.test(text)
  ) return "Rough-in";

  if (
    category === "panels / mcc"
    || category === "mechanical connections"
    || /service|switchgear|switchboard|panel(?:board)?|subpanel|transformer|vfd\b|plc\b|motor control|\bmcc\b|unit sub|unit substation|vav\b|ahu\b|rtu\b|ptac\b|exhaust fan|ventilation fan|electric heater|disconnect|termination|motor\b|generator|\bats\b|meter|surge protective|\bspd\b/i.test(text)
  ) return "Equipment Termination";

  if (
    itemType === "device"
    || itemType === "fixture"
    || category === "lighting"
    || category === "receptacles"
    || category === "switches"
    || /light|fixture|luminaire|recept|outlet|gfci|gfi|switch|dimmer|occupancy sensor|photocell|device|exit sign|emergency light/i.test(text)
  ) return "Device Install";

  return "Other / Review";
}

export function calculateWorkCategoryBreakdown(lines) {
  const grouped = Object.fromEntries(WORK_CATEGORY_ORDER.map((name) => [name, {
    category: name,
    lineCount: 0,
    quantity: 0,
    material: 0,
    hours: 0,
    labor: 0,
    direct: 0,
    lines: [],
  }]));

  for (const line of lines || []) {
    if (line?.included === false) continue;
    const category = workCategoryForEstimateLine(line);
    const row = grouped[category];
    const quantity = num(line?.quantity);
    const material = quantity * num(line?.materialUnitCost);
    const hours = quantity * num(line?.laborMhPerUnit);
    const labor = hours * num(line?.laborRate);
    row.lineCount += 1;
    row.quantity += quantity;
    row.material += material;
    row.hours += hours;
    row.labor += labor;
    row.direct += material + labor;
    row.lines.push({
      id: line?.id,
      description: line?.description || "",
      sourceCategory: line?.category || "",
      quantity: money(quantity),
      unit: line?.unit || "",
      material: money(material),
      hours: money(hours),
      labor: money(labor),
      direct: money(material + labor),
    });
  }

  return WORK_CATEGORY_ORDER.map((name) => ({
    ...grouped[name],
    quantity: money(grouped[name].quantity),
    material: money(grouped[name].material),
    hours: money(grouped[name].hours),
    labor: money(grouped[name].labor),
    direct: money(grouped[name].direct),
  }));
}
