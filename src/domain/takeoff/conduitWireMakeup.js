function num(value) {
  return Number(value) || 0;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeAwg(value) {
  const text = String(value || "").trim().replace(/^#/, "");
  if (!text) return "";
  if (/^\d+\/0$/i.test(text)) return text.toUpperCase();
  if (/^\d+$/.test(text)) return text;
  return String(value || "").trim();
}

function awgRank(value) {
  const awg = normalizeAwg(value);
  const order = ["14","12","10","8","6","4","3","2","1","1/0","2/0","3/0","4/0"];
  const index = order.indexOf(awg);
  return index < 0 ? -1 : index;
}

function largerAwg(a, b) {
  if (!a) return b;
  if (!b) return a;
  return awgRank(a) >= awgRank(b) ? a : b;
}

function inferredWireSize(amps) {
  const a = num(amps);
  if (!a) return "";
  if (a <= 15) return "14";
  if (a <= 20) return "12";
  if (a <= 30) return "10";
  if (a <= 40) return "8";
  if (a <= 60) return "6";
  if (a <= 70) return "4";
  if (a <= 85) return "3";
  if (a <= 100) return "3";
  if (a <= 115) return "2";
  if (a <= 130) return "1";
  if (a <= 150) return "1/0";
  if (a <= 175) return "2/0";
  if (a <= 200) return "3/0";
  return "";
}

function inferredGroundSize(amps) {
  const a = num(amps);
  if (!a) return "";
  if (a <= 20) return "12";
  if (a <= 60) return "10";
  if (a <= 100) return "8";
  if (a <= 200) return "6";
  if (a <= 300) return "4";
  if (a <= 400) return "3";
  return "";
}

function parseAmps(device) {
  const explicit = num(device?.breakerAmps || device?.circuitAmps || device?.amps);
  if (explicit) return { value: explicit, source: "explicit" };
  const text = `${device?.symbolLabel || ""} ${device?.notes || ""} ${device?.description || ""}`;
  const match = text.match(/\b(15|20|25|30|35|40|45|50|60|70|80|90|100|110|125|150|175|200)\s*A\b/i);
  if (match) return { value: Number(match[1]), source: "drawing-text" };
  const category = String(device?.category || "").toLowerCase();
  if (/recept|lighting|switch/.test(category)) return { value: 20, source: "branch-default" };
  return { value: 0, source: "unknown" };
}

function parsePoles(device) {
  const explicit = num(device?.circuitPoles || device?.poles);
  if (explicit >= 1 && explicit <= 3) return { value: explicit, source: "explicit" };
  const text = `${device?.symbolLabel || ""} ${device?.notes || ""} ${device?.description || ""}`;
  const match = text.match(/\b([123])\s*P(?:OLE)?\b/i);
  if (match) return { value: Number(match[1]), source: "drawing-text" };
  return { value: 1, source: "branch-default" };
}

function neutralRequirement(device, poles) {
  if (typeof device?.neutralRequired === "boolean") return { value: device.neutralRequired, source: "explicit" };
  if (typeof device?.circuitNeutralRequired === "boolean") return { value: device.circuitNeutralRequired, source: "explicit" };
  const text = `${device?.symbolLabel || ""} ${device?.notes || ""} ${device?.description || ""}`.toLowerCase();
  if (/no neutral|2-wire 208|240v\s*1ph|208v\s*1ph/.test(text)) return { value: false, source: "drawing-text" };
  if (/120v|277v|recept|lighting|light|switch/.test(text) || poles === 1) return { value: true, source: poles === 1 ? "branch-default" : "drawing-text" };
  return { value: false, source: "review" };
}

function circuitText(device) {
  return String(device?.circuit || device?.circuitNumber || "").trim();
}

function explicitWireSize(device) {
  return normalizeAwg(device?.circuitWireSize || device?.wireSize || device?.conductorSize || "");
}

function explicitGroundSize(device) {
  return normalizeAwg(device?.circuitGroundSize || device?.groundSize || "");
}

function circuitKey(device) {
  return circuitText(device).toUpperCase();
}

export function buildConduitWireMakeup({
  marks = [],
  runs = [],
  longCircuitRule = null,
} = {}) {
  const runById = new Map((runs || []).map((run) => [run.id, run]));
  const conduitMarks = (marks || []).filter((mark) => mark?.tool === "conduit" || (mark?.type === "route" && mark?.tool === "conduit"));
  const devices = (marks || []).filter((mark) => (mark?.type === "count" || mark?.type === "drop") && mark?.circuitRunId);

  const rows = [];
  for (const conduit of conduitMarks) {
    const run = runById.get(conduit.id);
    const lengthLf = num(run?.lf || conduit?.storedFeet);
    const assigned = devices.filter((device) => device.circuitRunId === conduit.id);
    const byCircuit = new Map();

    for (const device of assigned) {
      const key = circuitKey(device);
      if (!key) continue;
      if (!byCircuit.has(key)) byCircuit.set(key, []);
      byCircuit.get(key).push(device);
    }

    const circuits = [];
    let largestGround = "";
    let groundAmps = 0;
    const wireTotals = new Map();
    const warnings = [];

    for (const [circuit, circuitDevices] of byCircuit.entries()) {
      const sample = circuitDevices[0];
      const ampsInfo = parseAmps(sample);
      const polesInfo = parsePoles(sample);
      const neutralInfo = neutralRequirement(sample, polesInfo.value);
      let wireSize = explicitWireSize(sample) || inferredWireSize(ampsInfo.value);
      let sizeSource = explicitWireSize(sample) ? "explicit" : (wireSize ? "amp-inference" : "unknown");

      if (longCircuitRule && lengthLf > num(longCircuitRule.thresholdFeet) && num(longCircuitRule.conductorAwg)) {
        const required = String(longCircuitRule.conductorAwg);
        if (!wireSize || awgRank(required) > awgRank(wireSize)) {
          wireSize = required;
          sizeSource = "drawing-long-circuit-rule";
        }
      }

      let groundSize = explicitGroundSize(sample) || inferredGroundSize(ampsInfo.value);
      if (ampsInfo.value > groundAmps) {
        groundAmps = ampsInfo.value;
        largestGround = groundSize;
      } else {
        largestGround = largerAwg(largestGround, groundSize);
      }

      const hotCount = Math.max(1, polesInfo.value);
      const neutralCount = neutralInfo.value ? 1 : 0;
      const conductorCount = hotCount + neutralCount;
      const conductorFeet = lengthLf * conductorCount;
      if (wireSize) wireTotals.set(wireSize, num(wireTotals.get(wireSize)) + conductorFeet);

      const confidence = [ampsInfo.source, polesInfo.source, neutralInfo.source, sizeSource].some((source) => ["unknown","review","branch-default","amp-inference"].includes(source))
        ? "review"
        : "high";

      if (!ampsInfo.value) warnings.push(`${circuit}: breaker amperage is unknown.`);
      if (!wireSize) warnings.push(`${circuit}: conductor size is unknown.`);
      if (polesInfo.source === "branch-default") warnings.push(`${circuit}: assumed 1-pole; verify circuit poles.`);
      if (neutralInfo.source === "branch-default") warnings.push(`${circuit}: assumed neutral required; verify circuit wiring.`);

      circuits.push({
        circuit,
        breakerAmps: ampsInfo.value,
        poles: polesInfo.value,
        neutralRequired: neutralInfo.value,
        hotCount,
        neutralCount,
        wireSize,
        sizeSource,
        conductorCount,
        conductorFeet,
        deviceCount: circuitDevices.length,
        confidence,
      });
    }

    const groundCount = circuits.length && largestGround ? 1 : 0;
    const groundFeet = groundCount ? lengthLf : 0;
    if (groundCount) wireTotals.set(`${largestGround} GND`, num(wireTotals.get(`${largestGround} GND`)) + groundFeet);

    rows.push({
      conduitId: conduit.id,
      runNumber: conduit.runNumber || run?.runNumber || null,
      sheet: conduit.sheet || run?.sheet || 1,
      conduitSize: conduit.conduitSize || conduit.abbr || "",
      conduitMaterial: conduit.conduitMaterial || "",
      lengthLf,
      circuits,
      circuitCount: circuits.length,
      deviceCount: assigned.length,
      groundSize: largestGround,
      groundCount,
      groundFeet,
      wireTotals: [...wireTotals.entries()].map(([size, feet]) => ({ size, feet })),
      totalConductorFeet: [...wireTotals.values()].reduce((sum, feet) => sum + num(feet), 0),
      warnings: uniq(warnings),
      status: !lengthLf || !circuits.length || warnings.length ? "review" : "ready",
    });
  }

  return rows.sort((a, b) => (a.sheet - b.sheet) || ((a.runNumber || 0) - (b.runNumber || 0)));
}

export function aggregateWirePulling(makeupRows) {
  const totals = new Map();
  for (const row of makeupRows || []) {
    for (const wire of row.wireTotals || []) {
      const key = wire.size;
      totals.set(key, num(totals.get(key)) + num(wire.feet));
    }
  }
  return [...totals.entries()]
    .map(([size, feet]) => ({ size, feet: Math.round(feet * 100) / 100 }))
    .sort((a, b) => awgRank(a.size.replace(/\s+GND$/i, "")) - awgRank(b.size.replace(/\s+GND$/i, "")));
}

export function conduitWireMakeupCsv(rows) {
  const csv = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const out = [[
    "Conduit #","Sheet","Conduit","Length LF","Circuit","Breaker A","Poles","Neutral","Wire Size",
    "Hot Count","Neutral Count","Circuit Conductor LF","Ground Size","Total Conductor LF","Status","Warnings",
  ]];
  for (const row of rows || []) {
    if (!row.circuits.length) {
      out.push([
        row.runNumber || "", row.sheet, [row.conduitSize,row.conduitMaterial].filter(Boolean).join(" "),
        row.lengthLf, "", "", "", "", "", "", "", "", row.groundSize, row.totalConductorFeet, row.status, row.warnings.join(" | "),
      ]);
      continue;
    }
    row.circuits.forEach((circuit, index) => {
      out.push([
        row.runNumber || "", row.sheet, [row.conduitSize,row.conduitMaterial].filter(Boolean).join(" "),
        row.lengthLf, circuit.circuit, circuit.breakerAmps || "", circuit.poles,
        circuit.neutralRequired ? "Yes" : "No", circuit.wireSize || "", circuit.hotCount, circuit.neutralCount,
        circuit.conductorFeet, index === 0 ? row.groundSize : "", index === 0 ? row.totalConductorFeet : "",
        row.status, index === 0 ? row.warnings.join(" | ") : "",
      ]);
    });
  }
  return out.map((row) => row.map(csv).join(",")).join("\n");
}
