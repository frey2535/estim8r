import { jsPDF } from "jspdf";
import { getPdfDocument } from "@/lib/pdf-document";
import { conduitCircuitSchedule } from "./markupPages";
import { buildConduitWireMakeup } from "./conduitWireMakeup";

function fileStem(name, fallback = "takeoff") {
  return String(name || fallback).replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]+/gi, "-");
}

function pct(value, total) {
  return (Number(value) || 0) / 100 * total;
}

function drawDevice(ctx, mark, width, height, options = {}) {
  const x = pct(mark.x, width);
  const y = pct(mark.y, height);
  const radius = Math.max(5, Math.min(width, height) * 0.0045);
  ctx.save();
  ctx.globalAlpha = options.routes ? 0.32 : 0.48;
  ctx.fillStyle = mark.color || "#2563eb";
  ctx.strokeStyle = mark.color || "#2563eb";
  ctx.lineWidth = Math.max(1.5, width * 0.0012);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.stroke();
  if (!options.routes) {
    const text = String(mark.typeCode || mark.abbr || "").trim();
    if (text) {
      ctx.font = `bold ${Math.max(10, width * 0.008)}px sans-serif`;
      ctx.fillStyle = "#111827";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeText(text, x + radius + 3, y - radius - 2);
      ctx.fillText(text, x + radius + 3, y - radius - 2);
    }
  }
  ctx.restore();
}

function drawRoute(ctx, mark, width, height) {
  const points = mark.points || [];
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = mark.color || "#64748b";
  ctx.lineWidth = Math.max(3, width * 0.0022);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = pct(point.x, width);
    const y = pct(point.y, height);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  const mid = points[Math.floor(points.length / 2)];
  const label = `C${mark.runNumber || "?"}`;
  const x = pct(mid.x, width);
  const y = pct(mid.y, height);
  ctx.globalAlpha = 1;
  ctx.font = `bold ${Math.max(12, width * 0.009)}px sans-serif`;
  ctx.fillStyle = "#111827";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.strokeText(label, x + 5, y - 5);
  ctx.fillText(label, x + 5, y - 5);
  ctx.restore();
}

function drawSheetBanner(ctx, width, title, pageNumber) {
  const h = Math.max(34, width * 0.025);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#111827";
  ctx.font = `bold ${Math.max(13, width * 0.009)}px sans-serif`;
  ctx.fillText(`${title} · Source sheet ${pageNumber}`, 12, h * 0.67);
  ctx.restore();
}

export async function buildMarkedDrawingPdf({
  fileBytes,
  fileName,
  marks = [],
  mode = "devices",
} = {}) {
  if (!fileBytes) throw new Error("No drawing PDF is loaded.");
  const source = await getPdfDocument(fileBytes);
  const title = mode === "routes" ? "CONDUIT ROUTE COPY" : "COUNTED DEVICE COPY";
  let output = null;

  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    const page = await source.getPage(pageNumber);
    const renderViewport = page.getViewport({ scale: 1.5 });
    const pdfViewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

    const pageMarks = marks.filter((mark) => (Number(mark.sheet) || 1) === pageNumber);
    if (mode === "routes") {
      pageMarks.filter((mark) => mark?.tool === "conduit" || (mark?.type === "route" && mark?.tool === "conduit"))
        .forEach((mark) => drawRoute(ctx, mark, canvas.width, canvas.height));
      pageMarks.filter((mark) => mark?.type === "count" || mark?.type === "drop")
        .forEach((mark) => drawDevice(ctx, mark, canvas.width, canvas.height, { routes: true }));
    } else {
      pageMarks.filter((mark) => mark?.type === "count" || mark?.type === "drop")
        .forEach((mark) => drawDevice(ctx, mark, canvas.width, canvas.height));
    }
    drawSheetBanner(ctx, canvas.width, title, pageNumber);

    const orientation = pdfViewport.width >= pdfViewport.height ? "landscape" : "portrait";
    if (!output) {
      output = new jsPDF({
        unit: "pt",
        format: [pdfViewport.width, pdfViewport.height],
        orientation,
        compress: true,
      });
    } else {
      output.addPage([pdfViewport.width, pdfViewport.height], orientation);
    }
    const image = canvas.toDataURL("image/jpeg", 0.88);
    output.addImage(image, "JPEG", 0, 0, pdfViewport.width, pdfViewport.height, undefined, "FAST");
  }

  return {
    doc: output,
    fileName: `${fileStem(fileName)}-${mode === "routes" ? "conduit-routes" : "counted-devices"}.pdf`,
  };
}

