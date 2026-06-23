"use client";

import { useEffect, useRef, useState } from "react";

export type Msg = { role: "user" | "assistant"; content: string };

const READY_MARKER = "[[READY]]";

// Hide the marker (and any partial still streaming in) from what the user sees.
function stripMarker(s: string): string {
  return s
    .replace(/\[\[READY\]\]/g, "")
    .replace(/\[\[?[A-Z]{0,5}\]?$/, "")
    .trimEnd();
}

export default function IntakeChat({
  partyName,
  opener,
  messages,
  streaming,
  onAdvance,
  onSend,
}: {
  partyName: string;
  opener: string;
  messages: Msg[];
  streaming: boolean;
  onAdvance: () => void;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  // Show the "next step" nudge once the mediator signals it's wrapping up
  // (the [[READY]] marker), with a fallback for conversations already underway.
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  const ready =
    messages.some(
      (m) => m.role === "assistant" && m.content.includes(READY_MARKER),
    ) || assistantCount >= 4;

  function submit() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    onSend(text);
  }

  return (
    <section className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-3">
        <p className="text-sm font-medium text-stone-900">Meet the mediator</p>
        <p className="text-xs text-stone-500">
          A private chat so the mediator gets to know {partyName}.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <Bubble role="assistant" content={opener} />
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={stripMarker(m.content)} />
        ))}
        {streaming && messages[messages.length - 1]?.content === "" && (
          <Bubble role="assistant" content="…" />
        )}
      </div>

      {/* Recommended next action, revealed when intake is sufficiently complete */}
      {ready && !streaming && (
        <div className="border-t border-emerald-100 bg-emerald-50/60 px-3 py-3">
          <button
            onClick={onAdvance}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Next: share what matters to you →
          </button>
          <p className="mt-1.5 text-center text-xs text-stone-400">
            You can keep chatting with the mediator, or move on whenever you&apos;re ready.
          </p>
        </div>
      )}

      <div className="border-t border-stone-100 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Reply as ${partyName}…`}
            disabled={streaming}
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
          isUser ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-800"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
