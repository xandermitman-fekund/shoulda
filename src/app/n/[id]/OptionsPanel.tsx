"use client";

import { useState } from "react";

export type Option = {
  id: string;
  shortName: string;
  description: string;
  goState: "go" | "no_go" | null;
};

export default function OptionsPanel({
  options,
  suggestions,
  suggesting,
  onAdd,
  onDelete,
  onSuggest,
  onAcceptSuggestion,
  onDismissSuggestion,
  onSetGoState,
}: {
  options: Option[];
  suggestions: { shortName: string; description: string }[];
  suggesting: boolean;
  onAdd: (shortName: string, description: string) => void;
  onDelete: (id: string) => void;
  onSuggest: () => void;
  onAcceptSuggestion: (shortName: string, description: string) => void;
  onDismissSuggestion: (index: number) => void;
  onSetGoState: (id: string, goState: "go" | "no_go" | null) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  const hidden = options.filter((o) => o.goState === "no_go");
  const shown = options.filter((o) => o.goState !== "no_go");
  const list = showHidden ? options : shown;

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
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => {
                        onAcceptSuggestion(s.shortName, s.description);
                        onDismissSuggestion(i);
                      }}
                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      + Add
                    </button>
                    <button
                      onClick={() => onDismissSuggestion(i)}
                      title="Dismiss this suggestion"
                      className="rounded-md px-2 py-1 text-xs font-medium text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The shared board */}
      <div className="space-y-2">
        {shown.length === 0 && hidden.length === 0 && (
          <p className="text-sm text-stone-400">
            No ideas yet. Add one below or use suggestions.
          </p>
        )}
        {list.map((o) => {
          const isNoGo = o.goState === "no_go";
          return (
            <div
              key={o.id}
              className={`rounded-lg border border-stone-200 bg-stone-50 p-3 ${
                isNoGo ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className={`font-medium text-stone-800 ${
                      isNoGo ? "line-through" : ""
                    }`}
                  >
                    {o.shortName}
                  </p>
                  {o.description && (
                    <p className="mt-0.5 text-sm text-stone-600">{o.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => onSetGoState(o.id, o.goState === "go" ? null : "go")}
                    title="Go"
                    className={`rounded-md px-2 py-1 text-sm ${
                      o.goState === "go"
                        ? "bg-emerald-100"
                        : "opacity-50 hover:bg-stone-100 hover:opacity-100"
                    }`}
                  >
                    👍
                  </button>
                  <button
                    onClick={() =>
                      onSetGoState(o.id, o.goState === "no_go" ? null : "no_go")
                    }
                    title="No-go (hides this idea)"
                    className={`rounded-md px-2 py-1 text-sm ${
                      o.goState === "no_go"
                        ? "bg-red-100"
                        : "opacity-50 hover:bg-stone-100 hover:opacity-100"
                    }`}
                  >
                    👎
                  </button>
                  <button
                    onClick={() => onDelete(o.id)}
                    title="Remove idea"
                    className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between">
          <p className="text-xs text-stone-400">
            {shown.length} idea{shown.length === 1 ? "" : "s"} · aim for at least 3
          </p>
          {hidden.length > 0 && (
            <button
              onClick={() => setShowHidden((s) => !s)}
              className="text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              {showHidden ? "Hide no-go'd" : `Show hidden (${hidden.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Add an idea */}
      <div className="space-y-2 border-t border-stone-100 pt-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
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
