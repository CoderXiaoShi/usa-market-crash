"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MSG: Message = {
  role: "assistant",
  content: "你好！我是 AI 市场分析助手。你可以问我关于美股市场、风险指标、经济数据等方面的问题。",
};

export default function ChatPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat/messages")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveMsg = useCallback(async (role: string, content: string) => {
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content }),
      });
    } catch { /* best effort */ }
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    saveMsg("user", text);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: buffer };
          return copy;
        });
      }
      saveMsg("assistant", buffer);
    } catch (err: any) {
      const errorContent = `[错误] ${err.message || "AI 服务暂不可用"}`;
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: errorContent,
        };
        return copy;
      });
      saveMsg("assistant", errorContent);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, saveMsg]);

  return (
    <div className="card overflow-hidden">
      <div
        className="flex justify-between items-center px-5 py-3.5 border-b border-[var(--border)] text-sm font-semibold cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>AI 市场分析助手</span>
        <span
          className="text-[var(--muted)] transition-transform"
          style={{ transform: collapsed ? "rotate(-90deg)" : "none" }}
        >
          ▾
        </span>
      </div>
      {!collapsed && (
        <>
          <div className="h-[280px] overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[85%] text-[13px] leading-relaxed px-3 py-2.5 rounded-xl ${
                  msg.role === "assistant"
                    ? "bg-white/[0.05] mr-auto"
                    : "bg-blue-500/15 ml-auto"
                }`}
              >
                <div className="text-[11px] text-[var(--muted)] mb-1">
                  {msg.role === "assistant" ? "AI 助手" : "你"}
                </div>
                {msg.content ? (
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : loading && msg.role === "assistant" ? (
                  "思考中..."
                ) : (
                  ""
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2 px-5 py-3 border-t border-[var(--border)]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="输入你的问题..."
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text)] outline-none focus:border-[var(--blue)] disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-lg bg-[var(--blue)] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
            >
              发送
            </button>
          </div>
        </>
      )}
    </div>
  );
}
