"use client";

import { useEffect, useRef, useState } from "react";

export type Msg = { role: "user" | "assistant"; content: string };

export default function IntakeChat({
  partyName,
  opener,
  messages,
  streaming,
  onSend,
}: {
  partyName: string;
  opener: string;
  messages: Msg[];
  streaming: boolean;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

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
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {streaming && messages[messages.length - 1]?.content === "" && (
          <Bubble role="assistant" content="…" />
        )}
      </div>

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
