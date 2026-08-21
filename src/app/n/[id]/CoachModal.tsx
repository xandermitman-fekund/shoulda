"use client";

import { useEffect, useRef, useState } from "react";

type CMsg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What am I missing here?",
  "Where's the common ground?",
  "Which options are weak or redundant?",
  "How do I get everyone to a win-win faster?",
];

/**
 * Private strategy chat for the negotiation owner (the "Guide"). Talks to the Coach
 * API route, which grounds its advice in the live board (but never in parties'
 * private intake chats). Self-contained: owns its own chat state; not persisted.
 */
export default function CoachModal({
  negotiationId,
  caseLabel,
  onClose,
}: {
  negotiationId: string;
  caseLabel: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<CMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || streaming) return;
    const next: CMsg[] = [...messages, { role: "user", content: t }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      const res = await fetch("/api/mediator/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negotiationId, messages: next }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistant };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "⚠️ Something went wrong reaching the Coach. Please try again.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-stone-100 px-5 py-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <span aria-hidden>🧭</span> Coach
            </p>
            <p className="text-xs text-stone-500">
              Private strategy chat about &ldquo;{caseLabel}&rdquo; — grounded in your
              board, built on <em>Getting to Yes</em>. Parties never see this.
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            ✕
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                I&apos;ve read your board — the parties, their interests and points,
                the options, and the scores. Ask me where the win-win is hiding, what
                you&apos;re missing, or how to move faster. I&apos;ll be specific and
                honest.
              </div>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={streaming}
                    className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)
          )}
          {streaming && messages[messages.length - 1]?.content === "" && (
            <Bubble role="assistant" content="…" />
          )}
        </div>

        <div className="border-t border-stone-100 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the Coach…"
              disabled={streaming}
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-stone-50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
          isUser ? "bg-indigo-600 text-white" : "bg-stone-100 text-stone-800"
        }`}
      >
        {content && <div className="whitespace-pre-wrap">{content}</div>}
      </div>
    </div>
  );
}
