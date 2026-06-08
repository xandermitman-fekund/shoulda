"use client";

import { useEffect, useState } from "react";
import type { Interest } from "./InterestsPanel";

export default function PrioritiesPanel({
  partyName,
  interests,
  onSavePoints,
}: {
  partyName: string;
  interests: Interest[];
  onSavePoints: (
    allocs: { interestId: string; points: number }[],
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [points, setPoints] = useState<Record<string, number>>(() =>
    Object.fromEntries(interests.map((i) => [i.id, i.points])),
  );
  const [saveMsg, setSaveMsg] = useState("");

  const ids = interests.map((i) => i.id).join(",");
  useEffect(() => {
    setPoints((prev) => {
      const next: Record<string, number> = {};
      for (const i of interests) next[i.id] = prev[i.id] ?? i.points;
      return next;
    });
    setSaveMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  if (interests.length < 3) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500 shadow-sm">
        Add at least 3 interests in the{" "}
        <strong className="text-stone-700">What matters</strong> step first, then
        come back here to set {partyName}&apos;s priorities.
      </section>
    );
  }

  const total = Object.values(points).reduce((s, n) => s + n, 0);

  function bump(id: string, delta: number) {
    setPoints((p) => {
      const v = Math.max(0, Math.min(10, (p[id] ?? 0) + delta));
      return { ...p, [id]: v };
    });
    setSaveMsg("");
  }

  async function save() {
    const r = await onSavePoints(
      interests.map((i) => ({ interestId: i.id, points: points[i.id] ?? 0 })),
    );
    setSaveMsg(r.ok ? "Saved ✓" : r.error ?? "Could not save.");
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-medium text-stone-900">
        What matters most to {partyName}?
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        You have <strong>10 points</strong> to spend across your interests. Give
        more to what matters more — it helps everyone see your priorities.
      </p>

      <div className="mt-4 space-y-2">
        {interests.map((i) => (
          <div key={i.id} className="flex items-center gap-3">
            <span className="flex-1 text-sm text-stone-700">{i.text}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => bump(i.id, -1)}
                className="h-7 w-7 rounded-md border border-stone-300 text-stone-600 hover:bg-stone-100"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-medium text-stone-900">
                {points[i.id] ?? 0}
              </span>
              <button
                onClick={() => bump(i.id, 1)}
                className="h-7 w-7 rounded-md border border-stone-300 text-stone-600 hover:bg-stone-100"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={`text-sm font-medium ${
            total === 10 ? "text-emerald-700" : "text-stone-500"
          }`}
        >
          {total} / 10 points used
        </span>
        <div className="flex items-center gap-3">
          {saveMsg && <span className="text-sm text-stone-500">{saveMsg}</span>}
          <button
            onClick={save}
            disabled={total !== 10}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Save priorities
          </button>
        </div>
      </div>
    </section>
  );
}
