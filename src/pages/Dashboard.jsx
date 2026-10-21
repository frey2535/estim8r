import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Calculator, FileText, FolderOpen, Image as ImageIcon, Shield, ShieldCheck, StickyNote, Trash2, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { canManageEstim8rAccess } from "@/lib/ownerAccessRules";
import { readLinkedBuildrCompanyId } from "@/lib/buildrCompany";
import { readBuildrFamilyAccess } from "@/lib/buildrFamilyAccess";
import {
  buildrApiUrl,
  fetchBuildrAccountStatus,
  fetchBuildrEstimates,
  isBuildrConfigured,
  readBuildrSessionToken,
} from "@/api/buildrBridge";
import {
  deleteDrawingFile,
  deleteProjectFolder,
  downloadBlob,
  draftFromBuildrEstimateJson,
  getDrawingFile,
  isDrawingFileName,
  listProjectFolders,
  mergeEstimateFolderRows,
  upsertProjectFolder,
} from "@/domain/estimate/projectDocuments";
import { activateEstimate, deleteStoredEstimate, readEstimate, writeEstimate } from "@/domain/estimate/estimateStore";
import { readCompanyBranding } from "@/domain/estimate/branding";
import { estimatePdfBlob } from "@/domain/estimate/estimatePdf";

/** @type {Array<[string, string, string, React.ComponentType<any>]>} */
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

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return "";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount);
}

function resolveCompanyId(user) {
  return readLinkedBuildrCompanyId(user) || String(readBuildrFamilyAccess()?.companyId || "").trim();
}

/**
 * Load the full company estimate JSON (labor lines included) into local storage.
 * @param {any} folder
 */
async function hydrateCompanyEstimate(folder) {
  const existing = readEstimate(folder.fileName, folder.fileSize);
  if (existing?.lines?.length || existing?.header?.projectName) {
    activateEstimate(folder.fileName, folder.fileSize);
    return existing;
  }
  if (!folder.estimateFileUrl) {
    throw new Error("This Buildr estimate has no Estim8r JSON file to open.");
  }
  const response = await fetch(folder.estimateFileUrl, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Could not download the company estimate from Buildr.");
  }
  const json = await response.json();
  const draft = draftFromBuildrEstimateJson(json, folder);
  const saved = writeEstimate(draft);
  upsertProjectFolder({
    projectName: saved.header?.projectName || folder.projectName,
    projectAddress: saved.header?.projectAddress || folder.projectAddress,
    fileName: saved.fileName,
    fileSize: saved.fileSize || 0,
    savedTo: "buildr",
    buildrProjectId: folder.buildrProjectId || saved.buildrSync?.projectId || null,
  });
  return saved;
}

