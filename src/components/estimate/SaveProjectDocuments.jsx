import React, { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/AuthContext";
import { fetchBuildrAccountStatus, isBuildrConfigured, saveBuildrProjectDocuments } from "@/api/buildrBridge";
import { readLinkedBuildrCompanyId } from "@/lib/buildrCompany";
import { readEstimate, writeEstimate } from "@/domain/estimate/estimateStore";
import {
  buildMarkupPages,
  buildrSyncFromResult,
  canSaveProjectDocuments,
  decideSaveDestination,
  estimateContentFingerprint,
  estimateFileNameForSave,
  getDrawingFile,
  isDrawingFileName,
  matchProjectByName,
  readTakeoffSession,
  saveRequiresProjectName,
  upsertProjectFolder,
} from "@/domain/estimate/projectDocuments";
import { titleBlockForMarkup } from "@/domain/estimate/fromDrawings";

function promptKey(projectName) {
  return `estim8r.projectDocs.prompted:${String(projectName || "").trim().toLowerCase()}`;
}

function storedEstimate(estimate, storageName, fileSize) {
  return readEstimate(storageName, fileSize)
    || readEstimate(estimate?.fileName, estimate?.fileSize)
    || estimate
    || {};
}

export default function SaveProjectDocuments({ estimate, onProjectName }) {
  const { user } = useAuth();
  const fileName = estimate?.fileName || "";
  const fileSize = estimate?.fileSize || 0;
  const projectName = estimate?.header?.projectName || "";
  const projectAddress = estimate?.header?.projectAddress || "";
  const hasDrawing = isDrawingFileName(fileName);
  const takeoff = hasDrawing ? readTakeoffSession(fileName, fileSize) : null;
  const fingerprint = estimateContentFingerprint(estimate, takeoff);
  const [promptOpen, setPromptOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [nameError, setNameError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const lastRun = useRef("");
  const promptedFor = useRef("");

  function persistDraft(name, extra = {}) {
    const storageName = extra.fileName || estimateFileNameForSave({ fileName, projectName: name });
    const current = storedEstimate(estimate, storageName, fileSize);
    return writeEstimate({
      ...current,
      ...estimate,
      ...extra,
      fileName: storageName,
      fileSize: fileSize || 0,
      id: extra.id || current.id || estimate?.id,
      header: {
        ...current.header,
        ...estimate?.header,
        projectName: name,
      },
    });
  }

  async function saveLocal(extra = {}, name = projectName) {
    const storageName = estimateFileNameForSave({ fileName, projectName: name });
    persistDraft(name, { fileName: storageName });
    upsertProjectFolder({
      projectName: name,
      projectAddress,
      fileName: storageName,
      fileSize: fileSize || 0,
      savedTo: extra.savedTo || "estim8r",
      buildrProjectId: extra.buildrProjectId || null,
      drawingName: extra.drawingName || (hasDrawing ? fileName : ""),
    });
    return storageName;
  }

  function persistSync(result, name = projectName) {
    const storageName = estimateFileNameForSave({ fileName, projectName: name });
    const current = storedEstimate(estimate, storageName, fileSize);
    const sync = buildrSyncFromResult(result, current.id || estimate?.id);
    persistDraft(name, { buildrSync: sync, id: current.id || estimate?.id });
    return sync;
  }

  async function saveToBuildr(createProject, name = projectName) {
    const storageName = estimateFileNameForSave({ fileName, projectName: name });
    const current = persistDraft(name, { fileName: storageName });
    const drawingFile = hasDrawing ? await getDrawingFile(fileName, fileSize) : null;
    const session = hasDrawing ? readTakeoffSession(fileName, fileSize) : null;
    const markedSheets = (session?.marks || []).map((mark) => Number(mark.sheet) || 1);
    const pageCount = Math.max(Number(session?.pageCount) || 1, Number(session?.sheet) || 1, ...markedSheets, 1);
    const markupPages = (hasDrawing || session?.marks?.length)
      ? buildMarkupPages({
        fileName,
        pageCount,
        marks: session?.marks || [],
        calibration: session?.calibration || null,
        titleBlock: titleBlockForMarkup(estimate?.header),
      })
      : null;
    const result = await saveBuildrProjectDocuments({
      email: user?.email,
      companyId: readLinkedBuildrCompanyId(user),
      projectName: name,
      projectAddress,
      createProject,
      estimate: current,
      drawingFile,
      markupPages,
      estim8rEstimateId: current.id,
      buildrProjectId: current.buildrSync?.projectId || estimate?.buildrSync?.projectId || null,
      buildrInvoiceId: current.buildrSync?.invoiceId || estimate?.buildrSync?.invoiceId || null,
    });
    const sync = persistSync(result, name);
    await saveLocal({
      savedTo: "buildr",
      buildrProjectId: sync.projectId,
      drawingName: drawingFile?.name || (hasDrawing ? fileName : ""),
    }, name);
    return result;
  }

  async function runSave({ forceLocal = false, force = false, nameOverride } = {}) {
    const name = String(nameOverride || projectName || "").trim();
    if (!estimate) return;
    if (!canSaveProjectDocuments({ projectName: name })) {
      setDraftName("");
      setNameError(saveRequiresProjectName({ projectName: name }));
      setNameOpen(true);
      setStatus(saveRequiresProjectName({ projectName: name }));
      return;
    }
    if (!force && !forceLocal && lastRun.current === fingerprint && !promptOpen) return;
    setBusy(true);
    try {
      if (forceLocal || !isBuildrConfigured()) {
        await saveLocal({ savedTo: "estim8r" }, name);
        lastRun.current = fingerprint;
        setStatus("Saved in the Estimates folder under this project name.");
        return;
      }
      const storageName = estimateFileNameForSave({ fileName, projectName: name });
      const current = storedEstimate(estimate, storageName, fileSize);
      const existingProjectId = current.buildrSync?.projectId || estimate?.buildrSync?.projectId || null;
      const account = await fetchBuildrAccountStatus(user?.email, readLinkedBuildrCompanyId(user));
      const matchingProject = matchProjectByName(account.projects, name);
      const decision = decideSaveDestination({
        hasBuildrAccount: account.hasAccount,
        canUseBuildr: account.canUseBuildr,
        matchingProject,
        existingProjectId,
      });
      if (decision.action === "buildr") {
        await saveToBuildr(false, name);
        lastRun.current = fingerprint;
        setStatus(existingProjectId
          ? `Updated the Buildr project Estimate tab.`
          : `Saved to the Buildr project “${decision.project.name || name}” Estimate tab.`);
        return;
      }
      if (decision.action === "prompt") {
        if (sessionStorage.getItem(promptKey(name)) === "declined") {
          await saveLocal({ savedTo: "estim8r" }, name);
          lastRun.current = fingerprint;
          setStatus("Saved in the Estimates folder under this project name.");
          return;
        }
        if (promptedFor.current !== name) {
          promptedFor.current = name;
          setPromptOpen(true);
        }
        return;
      }
      await saveLocal({ savedTo: "estim8r" }, name);
      lastRun.current = fingerprint;
      setStatus("Saved in the Estimates folder under this project name.");
    } catch (error) {
      await saveLocal({ savedTo: "estim8r" }, name);
      lastRun.current = fingerprint;
      setStatus(error?.message || "Could not reach Buildr. The estimate was saved in Estim8r.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!canSaveProjectDocuments({ projectName })) return undefined;
    const timer = window.setTimeout(() => { void runSave(); }, 800);
    return () => window.clearTimeout(timer);
  }, [fingerprint, user?.email, user?.buildr_company_id]);

  async function acceptCreate() {
    setPromptOpen(false);
    setBusy(true);
    try {
      const result = await saveToBuildr(true);
      lastRun.current = fingerprint;
      sessionStorage.removeItem(promptKey(projectName));
      setStatus(`Created “${result.project?.name || projectName}” in Buildr and saved the estimate on its Estimate tab.`);
    } catch (error) {
      await saveLocal({ savedTo: "estim8r" });
      setStatus(error?.message || "Buildr could not create the project. The estimate was saved in Estim8r.");
    } finally {
      setBusy(false);
    }
  }

  async function declineCreate() {
    sessionStorage.setItem(promptKey(projectName), "declined");
    setPromptOpen(false);
    await saveLocal({ savedTo: "estim8r" });
    lastRun.current = fingerprint;
    setStatus("Saved in the Estimates folder under this project name.");
  }

  function requestSave() {
    if (!canSaveProjectDocuments({ projectName })) {
      setDraftName(projectName);
      setNameError(saveRequiresProjectName({ projectName }));
      setNameOpen(true);
      setStatus(saveRequiresProjectName({ projectName }));
      return;
    }
    void runSave({ force: true });
  }

  function acceptName(event) {
    event?.preventDefault();
    const name = String(draftName || "").trim();
    const error = saveRequiresProjectName({ projectName: name });
    if (error) {
      setNameError(error);
      setStatus(error);
      return;
    }
    setNameError("");
    setNameOpen(false);
    onProjectName?.(name);
    void runSave({ force: true, nameOverride: name });
  }

  const nameMessage = saveRequiresProjectName({ projectName });

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <button
        type="button"
        onClick={requestSave}
        disabled={busy}
        className="w-fit rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60 dark:bg-orange-500"
      >
        {busy ? "Saving…" : "Save estimate"}
      </button>
      <p className="text-sm text-muted-foreground" role="status">
        {busy
          ? "Saving…"
          : status || (nameMessage || (hasDrawing
            ? "Saves the estimate, drawings, and markup pages under this project name."
            : "Saves this estimate without drawings or takeoff."))}
      </p>
      <AlertDialog open={nameOpen} onOpenChange={setNameOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Name this estimate</AlertDialogTitle>
            <AlertDialogDescription>
              A project name is required to save. Drawings and takeoff are optional.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={acceptName} className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-muted-foreground">Project name</span>
              <input
                value={draftName}
                onChange={(e) => { setDraftName(e.target.value); setNameError(""); }}
                autoFocus
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5"
                placeholder="Project name"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "estimate-save-name-error" : undefined}
              />
            </label>
            {nameError ? (
              <p id="estimate-save-name-error" className="text-sm text-destructive">{nameError}</p>
            ) : null}
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={acceptName}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Save estimate
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={promptOpen} onOpenChange={setPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create this project in Buildr?</AlertDialogTitle>
            <AlertDialogDescription>
              You can use Buildr, but there is no project named “{projectName}” yet.
              {hasDrawing
                ? " Create it now so Estim8r and Buildr can save the drawings, estimate, and markup pages on that project’s Estimate tab?"
                : " Create it now so Estim8r and Buildr can save this estimate on that project’s Estimate tab?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => void declineCreate()}>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => void acceptCreate()}>Create in Buildr</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
