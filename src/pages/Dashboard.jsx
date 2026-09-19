import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Calculator, FileText, FolderOpen, Image as ImageIcon, ShieldCheck, StickyNote, TrendingUp } from "lucide-react";
import {
  buildMarkupPages,
  downloadBlob,
  getDrawingFile,
  listProjectFolders,
  readTakeoffSession,
} from "@/domain/estimate/projectDocuments";
import { readEstimate } from "@/domain/estimate/estimateStore";

const cards = [
  ["Create Estimate", "Build a bid using verified labor, company history and transparent productivity factors.", "/estimates/new", Calculator],
  ["Labor Library", "Search the master electrical trade labor taxonomy and inspect source verification.", "/labor", BookOpen],
  ["Production History", "Turn actual field production into company-specific labor intelligence.", "/production", TrendingUp],
];

function FolderDocs({ folder }) {
  async function downloadDrawing() {
    const file = await getDrawingFile(folder.fileName, folder.fileSize);
    if (!file) return;
    downloadBlob(file, folder.drawingName || folder.fileName);
  }

  function downloadEstimate() {
    const estimate = readEstimate(folder.fileName, folder.fileSize);
    if (!estimate) return;
    downloadBlob(
      new Blob([JSON.stringify(estimate, null, 2)], { type: "application/json" }),
      folder.estimateName || `${folder.projectName}-estimate.json`,
    );
  }

  function downloadMarkup() {
    const takeoff = readTakeoffSession(folder.fileName, folder.fileSize);
    const markup = buildMarkupPages({
      fileName: folder.fileName,
      pageCount: Math.max(Number(takeoff?.pageCount) || 1, Number(takeoff?.sheet) || 1, ...((takeoff?.marks || []).map((mark) => Number(mark.sheet) || 1)), 1),
      marks: takeoff?.marks || [],
      calibration: takeoff?.calibration || null,
    });
    downloadBlob(
      new Blob([JSON.stringify(markup, null, 2)], { type: "application/json" }),
      folder.markupName || `${folder.projectName}-markup-pages.json`,
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => void downloadDrawing()} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
        <ImageIcon className="h-3.5 w-3.5" /> Drawing
      </button>
      <button type="button" onClick={downloadEstimate} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
        <FileText className="h-3.5 w-3.5" /> Estimate
      </button>
      <button type="button" onClick={downloadMarkup} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
        <StickyNote className="h-3.5 w-3.5" /> Markup pages
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    setFolders(listProjectFolders());
    const refresh = () => setFolders(listProjectFolders());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <div className="py-4 sm:py-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Current Flow Consulting</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-foreground">Estim8r Command Center</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Estimate electrical work with traceable labor sources, company production history and estimator-controlled adjustments.</p>
      </div>
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {cards.map(([title, text, to, Icon]) => (
          <Link to={to} key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-blue-500/60 hover:shadow-md dark:hover:border-orange-500/60">
            <Icon className="mb-4 h-7 w-7 text-blue-600 dark:text-orange-500" />
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
          </Link>
        ))}
      </div>

      <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <FolderOpen className="mt-0.5 h-6 w-6 text-blue-600 dark:text-orange-500" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-foreground">Estimates folder</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              After drawings are uploaded and an estimate is created, documents are stored under the project name.
              If you do not have a Buildr account, they stay here with the project address under the name.
            </p>
          </div>
        </div>
        {folders.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No saved project documents yet. Upload drawings on Takeoff, then create the estimate.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {folders.map((folder) => (
              <article key={folder.id} className="rounded-xl border border-border px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground">{folder.projectName}</h3>
                    <p className="text-sm text-muted-foreground">{folder.projectAddress || "No project address yet"}</p>
                    {folder.savedTo === "buildr" ? (
                      <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-orange-500">Also saved on the Buildr project Estimate tab</p>
                    ) : null}
                  </div>
                  <Link to="/estimates/new" className="text-sm font-semibold text-blue-600 dark:text-orange-500">Open estimate</Link>
                </div>
                <FolderDocs folder={folder} />
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
        <div className="flex gap-4">
          <ShieldCheck className="h-7 w-7 text-emerald-500" />
          <div>
            <h2 className="font-bold text-foreground">Production Safety Gate</h2>
            <p className="mt-1 text-sm text-muted-foreground">Published/master labor is only production-ready when it is verified and explicitly approved. The imported 1,921-row table is experimental / unverified. NECA hours are not populated. Unverified baselines stay visible but cannot silently become bid labor.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
