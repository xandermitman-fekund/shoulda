"use client";

import { useState } from "react";
import type { InterestClassification } from "./interests-actions";

export type Interest = { id: string; text: string; points: number };

type Note = { message: string; suggestion: string; original: string };

export default function InterestsPanel({
  partyName,
  interests,
  suggestions,
  suggesting,
  onAdd,
  onEdit,
  onDelete,
  onSuggest,
  onAcceptSuggestion,
  onClassify,
}: {
  partyName: string;
  interests: Interest[];
  suggestions: string[];
  suggesting: boolean;
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onSuggest: () => void;
  onAcceptSuggestion: (text: string) => void;
  onClassify: (text: string) => Promise<InterestClassification>;
}) {
  const [newText, setNewText] = useState("");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  async function submit() {
    const text = newText.trim();
    if (!text || checking || interests.length >= 5) return;
    setChecking(true);
    setNote(null);
    try {
      const result = await onClassify(text);
      if (result.classification === "interest") {
        onAdd(text);
        setNewText("");
      } else {
        setNote({
          message: result.message,
          suggestion: result.suggestedInterest,
          original: text,
        });
      }
    } finally {
      setChecking(false);
    }
  }

  function addAndClear(text: string) {
    onAdd(text);
    setNewText("");
    setNote(null);
  }

  return (
    <section className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-medium text-stone-900">
          What matters to {partyName}
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Name 3–5 things you genuinely care about, framed positively — the deeper
          needs behind the situation, not specific solutions (those come later).
        </p>
      </div>

      {/* AI suggestions */}
      <div>
        <button
          onClick={onSuggest}
          disabled={suggesting}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
        >
          {suggesting ? "Thinking…" : "✨ Suggest from our chat"}
        </button>
        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onAcceptSuggestion(s)}
                className="rounded-full border border-dashed border-stone-300 px-3 py-1 text-sm text-stone-600 transition-colors hover:border-emerald-400 hover:text-emerald-700"
                title="Click to add"
              >
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interest list */}
      <div className="space-y-2">
        {interests.length === 0 && (
          <p className="text-sm text-stone-400">
            No interests yet. Add one below or use suggestions.
          </p>
        )}
        {interests.map((i) => (
          <div key={i.id} className="flex items-center gap-2">
            <input
              defaultValue={i.text}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== i.text) onEdit(i.id, v);
              }}
              className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none focus:border-emerald-500 focus:bg-white"
            />
            <button
              onClick={() => onDelete(i.id)}
              className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Mediator coaching when a typed item looks like an option */}
        {note && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">A note from your mediator</p>
            <p className="mt-1 text-amber-900">{note.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {note.suggestion && (
                <button
                  onClick={() => addAndClear(note.suggestion)}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  ✓ Use “{note.suggestion}”
                </button>
              )}
              <button
                onClick={() => addAndClear(note.original)}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400"
              >
                Add “{note.original}” anyway
              </button>
              <button
                onClick={() => setNote(null)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100"
              >
                Let me rephrase
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Add something that matters to you…"
            disabled={interests.length >= 5 || checking}
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50"
          />
          <button
            onClick={submit}
            disabled={!newText.trim() || interests.length >= 5 || checking}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-stone-400 disabled:opacity-40"
          >
            {checking ? "Checking…" : "Add"}
          </button>
        </div>
        <p className="text-xs text-stone-400">
          {interests.length} of 3–5{interests.length > 5 ? " (too many)" : ""}
          {interests.length >= 3 && (
            <span className="text-emerald-600">
              {" "}
              · ready for the Priorities step →
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
