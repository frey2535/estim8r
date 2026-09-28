import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, MessageSquare, Minimize2, Send, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  CURSOR_CHAT_STORAGE,
  canUseOwnerCursorChat,
  describeCursorSession,
  screenLabel,
} from "@/lib/ownerCursorChat";
import { collectOwnerChatEvidence, installOwnerChatEvidence } from "@/lib/ownerChatEvidence";
import { formatInspectionReply, inspectOwnerEvidence } from "@/lib/ownerChatInspector";
import { postCursorSessionTurn, probeCursorSession } from "@/api/cursorSession";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function loadChat() {
  try {
    return JSON.parse(sessionStorage.getItem(CURSOR_CHAT_STORAGE) || "null") || {};
  } catch {
    return {};
  }
}

function saveChat(next) {
  sessionStorage.setItem(CURSOR_CHAT_STORAGE, JSON.stringify(next));
}

function newId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function OwnerCursorChat() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const allowed = isAuthenticated && canUseOwnerCursorChat(user);
  const [open, setOpen] = useState(() => {
    try { return sessionStorage.getItem("estim8r.cursor.chatOpen") === "1"; } catch { return false; }
  });
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState({ state: "loading" });
  const [messages, setMessages] = useState(() => loadChat().messages || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const screen = screenLabel(location.pathname);

  useEffect(() => {
    if (allowed) installOwnerChatEvidence();
  }, [allowed]);

  useEffect(() => {
    try { sessionStorage.setItem("estim8r.cursor.chatOpen", open ? "1" : "0"); } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    saveChat({ messages });
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const refreshConnection = useCallback(async () => {
    setConnection({ state: "loading" });
    setConnection(await probeCursorSession());
  }, []);

  useEffect(() => {
    if (!allowed) return undefined;
    void refreshConnection();
    return undefined;
  }, [allowed, refreshConnection]);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("estim8r-open-owner-cursor-chat", openChat);
    return () => window.removeEventListener("estim8r-open-owner-cursor-chat", openChat);
  }, []);

  const send = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const evidence = collectOwnerChatEvidence(location.pathname);
    const inspection = inspectOwnerEvidence(evidence, text);
    const userMessage = { id: newId(), role: "user", text, screen, createdAt: Date.now() };
    const pendingId = newId();
    setMessages((current) => [
      ...current,
      userMessage,
      { id: pendingId, role: "assistant", text: "", status: "loading", createdAt: Date.now() },
    ]);
    setDraft("");
    setBusy(true);
    setError("");

    let queued = false;
    try {
      const posted = await postCursorSessionTurn({
        text,
        pathname: location.pathname,
        evidence,
        inspection,
        wantFix: inspection.wantsFix,
      });
      queued = Boolean(posted.queued);
      if (posted.session?.attached && connection.state !== "ready") {
        setConnection({ state: "ready", session: posted.session });
      }
    } catch (err) {
      if (inspection.wantsFix && connection.state !== "ready") {
        setError(err?.message || "Could not queue a correction on a Cursor session.");
      }
    }

    const reply = formatInspectionReply(inspection, {
      sessionAttached: connection.state === "ready" || queued,
      queued,
    });
    setMessages((current) => current.map((message) => (
      message.id === pendingId ? { ...message, text: reply, status: "done", findings: inspection.findings } : message
    )));
    setBusy(false);
  };

  const connectionCopy = useMemo(() => describeCursorSession(connection), [connection]);

  if (!allowed) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          data-testid="owner-cursor-chat-open"
          onClick={() => setOpen(true)}
          className="fixed z-40 flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 dark:bg-orange-500 dark:shadow-none dark:hover:bg-orange-400 right-3 bottom-20 lg:bottom-6"
        >
          <MessageSquare className="h-4 w-4" />
          Cursor
        </button>
      )}

      {open && (
        <aside
          data-testid="owner-cursor-chat"
          className={cn(
            "fixed z-40 flex flex-col overflow-hidden border border-border bg-background/95 shadow-2xl backdrop-blur-xl",
            "right-3 left-3 bottom-20 h-[42vh] rounded-2xl",
            "lg:left-auto lg:top-16 lg:bottom-6 lg:h-auto lg:w-[22.5rem] lg:max-w-[calc(100vw-2rem)]",
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Cursor session</p>
              <h2 className="truncate text-sm font-bold text-foreground">Owner chat</h2>
              <p className="truncate text-[11px] text-muted-foreground">Stays on {screen}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Minimize Cursor chat">
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Close Cursor chat">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            {connection.state === "loading" ? (
              <p className="flex items-center gap-2" data-testid="owner-cursor-chat-loading">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />Looking for this Cursor Project session…
              </p>
            ) : (
              <p data-testid="owner-cursor-chat-status">{connectionCopy}</p>
            )}
          </div>

          <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {connection.state === "error" && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {connection.message || connectionCopy}
              </div>
            )}

            {messages.length === 0 && (
              <div data-testid="owner-cursor-chat-empty" className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                Ask about the {screen.toLowerCase()} view you still have open. I use this tab’s route, UI, estimate/takeoff/markup state, console errors, and failed requests. I do not invent bugs or require an API key.
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs",
                  message.role === "user"
                    ? "ml-6 bg-blue-600 text-white dark:bg-orange-500"
                    : "mr-6 bg-muted text-foreground",
                  message.status === "error" && "border border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {message.status === "loading" && !message.text ? (
                  <p className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading this screen’s evidence…</p>
                ) : (
                  <p className="whitespace-pre-wrap">{message.text}</p>
                )}
              </div>
            ))}
          </div>

          {error && (
            <p className="border-t border-destructive/30 px-3 py-1.5 text-[11px] text-destructive">{error}</p>
          )}

          <form onSubmit={send} className="border-t border-border/70 p-2">
            <Textarea
              data-testid="owner-cursor-chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`Ask Cursor about ${screen}…`}
              disabled={Boolean(busy)}
              className="min-h-[64px] resize-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">Owner / backup only</span>
              <Button type="submit" size="sm" className="h-8" disabled={!draft.trim() || Boolean(busy)}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send
              </Button>
            </div>
          </form>
        </aside>
      )}
    </>
  );
}
