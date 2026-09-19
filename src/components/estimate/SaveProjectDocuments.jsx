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
import {
  buildMarkupPages,
  canSaveProjectDocuments,
  decideSaveDestination,
  getDrawingFile,
  matchProjectByName,
  readTakeoffSession,
  upsertProjectFolder,
} from "@/domain/estimate/projectDocuments";

function promptKey(projectName) {
  return `estim8r.projectDocs.prompted:${String(projectName || "").trim().toLowerCase()}`;
}

export default function SaveProjectDocuments({ estimate }) {
  const { user } = useAuth();
  const fileName = estimate?.fileName || "";
  const fileSize = estimate?.fileSize || 0;
  const projectName = estimate?.header?.projectName || "";
  const projectAddress = estimate?.header?.projectAddress || "";
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

  async function saveToBuildr(createProject) {
    const drawingFile = await getDrawingFile(fileName, fileSize);
    const takeoff = readTakeoffSession(fileName, fileSize);
    const markedSheets = (takeoff?.marks || []).map((mark) => Number(mark.sheet) || 1);
    const pageCount = Math.max(Number(takeoff?.pageCount) || 1, Number(takeoff?.sheet) || 1, ...markedSheets, 1);
    const markupPages = buildMarkupPages({
      fileName,
      pageCount,
      marks: takeoff?.marks || [],
      calibration: takeoff?.calibration || null,
    });
    const result = await saveBuildrProjectDocuments({
      email: user?.email,
      projectName,
      projectAddress,
      createProject,
      estimate,
      drawingFile,
      markupPages,
    });
    await saveLocal({
      savedTo: "buildr",
      buildrProjectId: result.project?.id || null,
      drawingName: drawingFile?.name || fileName,
    });
    return result;
  }

  async function runSave(forceLocal = false) {
    if (!canSaveProjectDocuments({ fileName, projectName }) || !estimate) return;
    const runId = `${fileName}:${fileSize}:${projectName}`;
    if (!forceLocal && lastRun.current === runId && !promptOpen) return;
    setBusy(true);
    setStatus("");
    try {
      if (forceLocal || !isBuildrConfigured()) {
        await saveLocal({ savedTo: "estim8r" });
        lastRun.current = runId;
        setStatus("Saved in the Estimates folder under this project name.");
        return;
      }
      const account = await fetchBuildrAccountStatus(user?.email);
      const matchingProject = matchProjectByName(account.projects, projectName);
      const decision = decideSaveDestination({
        hasBuildrAccount: account.hasAccount,
        canUseBuildr: account.canUseBuildr,
        matchingProject,
      });
      if (decision.action === "buildr") {
        await saveToBuildr(false);
        lastRun.current = runId;
        setStatus(`Saved to the Buildr project “${decision.project.name}” Estimate tab.`);
        return;
      }
      if (decision.action === "prompt") {
        if (sessionStorage.getItem(promptKey(projectName)) === "declined") {
          await saveLocal({ savedTo: "estim8r" });
          lastRun.current = runId;
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
      lastRun.current = runId;
      setStatus("Saved in the Estimates folder under this project name.");
    } catch (error) {
      await saveLocal({ savedTo: "estim8r" });
      lastRun.current = runId;
      setStatus(error?.message || "Could not reach Buildr. Documents were saved in Estim8r.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!canSaveProjectDocuments({ fileName, projectName })) return undefined;
    const timer = window.setTimeout(() => { void runSave(false); }, 400);
    return () => window.clearTimeout(timer);
  }, [fileName, fileSize, projectName, projectAddress, user?.email]);

  async function acceptCreate() {
    setPromptOpen(false);
    setBusy(true);
    try {
      const result = await saveToBuildr(true);
      lastRun.current = `${fileName}:${fileSize}:${projectName}`;
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
    lastRun.current = `${fileName}:${fileSize}:${projectName}`;
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
