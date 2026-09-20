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
import { readEstimate, writeEstimate } from "@/domain/estimate/estimateStore";
import {
  buildMarkupPages,
  buildrSyncFromResult,
  canSaveProjectDocuments,
  decideSaveDestination,
  estimateContentFingerprint,
  getDrawingFile,
  matchProjectByName,
  readTakeoffSession,
  upsertProjectFolder,
} from "@/domain/estimate/projectDocuments";
import { titleBlockForMarkup } from "@/domain/estimate/fromDrawings";

function promptKey(projectName) {
  return `estim8r.projectDocs.prompted:${String(projectName || "").trim().toLowerCase()}`;
}

function storedEstimate(estimate) {
  return readEstimate(estimate?.fileName, estimate?.fileSize) || estimate || {};
}

export default function SaveProjectDocuments({ estimate }) {
  const { user } = useAuth();
  const fileName = estimate?.fileName || "";
  const fileSize = estimate?.fileSize || 0;
  const projectName = estimate?.header?.projectName || "";
  const projectAddress = estimate?.header?.projectAddress || "";
  const takeoff = readTakeoffSession(fileName, fileSize);
  const fingerprint = estimateContentFingerprint(estimate, takeoff);
  const [promptOpen, setPromptOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const lastRun = useRef("");
  const promptedFor = useRef("");

  async function saveLocal(extra = {}) {
    upsertProjectFolder({
      projectName,
      projectAddress,
      fileName,
      fileSize,
      savedTo: extra.savedTo || "estim8r",
      buildrProjectId: extra.buildrProjectId || null,
      drawingName: extra.drawingName || fileName,
    });
  }

  function persistSync(result) {
    const current = storedEstimate(estimate);
    const sync = buildrSyncFromResult(result, current.id || estimate?.id);
    writeEstimate({
      ...current,
      ...estimate,
      id: current.id || estimate?.id,
      buildrSync: sync,
    });
    return sync;
  }

  async function saveToBuildr(createProject) {
    const current = storedEstimate(estimate);
    const drawingFile = await getDrawingFile(fileName, fileSize);
    const session = readTakeoffSession(fileName, fileSize);
    const markedSheets = (session?.marks || []).map((mark) => Number(mark.sheet) || 1);
    const pageCount = Math.max(Number(session?.pageCount) || 1, Number(session?.sheet) || 1, ...markedSheets, 1);
    const markupPages = buildMarkupPages({
      fileName,
      pageCount,
      marks: session?.marks || [],
      calibration: session?.calibration || null,
      titleBlock: titleBlockForMarkup(estimate?.header),
    });
    const payload = { ...current, ...estimate, id: current.id || estimate?.id };
    const result = await saveBuildrProjectDocuments({
      email: user?.email,
      projectName,
      projectAddress,
      createProject,
      estimate: payload,
      drawingFile,
      markupPages,
      estim8rEstimateId: payload.id,
      buildrProjectId: current.buildrSync?.projectId || estimate?.buildrSync?.projectId || null,
      buildrInvoiceId: current.buildrSync?.invoiceId || estimate?.buildrSync?.invoiceId || null,
    });
    const sync = persistSync(result);
    await saveLocal({
      savedTo: "buildr",
      buildrProjectId: sync.projectId,
      drawingName: drawingFile?.name || fileName,
    });
    return result;
  }

  async function runSave(forceLocal = false) {
    if (!canSaveProjectDocuments({ fileName, projectName }) || !estimate) return;
    if (!forceLocal && lastRun.current === fingerprint && !promptOpen) return;
    setBusy(true);
    try {
      if (forceLocal || !isBuildrConfigured()) {
        await saveLocal({ savedTo: "estim8r" });
        lastRun.current = fingerprint;
        setStatus("Saved in the Estimates folder under this project name.");
        return;
      }
      const current = storedEstimate(estimate);
      const existingProjectId = current.buildrSync?.projectId || estimate?.buildrSync?.projectId || null;
      const account = await fetchBuildrAccountStatus(user?.email);
      const matchingProject = matchProjectByName(account.projects, projectName);
      const decision = decideSaveDestination({
        hasBuildrAccount: account.hasAccount,
        canUseBuildr: account.canUseBuildr,
        matchingProject,
        existingProjectId,
      });
      if (decision.action === "buildr") {
        await saveToBuildr(false);
        lastRun.current = fingerprint;
        setStatus(existingProjectId
          ? `Updated the Buildr project Estimate tab.`
          : `Saved to the Buildr project “${decision.project.name || projectName}” Estimate tab.`);
        return;
      }
      if (decision.action === "prompt") {
        if (sessionStorage.getItem(promptKey(projectName)) === "declined") {
          await saveLocal({ savedTo: "estim8r" });
          lastRun.current = fingerprint;
          setStatus("Saved in the Estimates folder under this project name.");
          return;
        }
        if (promptedFor.current !== projectName) {
          promptedFor.current = projectName;
          setPromptOpen(true);
        }
        return;
      }
      await saveLocal({ savedTo: "estim8r" });
      lastRun.current = fingerprint;
      setStatus("Saved in the Estimates folder under this project name.");
    } catch (error) {
      await saveLocal({ savedTo: "estim8r" });
      lastRun.current = fingerprint;
      setStatus(error?.message || "Could not reach Buildr. Documents were saved in Estim8r.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!canSaveProjectDocuments({ fileName, projectName })) return undefined;
    const timer = window.setTimeout(() => { void runSave(false); }, 800);
    return () => window.clearTimeout(timer);
  }, [fingerprint, user?.email]);

  async function acceptCreate() {
    setPromptOpen(false);
    setBusy(true);
    try {
      const result = await saveToBuildr(true);
      lastRun.current = fingerprint;
      sessionStorage.removeItem(promptKey(projectName));
      setStatus(`Created “${result.project?.name || projectName}” in Buildr and saved the documents on its Estimate tab.`);
    } catch (error) {
      await saveLocal({ savedTo: "estim8r" });
      setStatus(error?.message || "Buildr could not create the project. Documents were saved in Estim8r.");
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

  if (!canSaveProjectDocuments({ fileName, projectName })) return null;

  return (
    <>
      {status && (
        <p className="text-sm text-muted-foreground" role="status">{busy ? "Saving project documents…" : status}</p>
      )}
      <AlertDialog open={promptOpen} onOpenChange={setPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create this project in Buildr?</AlertDialogTitle>
            <AlertDialogDescription>
              You can use Buildr, but there is no project named “{projectName}” yet.
              Create it now so Estim8r and Buildr can save the drawings, estimate, and markup pages
              on that project’s Estimate tab?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => void declineCreate()}>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => void acceptCreate()}>Create in Buildr</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
