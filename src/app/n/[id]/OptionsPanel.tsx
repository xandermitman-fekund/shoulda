"use client";

import { useState } from "react";

export type Option = { id: string; shortName: string; description: string };

export default function OptionsPanel({
  options,
  suggestions,
  suggesting,
  onAdd,
  onDelete,
  onSuggest,
  onAcceptSuggestion,
}: {
  options: Option[];
  suggestions: { shortName: string; description: string }[];
  suggesting: boolean;
  onAdd: (shortName: string, description: string) => void;
  onDelete: (id: string) => void;
  onSuggest: () => void;
  onAcceptSuggestion: (shortName: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  function add() {
    const n = name.trim();
    if (!n) return;
    onAdd(n, desc.trim());
    setName("");
    setDesc("");
  }

  return (
    <section className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-medium text-stone-900">Ideas on the table</h2>
        <p className="mt-1 text-sm text-stone-500">
          Now the creative part — put possible solutions (&ldquo;options&rdquo;)
          out for everyone to consider. Ideas aren&apos;t labeled with who
          suggested them, so each one gets a fair look. Aim for at least 3.
        </p>
      </div>

      {/* AI option invention */}
      <div>
        <button
          onClick={onSuggest}
          disabled={suggesting}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
        >
          {suggesting ? "Thinking…" : "✨ Suggest ideas"}
        </button>
        {suggestions.length > 0 && (
          <div className="mt-3 space-y-2">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="rounded-lg border border-dashed border-stone-300 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-800">{s.shortName}</p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {s.description}
                    </p>
                  </div>
                  <button
                    onClick={() => onAcceptSuggestion(s.shortName, s.description)}
                    className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The shared board */}
      <div className="space-y-2">
        {options.length === 0 && (
          <p className="text-sm text-stone-400">
            No ideas yet. Add one below or use suggestions.
          </p>
        )}
        {options.map((o) => (
          <div
            key={o.id}
            className="rounded-lg border border-stone-200 bg-stone-50 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-stone-800">{o.shortName}</p>
                {o.description && (
                  <p className="mt-0.5 text-sm text-stone-600">{o.description}</p>
                )}
              </div>
              <button
                onClick={() => onDelete(o.id)}
                title="Mediator can remove an idea"
                className="shrink-0 rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <p className="text-xs text-stone-400">
          {options.length} idea{options.length === 1 ? "" : "s"} · aim for at least 3
        </p>
      </div>

      {/* Add an idea */}
      <div className="space-y-2 border-t border-stone-100 pt-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="Idea name (e.g. “Sell the house and split the proceeds”)"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          placeholder="Describe it briefly — enough that everyone can judge how well it meets their needs."
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          Add idea
        </button>
      </div>
    </section>
  );
}
