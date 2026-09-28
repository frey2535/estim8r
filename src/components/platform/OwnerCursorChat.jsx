import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, MessageSquare, Minimize2, Send, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  CURSOR_API_KEY_STORAGE,
  CURSOR_CHAT_STORAGE,
  CURSOR_DASHBOARD_API_KEYS,
  buildOwnerPrompt,
  canUseOwnerCursorChat,
  cursorApiErrorMessage,
  describeCursorConnection,
  screenLabel,
} from "@/lib/ownerCursorChat";
import {
  cancelCursorRun,
  createCursorAgent,
  createCursorRun,
  listCursorAgents,
  probeCursorConnection,
  readStoredCursorApiKey,
  storeCursorApiKey,
  streamCursorRun,
} from "@/api/cursorAgents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [keyDraft, setKeyDraft] = useState("");
  const [apiKey, setApiKey] = useState(() => readStoredCursorApiKey());
  const [connection, setConnection] = useState({ state: "loading" });
  const [messages, setMessages] = useState(() => loadChat().messages || []);
  const [agentId, setAgentId] = useState(() => loadChat().agentId || "");
  const [agentName, setAgentName] = useState(() => loadChat().agentName || "");
  const [agents, setAgents] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [runId, setRunId] = useState("");
  const listRef = useRef(null);
  const abortRef = useRef(null);

  const screen = screenLabel(location.pathname);

  useEffect(() => {
    try { sessionStorage.setItem("estim8r.cursor.chatOpen", open ? "1" : "0"); } catch { /* ignore */ }
  }, [open]);

  useEffect(() => {
    saveChat({ agentId, agentName, messages });
  }, [agentId, agentName, messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const refreshConnection = useCallback(async (key = apiKey) => {
    setConnection({ state: "loading" });
    const next = await probeCursorConnection(key);
    setConnection(next);
    return next;
  }, [apiKey]);

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

  const loadAgents = useCallback(async (key = apiKey) => {
    try {
      const data = await listCursorAgents(key);
      setAgents(data.items || data.agents || []);
    } catch {
      setAgents([]);
    }
  }, [apiKey]);

  useEffect(() => {
    if (!allowed || !open) return;
    if (connection.state === "ready") void loadAgents();
  }, [allowed, open, connection.state, loadAgents]);

  const saveKey = async (event) => {
    event.preventDefault();
    const next = keyDraft.trim();
    storeCursorApiKey(next);
    setApiKey(next);
    setKeyDraft("");
    setError("");
    const status = await refreshConnection(next);
    if (status.state === "ready") void loadAgents(next);
  };

  const clearKey = () => {
    storeCursorApiKey("");
    setApiKey("");
    sessionStorage.removeItem(CURSOR_API_KEY_STORAGE);
    setConnection({ state: "needs_key", via: connection.via || null, hasEnvKey: false });
  };

  const startFresh = () => {
    abortRef.current?.abort();
    setAgentId("");
    setAgentName("");
    setMessages([]);
    setRunId("");
    setError("");
    saveChat({ agentId: "", agentName: "", messages: [] });
  };

  const send = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const prompt = buildOwnerPrompt(text, location.pathname);
    const userMessage = { id: newId(), role: "user", text, screen, createdAt: Date.now() };
    const pendingId = newId();
    setMessages((current) => [...current, userMessage, { id: pendingId, role: "assistant", text: "", status: "loading", createdAt: Date.now() }]);
    setDraft("");
    setBusy("send");
    setError("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let activeAgent = agentId;
      let run;
      if (!activeAgent) {
        const created = await createCursorAgent({
          text: prompt,
          pathname: location.pathname,
          apiKey,
          name: `Estim8r ${screen}`,
        });
        activeAgent = created.agent?.id || created.id;
        run = created.run;
        setAgentId(activeAgent);
        setAgentName(created.agent?.name || created.name || `Estim8r ${screen}`);
      } else {
        const created = await createCursorRun(activeAgent, { text: prompt, apiKey });
        run = created.run || created;
      }
      const activeRunId = run?.id;
      setRunId(activeRunId || "");
      if (activeRunId) {
        await streamCursorRun(activeAgent, activeRunId, {
          apiKey,
          signal: controller.signal,
          onEvent: (event) => {
            if (event.event === "assistant" && event.data?.text) {
              setMessages((current) => current.map((message) => (
                message.id === pendingId
                  ? { ...message, text: `${message.text || ""}${event.data.text}`, status: "streaming" }
                  : message
              )));
            }
            if (event.event === "result") {
              setMessages((current) => current.map((message) => (
                message.id === pendingId
                  ? {
                    ...message,
                    text: event.data?.text || message.text || "Cursor finished this turn without a text reply.",
                    status: event.data?.status === "ERROR" ? "error" : "done",
                    git: event.data?.git,
                  }
                  : message
              )));
            }
            if (event.event === "error") {
              throw new Error(event.data?.message || "Cursor stream error");
            }
          },
        });
      }
      setMessages((current) => current.map((message) => (
        message.id === pendingId && message.status === "loading"
          ? { ...message, text: message.text || "Cursor accepted the run. Open the agent if the stream stays quiet.", status: "done" }
          : message
      )));
    } catch (err) {
      if (err?.name === "AbortError") return;
      const message = cursorApiErrorMessage(err);
      setError(message);
      setMessages((current) => current.map((item) => (
        item.id === pendingId ? { ...item, text: message, status: "error" } : item
      )));
    } finally {
      setBusy("");
      setRunId("");
    }
  };

  const cancelRun = async () => {
    if (!agentId || !runId) return;
    try {
      await cancelCursorRun(agentId, runId, apiKey);
    } catch {
      abortRef.current?.abort();
    }
  };

  const connectionCopy = useMemo(() => describeCursorConnection(connection), [connection]);

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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-orange-500">Cursor cloud agent</p>
              <h2 className="truncate text-sm font-bold text-foreground">{agentName || "Owner chat"}</h2>
              <p className="truncate text-[11px] text-muted-foreground">Stays on {screen}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Minimize Cursor chat">
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setOpen(false); }} aria-label="Close Cursor chat">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <div className="border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            {connection.state === "loading" ? (
              <p className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking the Cursor Cloud Agents API…</p>
            ) : (
              <p>{connectionCopy}</p>
            )}
            {connection.state === "ready" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="h-7" onClick={startFresh}>New conversation</Button>
                {apiKey && <Button type="button" size="sm" variant="ghost" className="h-7" onClick={clearKey}>Remove tab key</Button>}
                {agents.length > 0 && (
                  <select
                    className="h-7 max-w-full rounded-md border border-input bg-transparent px-2 text-[11px]"
                    value={agentId}
                    onChange={(event) => {
                      setAgentId(event.target.value);
                      const selected = agents.find((agent) => agent.id === event.target.value);
                      setAgentName(selected?.name || "");
                    }}
                  >
                    <option value="">This tab</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name || agent.id}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {connection.state === "needs_key" && (
              <form onSubmit={saveKey} className="space-y-2 rounded-xl border border-border bg-card p-3">
                <p className="text-xs font-semibold text-foreground">Cursor API key</p>
                <p className="text-[11px] text-muted-foreground">
                  Get a user or service-account key from{" "}
                  <a className="font-medium text-blue-600 underline dark:text-orange-400" href={CURSOR_DASHBOARD_API_KEYS} target="_blank" rel="noreferrer">Cursor Dashboard → API Keys</a>.
                  It stays in this browser tab only.
                </p>
                <Input
                  type="password"
                  autoComplete="off"
                  value={keyDraft}
                  onChange={(event) => setKeyDraft(event.target.value)}
                  placeholder="key_…"
                  className="h-9"
                />
                <Button type="submit" size="sm" className="h-8" disabled={!keyDraft.trim()}>Use key on this tab</Button>
              </form>
            )}

            {connection.state === "error" && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {connection.message || connectionCopy}
              </div>
            )}

            {connection.state === "ready" && messages.length === 0 && (
              <div data-testid="owner-cursor-chat-empty" className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                No Cursor messages on this tab yet. Ask about the {screen.toLowerCase()} view you still have open. The page stays usable while this panel is here.
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
                  <p className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Starting a Cursor cloud agent on frey2535/estim8r…</p>
                ) : (
                  <p className="whitespace-pre-wrap">{message.text}</p>
                )}
                {message.git?.branches?.[0]?.branch && (
                  <p className="mt-1 text-[10px] opacity-80">Branch {message.git.branches[0].branch}</p>
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
              placeholder={connection.state === "ready" ? `Ask Cursor about ${screen}…` : "Connect Cursor before sending"}
              disabled={connection.state !== "ready" || Boolean(busy)}
              className="min-h-[64px] resize-none"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              {busy && runId ? (
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={cancelRun}>Cancel run</Button>
              ) : (
                <span className="text-[10px] text-muted-foreground">Owner / backup only</span>
              )}
              <Button type="submit" size="sm" className="h-8" disabled={connection.state !== "ready" || !draft.trim() || Boolean(busy)}>
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