function FolderDocs({ folder, onHydrated, onError }) {
  const navigate = useNavigate();
  const hasDrawing = isDrawingFileName(folder.fileName);
  const [busy, setBusy] = useState("");

  async function downloadDrawing() {
    const file = await getDrawingFile(folder.fileName, folder.fileSize);
    if (!file) return;
    downloadBlob(file, folder.drawingName || folder.fileName);
  }

  async function ensureLocalEstimate() {
    if (folder.origin !== "buildr") {
      return readEstimate(folder.fileName, folder.fileSize);
    }
    setBusy("open");
    try {
      const saved = await hydrateCompanyEstimate(folder);
      onHydrated?.();
      return saved;
    } catch (error) {
      onError?.(error?.message || "Could not open the company estimate.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function downloadEstimate() {
    const estimate = folder.origin === "buildr"
      ? await ensureLocalEstimate()
      : readEstimate(folder.fileName, folder.fileSize);
    if (!estimate) return;
    const { blob, fileName } = estimatePdfBlob(estimate, readCompanyBranding());
    downloadBlob(blob, fileName);
  }

  async function openEstimate() {
    const estimate = folder.origin === "buildr"
      ? await ensureLocalEstimate()
      : readEstimate(folder.fileName, folder.fileSize);
    if (folder.origin === "buildr" && !estimate) return;
    const params = new URLSearchParams({
      file: (estimate?.fileName || folder.fileName) || "",
      size: String(estimate?.fileSize ?? folder.fileSize ?? 0),
    });
    activateEstimate(estimate?.fileName || folder.fileName, estimate?.fileSize ?? folder.fileSize);
    navigate(`/estimates/new?${params.toString()}`);
  }

  function openMarkup() {
    navigate(markupPath(folder));
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {hasDrawing ? (
        <button type="button" onClick={() => void downloadDrawing()} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
          <ImageIcon className="h-3.5 w-3.5" /> Drawing
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy === "open"}
        onClick={() => void downloadEstimate()}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
      >
        <FileText className="h-3.5 w-3.5" /> Estimate PDF
      </button>
      {hasDrawing ? (
        <button type="button" onClick={openMarkup} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">
          <StickyNote className="h-3.5 w-3.5" /> Markup pages
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy === "open"}
        onClick={() => void openEstimate()}
        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
      >
        {busy === "open" ? "Opening…" : "Open estimate"}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [folders, setFolders] = useState([]);
  const [companyStatus, setCompanyStatus] = useState("");
  const [folderError, setFolderError] = useState("");

  const refreshFolders = useCallback(async () => {
    const local = listProjectFolders();
    setFolders(local);
    setFolderError("");

    const email = String(user?.email || "").trim();
    const companyId = resolveCompanyId(user);
    if (!email || !companyId || !isBuildrConfigured() || !buildrApiUrl()) {
      setCompanyStatus("");
      return;
    }

    setCompanyStatus("Loading company estimates from Buildr…");
    try {
      let session = readBuildrSessionToken(email);
      const account = await fetchBuildrAccountStatus(email, companyId);
      if (account.token) session = account.token;
      else session = readBuildrSessionToken(email) || session;

      if (!account.canUseBuildr) {
        setFolders(local);
        setCompanyStatus(account.error
          ? `Company estimates unavailable: ${account.error}`
          : "Company estimates appear here when Buildr Access Control grants Estim8r for this company.");
        return;
      }
      if (!session) {
        setFolders(local);
        setCompanyStatus("Sign in from Buildr (or refresh your Buildr session) to list company estimates.");
        return;
      }

      const listed = await fetchBuildrEstimates({
        email,
        companyId: account.companyId || companyId,
        token: session,
      });
      if (!listed.ok) {
        setFolders(local);
        setCompanyStatus(listed.error
          ? `Company estimates unavailable: ${listed.error}`
          : "Could not load company estimates from Buildr.");
        return;
      }

      const merged = mergeEstimateFolderRows(local, listed.estimates);
      setFolders(merged);
      const remoteCount = merged.filter((row) => row.origin === "buildr").length;
      setCompanyStatus(remoteCount > 0
        ? `${remoteCount} company estimate${remoteCount === 1 ? "" : "s"} from Buildr Access Control (open to review applied labor).`
        : "No company estimates on Buildr yet. Local drafts still appear below.");
    } catch (error) {
      setFolders(local);
      setCompanyStatus(error?.message || "Could not load company estimates from Buildr.");
    }
  }, [user]);

  useEffect(() => {
    void refreshFolders();
    const onFocus = () => { void refreshFolders(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, [refreshFolders]);

  return (
    <div className="py-4 sm:py-6">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Current Flow Consulting</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-foreground">Estim8r Command Center</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Estimate electrical work with traceable labor sources, company production history and estimator-controlled adjustments.</p>
      </div>
      {canManageEstim8rAccess(user) && (
        <Link to="/admin" className="mb-8 flex items-start gap-3 rounded-2xl border border-blue-500/40 bg-blue-500/5 p-6 shadow-sm dark:border-orange-500/40 dark:bg-orange-500/5">
          <Shield className="mt-0.5 h-6 w-6 text-blue-600 dark:text-orange-500" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Platform owner access</h2>
            <p className="mt-1 text-sm text-muted-foreground">Open Access to grant, invite, or revoke who can use Estim8r.</p>
          </div>
        </Link>
      )}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {cards.map(([title, text, to, Icon]) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:border-blue-500/60 hover:shadow-md dark:hover:border-orange-500/60">
            <Link to={to} className="block">
              <Icon className="mb-4 h-7 w-7 text-blue-600 dark:text-orange-500" />
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </Link>
          </div>
        ))}
      </div>

      <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <FolderOpen className="mt-0.5 h-6 w-6 text-blue-600 dark:text-orange-500" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-foreground">Estimates folder</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Local drafts stay on this device. When Buildr Access Control grants Estim8r for your company, company estimates also appear here so you can open them in Estim8r and review applied labor — the same projects stay visible on the Buildr Estimate tab.
            </p>
            {companyStatus ? (
              <p className="mt-2 text-xs font-semibold text-blue-600 dark:text-orange-500">{companyStatus}</p>
            ) : null}
            {folderError ? (
              <p className="mt-2 text-xs font-semibold text-destructive">{folderError}</p>
            ) : null}
          </div>
        </div>
        {folders.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No saved estimates yet. Open New Estimate to write one, or upload drawings on Takeoff and save after the estimate is created.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {folders.map((folder) => {
              const totalLabel = formatMoney(folder.total);
              const isRemote = folder.origin === "buildr";
              return (
                <article key={folder.id} className="rounded-xl border border-border px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">{folder.projectName}</h3>
                        {isRemote ? (
                          <span className="rounded-md border border-blue-500/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:border-orange-500/40 dark:text-orange-500">
                            Buildr
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{folder.projectAddress || "No project address yet"}</p>
                      {totalLabel ? (
                        <p className="mt-1 text-sm font-semibold text-foreground">Estimate total {totalLabel}</p>
                      ) : null}
                      {folder.savedTo === "buildr" && !isRemote ? (
                        <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-orange-500">Also saved on the Buildr project Estimate tab</p>
                      ) : null}
                      {isRemote ? (
                        <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-orange-500">
                          Company estimate from Buildr — open to review labor hours and applied costs in Estim8r
                        </p>
                      ) : null}
                    </div>
                    {isRemote ? (
                      <span className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                        Managed in Buildr
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Delete ${folder.projectName || "this project"} from the Estimates folder?`)) return;
                          deleteStoredEstimate(folder.fileName, folder.fileSize);
                          deleteProjectFolder(folder);
                          void deleteDrawingFile(folder.fileName, folder.fileSize).catch(() => {});
                          void refreshFolders();
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                        aria-label={`Delete ${folder.projectName || "project"}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                  <FolderDocs
                    folder={folder}
                    onHydrated={() => { void refreshFolders(); }}
                    onError={(message) => setFolderError(message)}
                  />
                </article>
              );
            })}
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
