"use client";

import { useState } from "react";
import type { InterestClassification } from "./interests-actions";

export type Interest = {
  id: string;
  text: string;
  mustHave: boolean;
};

type Note = { message: string; suggestion: string; original: string };

export default function InterestsPanel({
  partyName,
  interests,
  atNegotiationLimit,
  maxInterests,
  addError,
  suggestions,
  suggesting,
  submitted,
  onAdd,
  onEdit,
  onDelete,
  onToggleMustHave,
  onSuggest,
  onAcceptSuggestion,
  onClassify,
  onSubmit,
  onReopen,
}: {
  partyName: string;
  interests: Interest[];
  atNegotiationLimit: boolean;
  maxInterests: number;
  addError: string;
  suggestions: string[];
  suggesting: boolean;
  submitted: boolean;
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onToggleMustHave: (id: string, mustHave: boolean) => void;
  onSuggest: () => void;
  onAcceptSuggestion: (text: string) => void;
  onClassify: (text: string) => Promise<InterestClassification>;
  onSubmit: () => void;
  onReopen: () => void;
}) {
  const [newText, setNewText] = useState("");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  const addBlocked = interests.length >= 5 || atNegotiationLimit;

  async function submit() {
    const text = newText.trim();
    if (!text || checking || addBlocked) return;
    setChecking(true);
    setNote(null);
    try {
      // Classify is a coaching nicety — never let it block adding.
      let result: InterestClassification | null = null;
      try {
        result = await onClassify(text);
      } catch {
        result = null;
      }
      if (result && result.classification !== "interest") {
        setNote({
          message: result.message,
          suggestion: result.suggestedInterest,
          original: text,
        });
      } else {
        onAdd(text);
        setNewText("");
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

  // Once shared, the list locks in. Editing requires re-opening it.
  if (submitted) {
    return (
      <section className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-medium text-emerald-900">
            ✓ You&apos;ve shared what matters to you
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            The group can now see your interests. Once everyone has shared, you&apos;ll
            weigh and score them together — including each other&apos;s.
          </p>
        </div>

        <ul className="space-y-1">
          {interests.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700"
            >
              {i.mustHave && <span className="text-amber-600">★</span>}
              <span>{i.text}</span>
              {i.mustHave && (
                <span className="text-xs font-medium text-amber-700">
                  must-have
                </span>
              )}
            </li>
          ))}
        </ul>

        <button
          onClick={onReopen}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400"
        >
          Edit my interests
        </button>
      </section>
    );
  }

  const canShare = interests.length >= 3 && interests.length <= 5;

  return (
    <section className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-medium text-stone-900">
          What matters to {partyName}
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Name 3–5 things you genuinely care about, framed positively — the deeper
          needs behind the situation, not specific solutions (those come later).
          Mark a <span className="font-medium text-amber-700">★ must-have</span> for
          anything non-negotiable; those sit above the points.
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
              onClick={() => onToggleMustHave(i.id, !i.mustHave)}
              title={
                i.mustHave
                  ? "Must-have (non-negotiable) — click to unset"
                  : "Mark as a must-have (non-negotiable, top priority)"
              }
              className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                i.mustHave
                  ? "bg-amber-100 text-amber-800"
                  : "border border-stone-300 text-stone-400 hover:bg-stone-100"
              }`}
            >
              ★ Must-have
            </button>
            <button
              onClick={() => onDelete(i.id)}
              className="shrink-0 rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Mediator coaching when a typed item looks like an option */}
        {note && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">A note from your assistant</p>
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
            disabled={addBlocked || checking}
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50"
          />
          <button
            onClick={submit}
            disabled={!newText.trim() || addBlocked || checking}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-stone-400 disabled:opacity-40"
          >
            {checking ? "Checking…" : "Add"}
          </button>
        </div>
        {addError ? (
          <p className="text-xs font-medium text-red-600">⚠️ {addError}</p>
        ) : atNegotiationLimit ? (
          <p className="text-xs text-amber-700">
            This negotiation has reached its {maxInterests}-interest limit. Remove one
            (here or on the map) to add another.
          </p>
        ) : (
          <p className="text-xs text-stone-400">
            {interests.length} of 3–5{interests.length > 5 ? " (too many)" : ""}
          </p>
        )}
      </div>

      {/* Share with the group — gates the shared steps */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <p className="text-sm text-stone-500">
          {canShare
            ? "Ready? Share your interests so the group can move on together."
            : "Add at least 3 interests, then share them with the group."}
        </p>
        <button
          onClick={onSubmit}
          disabled={!canShare}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          Done — share my interests
        </button>
      </div>
    </section>
  );
}
