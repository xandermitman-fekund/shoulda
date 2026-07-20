"use client";

import { useEffect, useState } from "react";
import type { Backer } from "./CaseWorkspace";

export type PriorityInterest = {
  id: string;
  text: string;
  mustHave: boolean;
  myPoints: number;
  otherBackers: Backer[];
};

function Badge({ b }: { b: Backer }) {
  return (
    <span
      title={`${b.name} is backing this`}
      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold ${b.color}`}
    >
      {b.initial}
    </span>
  );
}

export default function PrioritiesPanel({
  partyName,
  budget,
  interests,
  myBadge,
  onSavePoints,
}: {
  partyName: string;
  budget: number;
  interests: PriorityInterest[];
  myBadge: Backer;
  onSavePoints: (
    allocs: { interestId: string; points: number }[],
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const mustHaves = interests.filter((i) => i.mustHave);
  const pointable = interests.filter((i) => !i.mustHave);

  const [points, setPoints] = useState<Record<string, number>>(() =>
    Object.fromEntries(pointable.map((i) => [i.id, i.myPoints])),
  );
  // Last-saved baseline (server truth), so we know when there's nothing to save.
  const [savedPoints, setSavedPoints] = useState<Record<string, number>>(() =>
    Object.fromEntries(pointable.map((i) => [i.id, i.myPoints])),
  );
  const [saveMsg, setSaveMsg] = useState("");

  const ids = pointable.map((i) => i.id).join(",");
  useEffect(() => {
    setPoints((prev) => {
      const next: Record<string, number> = {};
      for (const i of pointable) next[i.id] = prev[i.id] ?? i.myPoints;
      return next;
    });
    setSavedPoints(Object.fromEntries(pointable.map((i) => [i.id, i.myPoints])));
    setSaveMsg("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const total = pointable.reduce((s, i) => s + (points[i.id] ?? 0), 0);
  const over = total > budget;
  const overBy = total - budget;
  const dirty = pointable.some(
    (i) => (points[i.id] ?? 0) !== (savedPoints[i.id] ?? 0),
  );

  function bump(id: string, delta: number) {
    setPoints((p) => {
      const v = Math.max(0, Math.min(budget, (p[id] ?? 0) + delta));
      return { ...p, [id]: v };
    });
    setSaveMsg("");
  }

  async function save() {
    const r = await onSavePoints(
      pointable.map((i) => ({ interestId: i.id, points: points[i.id] ?? 0 })),
    );
    if (r.ok) {
      setSavedPoints({ ...points });
      setSaveMsg("");
    } else {
      setSaveMsg(r.error ?? "Could not save.");
    }
  }

  // Badges for one interest: who else is backing it + you, live, if you've put a point on it.
  function badges(i: PriorityInterest, mine: boolean) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        {i.otherBackers.map((b) => (
          <Badge key={b.id} b={b} />
        ))}
        {mine && <Badge b={myBadge} />}
      </span>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-medium text-stone-900">
        What matters — to everyone
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        These are all the interests on the table — no labels for who suggested what.
        Spend <strong>up to {budget} points</strong> on the ones that matter to
        you, including the others&apos;. Your badge{" "}
        <span className="align-middle">
          <Badge b={myBadge} />
        </span>{" "}
        appears on each interest you back — take your points off to step away from it.
        Where badges stack up is your <strong>common ground</strong>.
      </p>

      {/* Must-haves: top priority, no points */}
      {mustHaves.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
            ★ Must-haves · top priority
          </p>
          <ul className="mt-2 space-y-1">
            {mustHaves.map((i) => (
              <li
                key={i.id}
                className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-stone-700"
              >
                <span className="text-amber-600">★</span>
                <span className="flex-1">{i.text}</span>
                {badges(i, false)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-stone-400">
            Non-negotiables — they sit above the points, so there&apos;s nothing to
            weigh here.
          </p>
        </div>
      )}

      {/* Points allocator over the non-must-have interests */}
      {pointable.length === 0 ? (
        <p className="mt-5 text-sm text-stone-500">
          Every interest on the table is a must-have — nothing left to weigh.
          You&apos;re set for this step.
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-2">
            {pointable.map((i) => (
              <div key={i.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-stone-700">{i.text}</span>
                {badges(i, (points[i.id] ?? 0) > 0)}
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
                over ? "text-red-600" : "text-stone-500"
              }`}
            >
              {total} / {budget} points used
              {over && ` — remove ${overBy} to save`}
            </span>
            <div className="flex items-center gap-3">
              {saveMsg ? (
                <span className="text-sm text-red-600">{saveMsg}</span>
              ) : !dirty ? (
                <span className="text-sm text-stone-400">Saved ✓</span>
              ) : null}
              <button
                onClick={save}
                disabled={over || !dirty}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Save priorities
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