export function buildConduitCircuitSchedulePdf({ marks = [], fileName } = {}) {
  const schedule = conduitCircuitSchedule(marks);
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const width = 792;
  const left = 32;
  const right = width - 32;
  let y = 38;

  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("CONDUIT / CIRCUIT SCHEDULE", left, y);
    y += 18;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(fileName || "Electrical takeoff", left, y);
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.text("Conduit #", left, y);
    doc.text("Sheet", left + 65, y);
    doc.text("Type / Size", left + 105, y);
    doc.text("Circuits Assigned", left + 260, y);
    doc.text("Devices", right - 45, y, { align: "right" });
    y += 10;
    doc.line(left, y, right, y);
    y += 14;
  };

  header();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const row of schedule) {
    const circuits = row.circuits.length ? row.circuits.join(", ") : "UNASSIGNED";
    const type = [row.conduitSize, row.conduitMaterial].filter(Boolean).join(" ") || row.label;
    const wrapped = doc.splitTextToSize(circuits, 300);
    const rowHeight = Math.max(22, wrapped.length * 11 + 7);
    if (y + rowHeight > 560) {
      doc.addPage("letter", "landscape");
      y = 38;
      header();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
    }
    doc.text(String(row.runNumber || "—"), left, y);
    doc.text(String(row.sheet || ""), left + 65, y);
    doc.text(String(type || ""), left + 105, y);
    doc.text(wrapped, left + 260, y);
    doc.text(String(row.deviceCount || 0), right - 45, y, { align: "right" });
    y += rowHeight;
    doc.setDrawColor(220);
    doc.line(left, y - 7, right, y - 7);
  }

  if (!schedule.length) {
    doc.text("No conduit runs have been assigned yet.", left, y);
  }

  return {
    doc,
    fileName: `${fileStem(fileName)}-conduit-circuit-schedule.pdf`,
    schedule,
  };
}


export function buildConduitWireMakeupPdf({
  marks = [],
  runs = [],
  longCircuitRule = null,
  fileName,
} = {}) {
  const rows = buildConduitWireMakeup({ marks, runs, longCircuitRule });
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const width = 792;
  const left = 28;
  const right = width - 28;
  let y = 34;

  const header = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("CONDUIT WIRE MAKEUP", left, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(fileName || "Electrical takeoff", left, y);
    y += 20;
    doc.setFont("helvetica", "bold");
    doc.text("C#", left, y);
    doc.text("Sheet", left + 28, y);
    doc.text("Conduit", left + 64, y);
    doc.text("LF", left + 145, y, { align: "right" });
    doc.text("Circuit", left + 170, y);
    doc.text("A", left + 260, y, { align: "right" });
    doc.text("P", left + 282, y, { align: "right" });
    doc.text("Neutral", left + 300, y);
    doc.text("Wire", left + 350, y);
    doc.text("Cond.", left + 405, y, { align: "right" });
    doc.text("Circuit LF", left + 470, y, { align: "right" });
    doc.text("Ground", left + 510, y);
    doc.text("Total Wire LF", left + 635, y, { align: "right" });
    doc.text("Status", right, y, { align: "right" });
    y += 9;
    doc.line(left, y, right, y);
    y += 12;
  };

  header();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (const row of rows) {
    const circuits = row.circuits.length ? row.circuits : [null];
    for (let i = 0; i < circuits.length; i += 1) {
      const circuit = circuits[i];
      if (y > 555) {
        doc.addPage("letter", "landscape");
        y = 34;
        header();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }
      if (i === 0) {
        doc.text(String(row.runNumber || "—"), left, y);
        doc.text(String(row.sheet || ""), left + 28, y);
        doc.text([row.conduitSize, row.conduitMaterial].filter(Boolean).join(" "), left + 64, y);
        doc.text(row.lengthLf.toFixed(1), left + 145, y, { align: "right" });
      }
      if (circuit) {
        doc.text(circuit.circuit || "", left + 170, y);
        doc.text(circuit.breakerAmps ? String(circuit.breakerAmps) : "?", left + 260, y, { align: "right" });
        doc.text(String(circuit.poles || "?"), left + 282, y, { align: "right" });
        doc.text(circuit.neutralRequired ? "Yes" : "No", left + 300, y);
        doc.text(circuit.wireSize ? "#" + circuit.wireSize : "?", left + 350, y);
        doc.text(String(circuit.conductorCount || 0), left + 405, y, { align: "right" });
        doc.text(circuit.conductorFeet.toFixed(1), left + 470, y, { align: "right" });
      } else {
        doc.text("UNASSIGNED", left + 170, y);
      }
      if (i === 0) {
        doc.text(row.groundSize ? "#" + row.groundSize : "—", left + 510, y);
        doc.text(row.totalConductorFeet.toFixed(1), left + 635, y, { align: "right" });
        doc.text(row.status.toUpperCase(), right, y, { align: "right" });
      }
      y += 14;
    }
    if (row.warnings.length) {
      const wrapped = doc.splitTextToSize("Review: " + row.warnings.join(" | "), right - left - 22);
      doc.setTextColor(180, 100, 0);
      doc.text(wrapped, left + 12, y);
      doc.setTextColor(0, 0, 0);
      y += wrapped.length * 10 + 4;
    }
    doc.setDrawColor(225);
    doc.line(left, y, right, y);
    y += 8;
  }

  if (!rows.length) doc.text("No conduit runs are available.", left, y);

  return {
    doc,
    fileName: fileStem(fileName) + "-conduit-wire-makeup.pdf",
    rows,
  };
}
