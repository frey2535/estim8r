import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Calculator, FileText, FolderOpen, Image as ImageIcon, Shield, ShieldCheck, StickyNote, Trash2, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { canManageEstim8rAccess } from "@/lib/ownerAccessRules";
import {
  deleteDrawingFile,
  deleteProjectFolder,
  downloadBlob,
  getDrawingFile,
  isDrawingFileName,
  listProjectFolders,
  upsertProjectFolder,
} from "@/domain/estimate/projectDocuments";
import { activateEstimate, deleteStoredEstimate, readEstimate } from "@/domain/estimate/estimateStore";
import { listCloudEstimates, importCloudEstimates, saveCloudEstimate } from "@/api/estimateCloudRepository";
import { readCompanyBranding } from "@/domain/estimate/branding";
import { estimatePdfBlob } from "@/domain/estimate/estimatePdf";

/** @type {[string, string, string, import("react").ComponentType<{ className?: string }>][]} */
const cards = [
  ["Create Estimate", "Build a bid using verified labor, company history and transparent productivity factors.", "/estimates/new", Calculator],
  ["Labor Library", "Search the master electrical trade labor taxonomy and inspect source verification.", "/labor", BookOpen],
  ["Production History", "Turn actual field production into company-specific labor intelligence.", "/production", TrendingUp],
];

function markupPath(folder) {
  const params = new URLSearchParams({
    file: folder.fileName || "",
    size: String(folder.fileSize || 0),
  });
  return `/markup?${params.toString()}`;
}

function FolderDocs({ folder }) {
  const navigate = useNavigate();
  const hasDrawing = isDrawingFileName(folder.fileName);

  async function downloadDrawing() {
    const file = await getDrawingFile(folder.fileName, folder.fileSize);
    if (!file) return;
    downloadBlob(file, folder.drawingName || folder.fileName);
  }

  function downloadEstimate() {
    const estimate = readEstimate(folder.fileName, folder.fileSize);
    if (!estimate) return;
    const { blob, fileName } = estimatePdfBlob(estimate, readCompanyBranding());
    downloadBlob(blob, fileName);
  }

  function openEstimate() {
    const params = new URLSearchParams({
      file: folder.fileName || "",
      size: String(folder.fileSize || 0),
    });
    activateEstimate(folder.fileName, folder.fileSize);
    navigate(`/estimates/new?${params.toString()}`);
  }

  function openMarkup() {
    navigate(markupPath(folder));
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={openEstimate} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Open estimate
      </button>
      <button type="button" onClick={downloadEstimate} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
        <FileText className="h-4 w-4" /> Estimate PDF
      </button>
      {hasDrawing ? (
        <button type="button" onClick={() => void downloadDrawing()} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
          <ImageIcon className="h-4 w-4" /> Drawing
        </button>
      ) : null}
      {hasDrawing ? (
        <button type="button" onClick={openMarkup} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted">
          <StickyNote className="h-4 w-4" /> Markup pages
        </button>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [folders, setFolders] = useState([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncFailed, setSyncFailed] = useState(false);

  async function syncEstimates() {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncMessage("");
    setSyncFailed(false);
    try {
      const remote = await listCloudEstimates();
      const remoteIds = new Set(remote.map((row) => row.id));
      const local = listProjectFolders().map((folder) => readEstimate(folder.fileName, folder.fileSize)).filter(Boolean);
      let uploaded = 0;
      for (const estimate of local) {
        if (!estimate.id || remoteIds.has(estimate.id)) continue;
        await saveCloudEstimate(estimate);
        uploaded += 1;
      }
      const imported = await importCloudEstimates(remote);
      for (const estimate of imported) {
        upsertProjectFolder({ projectName: estimate.header?.projectName || estimate.fileName, projectAddress: estimate.header?.projectAddress || "", fileName: estimate.fileName, fileSize: estimate.fileSize || 0 });
      }
      setFolders(listProjectFolders());
      setSyncMessage(`Cloud sync: ${uploaded} uploaded, ${imported.length} imported. Existing local copies were not overwritten.`);
    } catch (error) {
      const code = String(error?.code || "");
      const detail = String(error?.message || "Cloud service unavailable.");
      const missingSchema = code === "42P01" || code === "PGRST205" || code === "PGRST202" || /estim8r_estimate_snapshots|estim8r_save_snapshot|schema cache|does not exist/i.test(detail);
      setSyncFailed(true);
      setSyncMessage(missingSchema
        ? "Cloud sync is not configured on the server. Your estimates are still saved on this device. You can open and export PDFs below; do not clear browser data."
        : `Cloud sync unavailable (${code || "connection"}): ${detail}. Your local estimates remain accessible for PDF submission.`);
    } finally { setSyncBusy(false); }
  }

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
    <div className="mx-auto w-full max-w-6xl py-2 sm:py-4">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Current Flow Consulting</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Estim8r Command Center</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Estimate electrical work with traceable labor sources, company production history and estimator-controlled adjustments.</p>
        </div>
        <Link to="/estimates/new" className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Calculator className="h-4 w-4" />
          New estimate
        </Link>
      </div>

      {canManageEstim8rAccess(user) && (
        <Link to="/admin" className="mt-5 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Platform owner access</h2>
            <p className="text-sm text-muted-foreground">Open Access to grant, invite, or revoke who can use Estim8r.</p>
          </div>
        </Link>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={syncBusy} onClick={() => void syncEstimates()} className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-50">{syncBusy ? "Syncing..." : "Sync estimates across devices"}</button>{syncMessage && <p role={syncFailed ? "alert" : "status"} className={`text-sm ${syncFailed ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{syncMessage}</p>}</div>

      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Estimates folder</h2>
          <p className="hidden text-xs text-muted-foreground sm:block">Saved under the project name. Drawings and takeoff are optional.</p>
        </div>
        {folders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
            <FolderOpen className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No saved estimates yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Open New Estimate to write one. If a Buildr company is linked, the estimate also syncs to that project’s Estimate tab.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {folders.map((folder) => (
              <article key={folder.id} className="rounded-lg border border-border bg-card px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-foreground">{folder.projectName}</h3>
                    <p className="text-sm text-muted-foreground">{folder.projectAddress || "No project address yet"}</p>
                    {folder.savedTo === "buildr" ? (
                      <p className="mt-1 text-xs text-muted-foreground">Also saved on the Buildr project Estimate tab</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Delete ${folder.projectName || "this project"} from the Estimates folder?`)) return;
                      deleteStoredEstimate(folder.fileName, folder.fileSize);
                      deleteProjectFolder(folder);
                      void deleteDrawingFile(folder.fileName, folder.fileSize).catch(() => {});
                      setFolders(listProjectFolders());
                    }}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${folder.projectName || "project"}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
                <FolderDocs folder={folder} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Tools</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {cards.map(([title, text, to, Icon]) => (
            <Link key={title} to={to} className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 flex gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Production Safety Gate</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Published/master labor is only production-ready when it is verified and explicitly approved. The imported 1,921-row table is experimental / unverified. NECA hours are not populated. Unverified baselines stay visible but cannot silently become bid labor.</p>
        </div>
      </div>
    </div>
  );
}
