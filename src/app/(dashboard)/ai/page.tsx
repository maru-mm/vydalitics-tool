"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Settings,
  Bot,
  User,
  Loader2,
  Sparkles,
  Trash2,
  MessageSquarePlus,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

const SUGGESTIONS = [
  "What are my top 3 videos by conversions?",
  "Compare my main videos by performance",
  "Analyze the trend over the last 30 days",
  "Which audience segments perform best?",
  "Generate a weekly performance report",
  "Suggest A/B tests based on current data",
];

const STORAGE_KEY = "vydalitics-ai-conversations";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

export default function AIChatPage() {
  const apiToken = useAppStore((s) => s.apiToken);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [backendStatus, setBackendStatus] = useState<"unknown" | "ok" | "error">("unknown");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setConversations(loadConversations());
  }, []);

  useEffect(() => {
    fetch("/api/ai/chat", { method: "OPTIONS" }).catch(() => {});
    fetch("http://localhost:8100/health")
      .then((r) => r.json())
      .then((d) => setBackendStatus(d.anthropic_configured ? "ok" : "error"))
      .catch(() => setBackendStatus("error"));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvId, streamingText, conversations]);

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const messages = activeConv?.messages || [];

  const updateConversation = useCallback(
    (convId: string, updater: (c: Conversation) => Conversation) => {
      setConversations((prev) => {
        const updated = prev.map((c) => (c.id === convId ? updater(c) : c));
        saveConversations(updated);
        return updated;
      });
    },
    []
  );

  const startNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "New Conversation",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setConversations((prev) => {
      const updated = [newConv, ...prev];
      saveConversations(updated);
      return updated;
    });
    setActiveConvId(newConv.id);
    setInput("");
    inputRef.current?.focus();
  };

  const deleteConversation = (convId: string) => {
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== convId);
      saveConversations(updated);
      return updated;
    });
    if (activeConvId === convId) setActiveConvId(null);
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || streaming) return;

    let convId = activeConvId;
    if (!convId) {
      const newConv: Conversation = {
        id: Date.now().toString(),
        title: msg.slice(0, 40) + (msg.length > 40 ? "..." : ""),
        messages: [],
        createdAt: new Date().toISOString(),
      };
      setConversations((prev) => {
        const updated = [newConv, ...prev];
        saveConversations(updated);
        return updated;
      });
      convId = newConv.id;
      setActiveConvId(convId);
    }

    const userMsg: Message = { role: "user", content: msg };
    updateConversation(convId, (c) => ({
      ...c,
      messages: [...c.messages, userMsg],
      title: c.messages.length === 0 ? msg.slice(0, 40) + (msg.length > 40 ? "..." : "") : c.title,
    }));

    setInput("");
    setStreaming(true);
    setStreamingText("");

    try {
      const currentConv = conversations.find((c) => c.id === convId);
      const history = currentConv?.messages || [];

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          conversation_history: history,
          vidalytics_token: apiToken,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const raw = line.slice(6).trim();
              if (!raw) continue;
              try {
                const parsed = JSON.parse(raw);
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
                if (parsed.text) {
                  fullText += parsed.text;
                  setStreamingText(fullText);
                }
                if (parsed.finished) break;
              } catch (e) {
                if (e instanceof Error && e.message !== "Unexpected end of JSON input") throw e;
              }
            }
          }
        }
      }

      const finalConvId = convId;
      const assistantMsg: Message = { role: "assistant", content: fullText || "No response received." };
      updateConversation(finalConvId, (c) => ({
        ...c,
        messages: [...c.messages, assistantMsg],
      }));
    } catch (err) {
      const errorMsg: Message = {
        role: "assistant",
        content: `**Error:** ${err instanceof Error ? err.message : "Connection error to AI backend. Make sure the Python backend is running on localhost:8100."}`,
      };
      updateConversation(convId!, (c) => ({
        ...c,
        messages: [...c.messages, errorMsg],
      }));
    } finally {
      setStreaming(false);
      setStreamingText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] gap-4 -m-6">
      {/* Sidebar conversazioni */}
      <div className="flex w-72 shrink-0 flex-col border-r border-border bg-white p-4">
        <Button onClick={startNewConversation} className="mb-4 w-full">
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
        </Button>

        <div className="flex-1 space-y-1 overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                activeConvId === conv.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
              onClick={() => setActiveConvId(conv.id)}
            >
              <span className="flex-1 truncate">{conv.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="hidden text-muted-foreground hover:text-danger group-hover:block"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No conversations. Start a new chat!
            </p>
          )}
        </div>

        {/* Backend status */}
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                backendStatus === "ok"
                  ? "bg-success"
                  : backendStatus === "error"
                    ? "bg-danger"
                    : "bg-muted-foreground"
              }`}
            />
            <span className="text-muted-foreground">
              Backend AI: {backendStatus === "ok" ? "Connected" : backendStatus === "error" ? "Not connected" : "Checking..."}
            </span>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {!activeConvId || messages.length === 0 ? (
          /* Welcome / Suggestions */
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h2 className="mt-6 text-2xl font-bold">Vydalitics AI Analyst</h2>
            <p className="mt-2 max-w-md text-center text-muted-foreground">
              Your AI analyst for video marketing. Ask anything about your Vidalytics data,
              compare videos, analyze trends, and get copywriting suggestions.
            </p>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="flex items-center gap-3 rounded-xl border border-border p-4 text-left text-sm transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>

            <Link href="/ai/knowledge" className="mt-6">
              <Badge variant="info">Upload copywriting documents to the Knowledge Base</Badge>
            </Link>
          </div>
        ) : (
          /* Messages */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className="flex gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      msg.role === "user"
                        ? "bg-primary/10 text-primary"
                        : "bg-gradient-to-br from-primary to-accent text-white"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {msg.role === "user" ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none text-sm leading-relaxed [&_table]:w-full [&_table]:text-xs [&_th]:bg-secondary [&_th]:px-3 [&_th]:py-1.5 [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_pre]:bg-sidebar-bg [&_pre]:text-sidebar-text [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-xs">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {streaming && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {streamingText ? (
                      <div className="prose prose-sm max-w-none text-sm leading-relaxed [&_table]:w-full [&_table]:text-xs [&_th]:bg-secondary [&_th]:px-3 [&_th]:py-1.5 [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamingText}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border bg-white p-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-3 rounded-xl border border-border bg-white p-2 shadow-sm transition-shadow focus-within:border-primary focus-within:shadow-md">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your Vidalytics data..."
                rows={1}
                className="flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                style={{ maxHeight: "120px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
              <Button
                size="sm"
                onClick={() => sendMessage()}
                disabled={!input.trim() || streaming}
              >
                {streaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Vydalitics AI Analyst uses Claude to analyze your video data in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
