import React, { useMemo, useRef, useState } from "react";
import {
  Cable, FileUp, Hand, Image as ImageIcon, Layers3, MousePointer2, Pencil,
  Ruler, Route, ScanSearch, Shapes, Trash2, Undo2, Upload, ZoomIn, ZoomOut
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_DEFS = [
  { key: "select", label: "Select / Edit", icon: MousePointer2, help: "Select existing marks and routes." },
  { key: "count", label: "Count", icon: Shapes, help: "Click devices to place numbered count marks." },
  { key: "linear", label: "Linear", icon: Ruler, help: "Click two points to measure a straight run." },
  { key: "conduit", label: "Conduit Route", icon: Route, help: "Click points to draw a conduit route. Double-click to finish." },
  { key: "circuit", label: "Circuit Trace", icon: Cable, help: "Trace a circuit path across the drawing." },
  { key: "markup", label: "Markup", icon: Pencil, help: "Click to place a text note." },
  { key: "pan", label: "Pan", icon: Hand, help: "Move around the drawing." },
];

const CATEGORIES = ["Receptacles", "Lighting", "HVAC", "Panels / MCC", "Equipment", "Raceway", "Low Voltage", "Access Control"];

export default function TakeoffWorkspace() {
  const inputRef = useRef(null);
  const viewerRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [mode, setMode] = useState("manual");
  const [tool, setTool] = useState("count");
  const [category, setCategory] = useState("Receptacles");
  const [zoom, setZoom] = useState(1);
  const [marks, setMarks] = useState([]);
  const [draftPoints, setDraftPoints] = useState([]);
  const [status, setStatus] = useState("Upload a drawing to begin.");

  const isPdf = file?.type === "application/pdf" || file?.name?.toLowerCase().endsWith(".pdf");
  const counts = useMemo(() => marks.filter((m) => m.type === "count").reduce((acc, mark) => {
    acc[mark.category] = (acc[mark.category] || 0) + 1;
    return acc;
  }, {}), [marks]);

  function chooseFile(nextFile) {
    if (!nextFile) return;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    const url = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setFileUrl(url);
    setMarks([]);
    setDraftPoints([]);
    setStatus(`${nextFile.name} loaded. Choose a takeoff tool and begin.`);
  }

  function drawingPoint(event) {
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function onDrawingClick(event) {
    if (!file || tool === "pan" || tool === "select") return;
    const point = drawingPoint(event);
    if (!point) return;

    if (tool === "count") {
      setMarks((current) => [...current, { id: crypto.randomUUID(), type: "count", category, ...point }]);
      setStatus(`${category}: ${(counts[category] || 0) + 1} counted.`);
      return;
    }

    if (tool === "markup") {
      const text = window.prompt("Markup note");
      if (text) setMarks((current) => [...current, { id: crypto.randomUUID(), type: "note", category, text, ...point }]);
      return;
    }

    if (tool === "linear") {
      if (draftPoints.length === 0) {
        setDraftPoints([point]);
        setStatus("Linear measurement started. Click the end point.");
      } else {
        const start = draftPoints[0];
        setMarks((current) => [...current, { id: crypto.randomUUID(), type: "line", category, tool, points: [start, point] }]);
        setDraftPoints([]);
        setStatus("Linear measurement added.");
      }
      return;
    }

    if (tool === "conduit" || tool === "circuit") {
      setDraftPoints((current) => [...current, point]);
      setStatus("Route in progress. Double-click to finish.");
    }
  }

  function finishRoute(event) {
    if (!["conduit", "circuit"].includes(tool) || draftPoints.length < 2) return;
    event.preventDefault();
    setMarks((current) => [...current, {
      id: crypto.randomUUID(),
      type: "route",
      category,
      tool,
      points: draftPoints,
    }]);
    setDraftPoints([]);
    setStatus(tool === "conduit" ? "Conduit route added." : "Circuit trace added.");
  }

  function undo() {
    if (draftPoints.length) return setDraftPoints((current) => current.slice(0, -1));
    setMarks((current) => current.slice(0, -1));
  }

  function clearAll() {
    if (marks.length && !window.confirm("Clear all takeoff marks on this drawing?")) return;
    setMarks([]);
    setDraftPoints([]);
  }

  const activeTool = TOOL_DEFS.find((item) => item.key === tool);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-orange-500">Estim8r Takeoff</p>
            <h1 className="mt-1 text-2xl font-black text-foreground">Electrical Drawing Takeoff Workspace</h1>
            <p className="mt-1 text-sm text-muted-foreground">Upload drawings for manual, AI-assisted, or hybrid takeoff. Manual tools work directly on the drawing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["manual", "Manual"],
              ["ai", "AI Assisted"],
              ["hybrid", "Hybrid"],
            ].map(([value, label]) => (
              <button key={value} onClick={() => setMode(value)} className={cn(
                "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                mode === value ? "border-blue-600 bg-blue-600 text-white dark:border-orange-500 dark:bg-orange-500" : "border-border bg-background text-foreground hover:bg-muted"
              )}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <input ref={inputRef} type="file" accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => chooseFile(e.target.files?.[0])} />
        {!file ? (
          <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); chooseFile(e.dataTransfer.files?.[0]); }}
            className="flex min-h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-8 text-center transition hover:border-blue-500 hover:bg-blue-50 dark:border-orange-500/30 dark:bg-orange-500/5 dark:hover:border-orange-500">
            <FileUp className="mb-3 h-10 w-10 text-blue-600 dark:text-orange-500" />
            <span className="text-lg font-bold text-foreground">Upload electrical drawings</span>
            <span className="mt-1 text-sm text-muted-foreground">PDF, PNG, JPG, or WEBP</span>
            <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white dark:bg-orange-500"><Upload className="h-4 w-4" />Choose drawing</span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-orange-500/10 dark:text-orange-500"><ImageIcon className="h-5 w-5" /></div>
              <div className="min-w-0"><div className="truncate font-bold text-foreground">{file.name}</div><div className="text-xs text-muted-foreground">{isPdf ? "PDF drawing set" : "Drawing image"} • {(file.size / 1024 / 1024).toFixed(2)} MB</div></div>
            </div>
            <button onClick={() => inputRef.current?.click()} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted">Replace drawing</button>
          </div>
        )}
      </section>

      {file && (
        <div className="grid gap-4 xl:grid-cols-[230px_minmax(0,1fr)_250px]">
          <aside className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Manual tools</div>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                {TOOL_DEFS.map((item) => {
                  const Icon = item.icon;
                  return <button key={item.key} type="button" onClick={() => { setTool(item.key); setDraftPoints([]); }}
                    className={cn("flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-semibold transition-colors",
                      tool === item.key ? "border-blue-600 bg-blue-50 text-blue-700 dark:border-orange-500 dark:bg-orange-500/10 dark:text-orange-300" : "border-border bg-background text-foreground hover:bg-muted")}>
                    <Icon className="h-4 w-4 shrink-0" />{item.label}
                  </button>;
                })}
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">Takeoff category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm text-foreground">
                {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
              <strong className="block text-foreground">{activeTool?.label}</strong>{activeTool?.help}
            </div>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2">
              <div className="flex items-center gap-1">
                <button onClick={undo} className="rounded-lg p-2 hover:bg-muted" title="Undo"><Undo2 className="h-4 w-4" /></button>
                <button onClick={() => setZoom((z) => Math.max(.5, z - .1))} className="rounded-lg p-2 hover:bg-muted" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
                <span className="min-w-14 text-center text-xs font-semibold">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(2.5, z + .1))} className="rounded-lg p-2 hover:bg-muted" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
              </div>
              <button onClick={clearAll} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" />Clear marks</button>
            </div>

            <div className="overflow-auto bg-muted/40 p-3" style={{ minHeight: 620 }}>
              <div ref={viewerRef} onClick={onDrawingClick} onDoubleClick={finishRoute}
                className={cn("relative mx-auto overflow-hidden bg-white shadow-lg", tool === "pan" ? "cursor-grab" : tool === "select" ? "cursor-default" : "cursor-crosshair")}
                style={{ width: `${zoom * 100}%`, minWidth: isPdf ? 720 : undefined }}>
                {isPdf ? (
                  <iframe title={file.name} src={fileUrl} className="block h-[760px] w-full border-0 bg-white pointer-events-none" />
                ) : (
                  <img src={fileUrl} alt={file.name} draggable={false} className="block h-auto w-full select-none" />
                )}
                <MarkupOverlay marks={marks} draftPoints={draftPoints} />
              </div>
            </div>
            <div className="border-t border-border bg-background px-3 py-2 text-xs text-muted-foreground">{status}</div>
          </section>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2"><Layers3 className="h-4 w-4 text-blue-600 dark:text-orange-500" /><h3 className="font-bold">Takeoff totals</h3></div>
              <div className="space-y-2">
                {CATEGORIES.map((item) => <div key={item} className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{item}</span><strong>{counts[item] || 0}</strong></div>)}
              </div>
              <div className="mt-3 border-t border-border pt-3 text-sm"><div className="flex justify-between"><span className="font-bold">Total devices</span><strong>{Object.values(counts).reduce((a, b) => a + b, 0)}</strong></div></div>
            </div>

            {(mode === "ai" || mode === "hybrid") && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-orange-500/30 dark:bg-orange-500/5">
                <div className="flex items-center gap-2 font-bold"><ScanSearch className="h-4 w-4 text-blue-600 dark:text-orange-500" />AI drawing analysis</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">The drawing is loaded and ready for the recognition pipeline. Automatic symbol detection and routing will populate this same workspace when the analysis worker is connected.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function MarkupOverlay({ marks, draftPoints }) {
  const allRoutes = marks.filter((m) => m.type === "line" || m.type === "route");
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {allRoutes.map((mark) => {
        const points = mark.points.map((p) => `${p.x},${p.y}`).join(" ");
        return <polyline key={mark.id} points={points} fill="none" stroke={mark.tool === "circuit" ? "#7c3aed" : "#2563eb"} strokeWidth=".45" vectorEffect="non-scaling-stroke" />;
      })}
      {draftPoints.length > 1 && <polyline points={draftPoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#f97316" strokeWidth=".45" strokeDasharray="1 1" vectorEffect="non-scaling-stroke" />}
      {marks.filter((m) => m.type === "count").map((mark, index) => (
        <g key={mark.id}>
          <circle cx={mark.x} cy={mark.y} r="1.4" fill="#2563eb" stroke="white" strokeWidth=".3" vectorEffect="non-scaling-stroke" />
          <text x={mark.x} y={mark.y + .45} textAnchor="middle" fontSize="1.3" fontWeight="700" fill="white">{index + 1}</text>
        </g>
      ))}
      {marks.filter((m) => m.type === "note").map((mark) => (
        <text key={mark.id} x={mark.x} y={mark.y} fontSize="1.8" fontWeight="700" fill="#dc2626">{mark.text}</text>
      ))}
    </svg>
  );
}
