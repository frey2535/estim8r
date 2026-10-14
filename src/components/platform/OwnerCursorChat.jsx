import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Activity, Bot, Camera, Loader2, Minimize2, Play, RefreshCw, Send, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/api/supabaseClient";
import { CURSOR_CHAT_STORAGE, canUseOwnerCursorChat, screenLabel } from "@/lib/ownerCursorChat";
import { collectOwnerChatEvidence, installOwnerChatEvidence } from "@/lib/ownerChatEvidence";
import { inspectOwnerEvidence } from "@/lib/ownerChatInspector";
import { dispatchOwnerAiTakeoff } from "@/api/cursorSession";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Local inspection never claims to modify source code or contact an AI backend.
// Engineering changes require a separately authenticated server-side agent.
function readHistory() {
  try {
    const value = JSON.parse(sessionStorage.getItem(CURSOR_CHAT_STORAGE) || "{}");
    return Array.isArray(value.messages) ? value.messages : [];
  } catch { return []; }
}
function message(role, text) {
  return { id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text, createdAt: Date.now() };
}
function inspectionText(evidence, inspection) {
  const lines = [
    `Live inspection: ${inspection.screen} (${evidence.pathname})`,
    evidence.visible?.heading ? `Heading: ${evidence.visible.heading}` : "",
    evidence.takeoff?.present ? `Drawing: ${evidence.takeoff.name || "unnamed"}, sheet ${evidence.takeoff.page || 1}` : "",
    evidence.estimate?.present ? `Estimate: ${evidence.estimate.projectName || "active"}, ${evidence.estimate.lineCount} lines` : "",
    `Recent errors/validation issues: ${inspection.findings.length}`,
    `Open dialogs: ${evidence.workspace?.dialogs || 0}`,
    evidence.workspace?.controls?.length ? `Visible controls: ${evidence.workspace.controls.map((item) => item.label).join(", ").slice(0, 450)}` : "",
    ...inspection.findings.slice(0, 5).map((item) => `• ${item.what} [${item.file}]`),
  ].filter(Boolean);
  if (!inspection.findings.length) lines.push("No captured errors or invalid fields on this tab. This does not verify that the feature works.");
  return lines.join("\n");
}
export default function OwnerCursorChat() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const allowed = isAuthenticated && canUseOwnerCursorChat(user);
  const [open, setOpen] = useState(() => {
    try { return sessionStorage.getItem("estim8r.cursor.chatOpen") === "1"; } catch { return false; }
  });
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState(readHistory);
  const [inspecting, setInspecting] = useState(false);
  const [replying, setReplying] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [capture, setCapture] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const listRef = useRef(null);
  const screen = screenLabel(location.pathname);

  useEffect(() => { if (allowed) installOwnerChatEvidence(); }, [allowed]);
  useEffect(() => {
    try { sessionStorage.setItem("estim8r.cursor.chatOpen", open ? "1" : "0"); } catch { /* disabled */ }
  }, [open]);
  useEffect(() => {
    try { sessionStorage.setItem(CURSOR_CHAT_STORAGE, JSON.stringify({ messages: messages.slice(-60) })); } catch { /* disabled */ }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("estim8r-open-owner-cursor-chat", onOpen);
    return () => window.removeEventListener("estim8r-open-owner-cursor-chat", onOpen);
  }, []);

  function inspect() {
    setInspecting(true);
    try {
      const evidence = collectOwnerChatEvidence(location.pathname);
      const result = inspectOwnerEvidence(evidence, "inspect this screen");
      setSnapshot({ evidence, result });
      setMessages((current) => [...current, message("assistant", inspectionText(evidence, result))]);
    } finally { setInspecting(false); }
  }
  async function captureWorkspace() {
    setCapturing(true);
    try {
      const root = document.querySelector("main");
      if (!root) throw new Error("No main workspace is available for visual capture.");
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(root, {
        backgroundColor: null,
        logging: false,
        useCORS: false,
        scale: Math.min(1, 1200 / Math.max(root.clientWidth, 1)),
        onclone: (clonedDocument) => {
          clonedDocument.querySelectorAll("input, textarea, select, [contenteditable], [data-private], [data-sensitive]").forEach((el) => {
            el.style.setProperty("visibility", "hidden", "important");
          });
        },
      });
      setCapture(canvas.toDataURL("image/png"));
      setMessages((current) => [...current, message("assistant", "Local workspace preview captured. Review it below. The image has not been uploaded or sent to an AI service. Inputs and editable fields are hidden; other customer information may still be visible.")]);
    } catch (error) {
      setMessages((current) => [...current, message("assistant", `Workspace capture failed: ${error?.message || "unknown error"}. No image was sent.`)]);
    } finally { setCapturing(false); }
  }
  function runTakeoff() {
    if (!location.pathname.startsWith("/takeoff")) {
      setMessages((current) => [...current, message("assistant", "Open the Takeoff workspace before running AI Assist.")]);
      return;
    }
    dispatchOwnerAiTakeoff();
    setMessages((current) => [...current, message("assistant", "Requested AI Assist on the active Takeoff workspace. Check its on-screen result; detection success is not yet verified.")]);
  }
  async function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || replying) return;
    setDraft("");
    const history = messages.slice(-8).map(({ role, text: content }) => ({ role, text: content }));
    setMessages((current) => [...current, message("user", text)]);
    setReplying(true);
    try {
      if (!supabase) throw new Error("Sign-in service is not configured.");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) throw new Error("Sign in again to use AI chat.");
      const { data, error } = await supabase.functions.invoke("owner-agent-chat", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: { message: text, history, context: collectOwnerChatEvidence(location.pathname) },
      });
      if (error) {
        let detail = "";
        try {
          const response = error.context;
          const payload = response && typeof response.json === "function" ? await response.json() : null;
          detail = typeof payload?.error === "string" ? payload.error.slice(0, 240) : "";
        } catch { /* Gateway errors may not return JSON. */ }
        const status = error.context?.status;
        const hint = status === 401 ? "Supabase authentication was rejected."
          : status === 403 ? "Supabase identity is not authorized."
          : status === 404 ? "Function is missing from the configured Supabase project."
          : status === 503 ? "A required function setting is missing."
          : status === 502 ? "AI provider request failed; inspect function logs."
          : "Inspect the Edge Function logs and browser network request.";
        throw new Error("AI request failed" + (status ? " (HTTP " + status + ")" : "") + ": " + (detail || hint));
      }
      if (!data?.answer) throw new Error(data?.error || "The AI service did not return an answer.");
      setMessages((current) => [...current, message("assistant", data.answer)]);
    } catch (error) {
      setMessages((current) => [...current, message("assistant", `I couldn't connect to the AI service: ${error.message} No fix has been made.`)]);
    } finally { setReplying(false); }
  }

  if (!allowed) return null;
  return (
    <>
      {!open && <button type="button" data-testid="owner-cursor-chat-open" onClick={() => setOpen(true)}
        className="fixed z-40 right-3 bottom-20 lg:bottom-6 flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-lg dark:bg-orange-500">
        <Bot className="h-4 w-4" /> Owner workspace assistant
      </button>}
      {open && <aside data-testid="owner-cursor-chat"
        className={cn("fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl",
          "right-3 left-3 bottom-20 h-[48vh] lg:left-auto lg:top-16 lg:bottom-6 lg:h-auto lg:w-[25rem]")}>
        <header className="flex items-center justify-between border-b border-border px-3 py-2">
          <div><p className="text-sm font-semibold">Owner workspace assistant</p>
            <p className="text-xs text-muted-foreground">Viewing context: {screen}</p></div>
          <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Minimize assistant"><Minimize2 className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close assistant"><X className="h-4 w-4" /></Button>
        </header>
        <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground" data-testid="owner-cursor-chat-status">
          <Activity className="mr-1 inline h-3.5 w-3.5" /> AI chat requires the authenticated owner-agent-chat service.
          {snapshot && <span className="block">Last inspected: {new Date(snapshot.evidence.capturedAt).toLocaleTimeString()} · {snapshot.result.findings.length} findings</span>}
        </div>
        <div className="flex gap-2 border-b border-border px-3 py-2">
          <Button type="button" size="sm" variant="outline" onClick={inspect} disabled={inspecting}>
            {inspecting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />} Inspect screen
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={captureWorkspace} disabled={capturing}>
            {capturing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Camera className="mr-1 h-3.5 w-3.5" />} Preview screen
          </Button>
          {location.pathname.startsWith("/takeoff") && <Button type="button" size="sm" variant="outline" onClick={runTakeoff}><Play className="mr-1 h-3.5 w-3.5" /> Run AI Assist</Button>}
        </div>
        {capture && <div className="border-b border-border p-2"><div className="mb-1 flex justify-between text-xs"><span>Local preview — not shared</span><Button size="sm" variant="ghost" type="button" onClick={() => setCapture(null)}>Discard</Button></div><img src={capture} alt="Preview of current Estim8r workspace" className="max-h-44 w-full object-contain" /></div>}
        <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
          {!messages.length && <p className="text-xs text-muted-foreground">Inspect this tab's errors, active drawing and estimate. No screenshot or external transmission occurs.</p>}
          {messages.map((item) => <div key={item.id} className={cn("whitespace-pre-wrap rounded-xl px-3 py-2 text-xs",
            item.role === "user" ? "ml-6 bg-blue-600 text-white" : "mr-6 bg-muted text-foreground")}>{item.text}</div>)}
        </div>
        <form onSubmit={send} className="border-t border-border p-2">
          <Textarea data-testid="owner-cursor-chat-input" value={draft} onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask a question about Estim8r…" className="min-h-[64px] resize-none" />
          <div className="mt-2 flex justify-end"><Button type="submit" size="sm" disabled={!draft.trim() || replying}><Send className="mr-1 h-3.5 w-3.5" /> {replying ? "Thinking…" : "Send"}</Button></div>
        </form>
      </aside>}
    </>
  );
}
