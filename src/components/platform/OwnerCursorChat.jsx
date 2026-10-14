import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Activity, Bot, Loader2, MessageSquare, Minimize2, Play, RefreshCw, Send, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
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
  const [snapshot, setSnapshot] = useState(null);
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
  function runTakeoff() {
    if (!location.pathname.startsWith("/takeoff")) {
      setMessages((current) => [...current, message("assistant", "Open the Takeoff workspace before running AI Assist.")]);
      return;
    }
    dispatchOwnerAiTakeoff();
    setMessages((current) => [...current, message("assistant", "Requested AI Assist on the active Takeoff workspace. Check its on-screen result; detection success is not yet verified.")]);
  }
  function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const evidence = collectOwnerChatEvidence(location.pathname);
    const result = inspectOwnerEvidence(evidence, text);
    setSnapshot({ evidence, result });
    const lower = text.toLowerCase();
    const reply = /run (?:ai|takeoff)|start (?:ai|takeoff)/.test(lower)
      ? "Use the Run AI Assist button below to explicitly start the takeoff. It does not modify application source code."
      : `${inspectionText(evidence, result)}\n\nThis local assistant can inspect the current tab and request AI Assist. Automated GitHub repairs and full-screen visual analysis require a connected, authenticated engineering agent service; they are not active in this version.`;
    setMessages((current) => [...current, message("user", text), message("assistant", reply)]);
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
          <Activity className="mr-1 inline h-3.5 w-3.5" /> Local live diagnostics available. Remote code-editing agent not connected.
          {snapshot && <span className="block">Last inspected: {new Date(snapshot.evidence.capturedAt).toLocaleTimeString()} · {snapshot.result.findings.length} findings</span>}
        </div>
        <div className="flex gap-2 border-b border-border px-3 py-2">
          <Button type="button" size="sm" variant="outline" onClick={inspect} disabled={inspecting}>
            {inspecting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />} Inspect screen
          </Button>
          {location.pathname.startsWith("/takeoff") && <Button type="button" size="sm" variant="outline" onClick={runTakeoff}><Play className="mr-1 h-3.5 w-3.5" /> Run AI Assist</Button>}
        </div>
        <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
          {!messages.length && <p className="text-xs text-muted-foreground">Inspect this tab's errors, active drawing and estimate. No screenshot or external transmission occurs.</p>}
          {messages.map((item) => <div key={item.id} className={cn("whitespace-pre-wrap rounded-xl px-3 py-2 text-xs",
            item.role === "user" ? "ml-6 bg-blue-600 text-white" : "mr-6 bg-muted text-foreground")}>{item.text}</div>)}
        </div>
        <form onSubmit={send} className="border-t border-border p-2">
          <Textarea data-testid="owner-cursor-chat-input" value={draft} onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about the current screen or its errors…" className="min-h-[64px] resize-none" />
          <div className="mt-2 flex justify-end"><Button type="submit" size="sm" disabled={!draft.trim()}><Send className="mr-1 h-3.5 w-3.5" /> Inspect request</Button></div>
        </form>
      </aside>}
    </>
  );
}
