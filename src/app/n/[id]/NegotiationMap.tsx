"use client";

import { useEffect, useState } from "react";
import type { ScoreState } from "./ScoringGrid";
import type { Backer } from "./CaseWorkspace";

type Interest = {
  id: string;
  text: string;
  points: number;
  mustHave: boolean;
  backers?: Backer[];
};

function Badge({ b }: { b: Backer }) {
  return (
    <span
      title={`${b.name} is backing this`}
      className={`inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-[10px] font-semibold ${b.color}`}
    >
      {b.initial}
    </span>
  );
}
type Option = { id: string; shortName: string };
type Party = { id: string; displayName: string };

const BALLS = ["○", "◔", "◑", "◕", "●"];
function ball(s: ScoreState): string {
  if (s.na) return "n/a";
  if (s.value === null) return "·";
  return BALLS[s.value / 25] ?? "·";
}

type Align = "green" | "yellow" | "red" | "none";

/** Color a cell by how aligned the parties' scores are (not by the score itself). */
function alignment(states: ScoreState[]): Align {
  const engaged = states.filter((s) => s.na || s.value !== null);
  if (engaged.length < 2) return "none";
  const nums = engaged
    .filter((s) => !s.na && s.value !== null)
    .map((s) => s.value as number);
  const anyNa = engaged.some((s) => s.na);
  if (anyNa && nums.length > 0) return "red";
  if (nums.length === 0) return "green";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) return "green";
  if (max - min <= 25) return "yellow";
  return "red";
}

const BG: Record<Align, string> = {
  green: "bg-emerald-100",
  yellow: "bg-amber-100",
  red: "bg-red-100",
  none: "bg-white",
};

export default function NegotiationMap({
  interests,
  options,
  parties,
  getScore,
}: {
  interests: Interest[];
  options: Option[];
  parties: Party[];
  getScore: (partyId: string, optionId: string, interestId: string) => ScoreState;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (interests.length === 0 || options.length === 0) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500 shadow-sm">
        Once there are interests and ideas — and people start scoring — the map
        will light up here.
      </section>
    );
  }

  const headerBar = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-medium text-stone-900">The map</h2>
        <p className="mt-1 text-sm text-stone-500">
          Where everyone already agrees, and where you don&apos;t — live.
          Interests run across the top (most important first); ideas down the side.
        </p>
      </div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400"
      >
        {expanded ? "✕ Exit full screen" : "⤢ Full screen"}
      </button>
    </div>
  );

  const legend = (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-stone-500">
      <Legend color="bg-emerald-100" label="Agree" />
      <Legend color="bg-amber-100" label="Close" />
      <Legend color="bg-red-100" label="Far apart" />
      <span className="text-stone-400">
        Cells show each person&apos;s score (e.g. {parties[0]?.displayName?.[0] ?? "A"}●).
      </span>
    </div>
  );

  const tableEl = (
    <table className="border-collapse">
      <thead>
        <tr>
          <th className="sticky left-0 top-0 z-20 bg-white p-2 text-left text-xs font-medium text-stone-400">
            idea \ interest
          </th>
          {interests.map((i) => (
            <th
              key={i.id}
              className="sticky top-0 z-10 min-w-[7rem] max-w-[10rem] bg-white p-2 align-bottom text-left text-xs font-medium text-stone-600"
            >
              <div className="line-clamp-3" title={i.text}>
                {i.text}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-stone-400">
                {i.mustHave ? (
                  <span className="font-medium text-amber-600">★ must-have</span>
                ) : i.backers && i.backers.length > 0 ? (
                  i.backers.map((b) => <Badge key={b.id} b={b} />)
                ) : (
                  <span className="text-stone-300">no points yet</span>
                )}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {options.map((o) => (
          <tr key={o.id} className="border-t border-stone-100">
            <th className="sticky left-0 z-10 max-w-[12rem] bg-white p-2 text-left text-sm font-medium text-stone-700">
              <div className="line-clamp-2" title={o.shortName}>
                {o.shortName}
              </div>
            </th>
            {interests.map((i) => {
              const states = parties.map((p) => getScore(p.id, o.id, i.id));
              const al = alignment(states);
              return (
                <td key={i.id} className={`p-1 text-center ${BG[al]}`}>
                  <div className="flex items-center justify-center gap-1.5">
                    {parties.map((p, idx) => (
                      <span
                        key={p.id}
                        className="text-xs text-stone-700"
                        title={`${p.displayName}: ${ball(states[idx])}`}
                      >
                        {p.displayName[0]}
                        {ball(states[idx])}
                      </span>
                    ))}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white p-6">
        {headerBar}
        {legend}
        <div className="mt-4 flex-1 overflow-auto">{tableEl}</div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      {headerBar}
      {legend}
      <div className="mt-4 max-h-[65vh] overflow-auto">{tableEl}</div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${color}`} />
      {label}
    </span>
  );
}
