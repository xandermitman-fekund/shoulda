"use client";

import type { Scipab } from "./scipab-actions";

const SECTIONS: { key: keyof Scipab; label: string; hint: string }[] = [
  { key: "situation", label: "Situation", hint: "What's going on — the shared story" },
  { key: "complication", label: "Complication", hint: "The core issue, and whose needs aren't met" },
  { key: "implication", label: "Implication", hint: "Why the status quo can't stand" },
  { key: "position", label: "Position", hint: "What we should do, in brief" },
  { key: "action", label: "Action", hint: "The concrete plan — the win-win" },
  { key: "benefit", label: "Benefit", hint: "What we gain by following through" },
];

export default function ScipabPanel({
  scipab,
  drafting,
  error,
  hasOptions,
  onDraft,
}: {
  scipab: Scipab | null;
  drafting: boolean;
  error: string;
  hasOptions: boolean;
  onDraft: () => void;
}) {
  // Empty state — first draft.
  if (!scipab) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-stone-900">
          Get to yes — your agreement
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          When you&apos;ve explored enough on the map, have the assistant draft your{" "}
          <strong>document of record</strong>. It reads everyone&apos;s intake,
          interests, priorities, and scores, then writes up the shared story, the
          recommended win-win, and where you still disagree — using the SCIPAB
          structure.
        </p>
        {!hasOptions && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Tip: add a few options and score them first (steps 4–5) for a much richer
            agreement.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={onDraft}
          disabled={drafting}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {drafting ? "Drafting your agreement…" : "✨ Draft our agreement"}
        </button>
      </section>
    );
  }

  // Drafted document.
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-stone-900">
              Your agreement
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Drafted by the assistant from everyone&apos;s input — your shared
              document of record.
            </p>
          </div>
          <button
            onClick={onDraft}
            disabled={drafting}
            className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400 disabled:opacity-50"
          >
            {drafting ? "Re-drafting…" : "↻ Re-draft"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {scipab.recommendedOptions.length > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Recommended
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {scipab.recommendedOptions.map((o, i) => (
                <span
                  key={i}
                  className="rounded-full bg-white px-3 py-1 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200"
                >
                  {o}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <article className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        {SECTIONS.map(({ key, label, hint }) => {
          const text = scipab[key] as string;
          if (!text?.trim()) return null;
          return (
            <div key={key}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {label}
                <span className="ml-2 font-normal normal-case text-stone-300">
                  {hint}
                </span>
              </h3>
              <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-700">
                {text}
              </p>
            </div>
          );
        })}
      </article>

      {scipab.tensions.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-sm font-medium text-amber-900">
            Still to resolve
          </h3>
          <ul className="mt-2 space-y-1.5">
            {scipab.tensions.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-amber-900">
                <span className="text-amber-500">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
