"use client";

import { useEffect, useState } from "react";
import type { ScoreState } from "./ScoringGrid";
import type { Backer } from "./CaseWorkspace";

export type MapInterest = {
  id: string;
  text: string;
  mustHave: boolean;
  isMine: boolean;
  myPoints: number;
  totalPoints: number;
  backers: Backer[];
};
export type MapOption = {
  id: string;
  shortName: string;
  description: string;
  goState: "go" | "no_go" | null;
};
type Party = { id: string; displayName: string };

const BALLS = ["○", "◔", "◑", "◕", "●"];
function ball(s: ScoreState): string {
  if (s.na) return "n/a";
  if (s.value === null) return "·";
  return BALLS[s.value / 25] ?? "·";
}

type Align = "green" | "yellow" | "red" | "none";
function alignment(states: ScoreState[]): Align {
  const engaged = states.filter((s) => s.na || s.value !== null);
  if (engaged.length < 2) return "none";
  const nums = engaged.filter((s) => !s.na && s.value !== null).map((s) => s.value as number);
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

function cellValue(s: ScoreState): string {
  if (s.na) return "na";
  if (s.value === null) return "blank";
  return String(s.value);
}
function fromCellValue(v: string): ScoreState | null {
  if (v === "blank") return null;
  if (v === "na") return { value: null, na: true };
  return { value: Number(v), na: false };
}

// Effective score 0–1: a number as-is; n/a or blank → 0 (matches the framework sheet).
function effective(s: ScoreState): number {
  return s.na || s.value === null ? 0 : s.value / 100;
}
function fmtScore(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}
// A must-have is only met at ≥ 0.75 (75% or 100%); below that the option is Not Viable.
const VIABLE_THRESHOLD = 0.75;

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

export default function MapWorkspace({
  me,
  parties,
  interests,
  options,
  budget,
  spent,
  atInterestLimit,
  maxInterests,
  atOptionLimit,
  maxOptions,
  scoringLocked,
  isOwner,
  viewerPartyId,
  onSetActing,
  getScore,
  onAddInterest,
  onEditInterest,
  onDeleteInterest,
  onToggleMustHave,
  onSetPoints,
  onAddOption,
  onEditOption,
  onDeleteOption,
  onSetGoState,
  onSetScore,
}: {
  me: string;
  parties: Party[];
  interests: MapInterest[];
  options: MapOption[];
  budget: number;
  spent: number;
  atInterestLimit: boolean;
  maxInterests: number;
  atOptionLimit: boolean;
  maxOptions: number;
  scoringLocked: boolean;
  isOwner: boolean;
  viewerPartyId: string;
  onSetActing: (partyId: string) => void;
  getScore: (partyId: string, optionId: string, interestId: string) => ScoreState;
  onAddInterest: (text: string) => void;
  onEditInterest: (id: string, text: string) => void;
  onDeleteInterest: (id: string) => void;
  onToggleMustHave: (id: string, mustHave: boolean) => void;
  onSetPoints: (id: string, points: number) => void;
  onAddOption: (shortName: string, description: string) => void;
  onEditOption: (id: string, shortName: string, description: string) => void;
  onDeleteOption: (id: string) => void;
  onSetGoState: (id: string, goState: "go" | "no_go" | null) => void;
  onSetScore: (optionId: string, interestId: string, next: ScoreState | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newInterest, setNewInterest] = useState("");
  const [newOptName, setNewOptName] = useState("");
  const [newOptDesc, setNewOptDesc] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  // Stable order so columns don't jump while you edit points. Must-haves first.
  const cols = [...interests].sort(
    (a, b) => Number(b.mustHave) - Number(a.mustHave) || a.id.localeCompare(b.id),
  );
  const myTotal = spent;
  const others = parties.filter((p) => p.id !== me);
  const hiddenCount = options.filter((o) => o.goState === "no_go").length;
  const visibleOptions = showHidden
    ? options
    : options.filter((o) => o.goState !== "no_go");

  // Option Score = Σ over (person × non-must-have interest) of totalPoints × effective score.
  function optionScore(oId: string): number {
    let sum = 0;
    for (const i of interests) {
      if (i.mustHave) continue;
      for (const p of parties)
        sum += i.totalPoints * effective(getScore(p.id, oId, i.id));
    }
    return sum;
  }
  // Not Viable if anyone scores any must-have below the threshold.
  function optionViable(oId: string): boolean {
    for (const i of interests) {
      if (!i.mustHave) continue;
      for (const p of parties)
        if (effective(getScore(p.id, oId, i.id)) < VIABLE_THRESHOLD) return false;
    }
    return true;
  }
  const topScore = (() => {
    const vs = visibleOptions
      .filter((o) => optionViable(o.id))
      .map((o) => optionScore(o.id));
    return vs.length ? Math.max(...vs) : -1;
  })();

  function addInterest() {
    const t = newInterest.trim();
    if (!t || atInterestLimit) return;
    onAddInterest(t);
    setNewInterest("");
  }
  function addOption() {
    const n = newOptName.trim();
    if (!n || atOptionLimit) return;
    onAddOption(n, newOptDesc.trim());
    setNewOptName("");
    setNewOptDesc("");
  }

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-medium text-stone-900">Negotiation Map</h2>
        <p className="mt-1 text-sm text-stone-500">
          Everything lives here — add interests &amp; ideas, set your priorities, and
          score. Green is where you already agree.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {/* In full screen the control bar is hidden, so the Guide switches parties here. */}
        {expanded && isOwner && (
          <span className="flex items-center gap-1.5 text-sm text-stone-600">
            Acting as
            <select
              value={me}
              onChange={(e) => onSetActing(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm font-medium text-stone-900 outline-none focus:border-emerald-500"
            >
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                  {p.id === viewerPartyId ? " (you)" : ""}
                </option>
              ))}
            </select>
            {me !== viewerPartyId && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                on their behalf
              </span>
            )}
          </span>
        )}
        {!scoringLocked && (
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              spent > budget
                ? "bg-red-100 text-red-700"
                : "bg-stone-100 text-stone-600"
            }`}
            title="Your interest points used"
          >
            {spent} / {budget} pts
            {spent > budget && ` — remove ${spent - budget}`}
          </span>
        )}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400"
        >
          {expanded ? "✕ Exit full screen" : "⤢ Full screen"}
        </button>
      </div>
    </div>
  );

  const toolbar = (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addInterest();
          }}
          className="flex gap-1"
        >
          <input
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            placeholder={atInterestLimit ? "Interest limit reached" : "Add an interest…"}
            disabled={atInterestLimit}
            className="w-48 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500 disabled:bg-stone-50"
          />
          <button
            type="submit"
            disabled={!newInterest.trim() || atInterestLimit}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400 disabled:opacity-40"
          >
            + Interest
          </button>
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addOption();
          }}
          className="flex gap-1"
        >
          <input
            value={newOptName}
            onChange={(e) => setNewOptName(e.target.value)}
            placeholder={atOptionLimit ? "Idea limit reached" : "Add an idea…"}
            disabled={atOptionLimit}
            className="w-48 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500 disabled:bg-stone-50"
          />
          <input
            value={newOptDesc}
            onChange={(e) => setNewOptDesc(e.target.value)}
            placeholder="(detail, optional)"
            disabled={atOptionLimit}
            className="w-40 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500 disabled:bg-stone-50"
          />
          <button
            type="submit"
            disabled={!newOptName.trim() || atOptionLimit}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400 disabled:opacity-40"
          >
            + Idea
          </button>
        </form>
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowHidden((s) => !s)}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-600 hover:border-stone-400"
          >
            {showHidden ? "Hide no-go'd" : `Show hidden (${hiddenCount})`}
          </button>
        )}
      </div>
      {(atInterestLimit || atOptionLimit) && (
        <p className="mt-1.5 text-xs text-amber-700">
          {atInterestLimit && `Interest limit reached (${maxInterests} max).`}
          {atInterestLimit && atOptionLimit && " "}
          {atOptionLimit && `Idea limit reached (${maxOptions} max).`}{" "}
          Remove one to add another.
        </p>
      )}
    </div>
  );

  const lockBanner = scoringLocked && (
    <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
      🔒 Scoring &amp; priorities open once everyone has shared their interests (use
      the <strong>What matters</strong> step). You can still add and edit interests
      &amp; ideas here now.
    </div>
  );

  function interestHeader(i: MapInterest) {
    return (
      <th
        key={i.id}
        className="sticky top-0 z-10 min-w-[8.5rem] max-w-[11rem] bg-white p-2 align-top text-left text-xs font-medium text-stone-600"
      >
        {i.isMine ? (
          <input
            defaultValue={i.text}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== i.text) onEditInterest(i.id, v);
            }}
            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-stone-700 hover:border-stone-200 focus:border-emerald-400 focus:bg-white focus:outline-none"
          />
        ) : (
          <div className="line-clamp-3 px-1" title={i.text}>
            {i.text}
          </div>
        )}

        <div className="mt-1 flex items-center gap-1 px-1">
          {i.isMine && (
            <button
              onClick={() => onToggleMustHave(i.id, !i.mustHave)}
              title={i.mustHave ? "Must-have — click to unset" : "Mark as must-have"}
              className={`rounded px-1 text-[10px] font-medium ${
                i.mustHave ? "bg-amber-100 text-amber-800" : "border border-stone-200 text-stone-400 hover:bg-stone-100"
              }`}
            >
              ★
            </button>
          )}
          {i.isMine && (
            <button
              onClick={() => onDeleteInterest(i.id)}
              title="Remove interest"
              className="rounded px-1 text-[10px] text-stone-300 hover:bg-stone-100 hover:text-stone-600"
            >
              ✕
            </button>
          )}
          {i.backers.map((b) => (
            <Badge key={b.id} b={b} />
          ))}
        </div>

        <div className="mt-1 px-1">
          {i.mustHave ? (
            <span className="text-[10px] font-medium text-amber-600">★ must-have</span>
          ) : (
            <div className="flex items-center gap-1 text-stone-500">
              <button
                onClick={() => onSetPoints(i.id, i.myPoints - 1)}
                disabled={scoringLocked || i.myPoints <= 0}
                className="h-5 w-5 rounded border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-4 text-center text-xs font-medium text-stone-800">
                {i.myPoints}
              </span>
              <button
                onClick={() => onSetPoints(i.id, i.myPoints + 1)}
                disabled={scoringLocked || myTotal >= budget}
                className="h-5 w-5 rounded border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-30"
              >
                +
              </button>
              <span className="text-[10px] text-stone-400">my pts</span>
            </div>
          )}
        </div>
      </th>
    );
  }

  function optionRow(o: MapOption) {
    const isNoGo = o.goState === "no_go";
    const score = optionScore(o.id);
    const viable = optionViable(o.id);
    const isLeader = viable && score === topScore && topScore > 0;
    return (
      <tr
        key={o.id}
        className={`border-t border-stone-100 ${isNoGo ? "opacity-60" : ""}`}
      >
        <th className="sticky left-0 z-10 min-w-[12rem] max-w-[15rem] bg-white p-2 text-left align-top">
          <div className="flex items-start gap-1">
            <div className="flex-1">
              {!scoringLocked && (
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span
                    title="Option score — higher is better"
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                      isLeader
                        ? "bg-emerald-600 text-white"
                        : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {fmtScore(score)}
                  </span>
                  {isLeader && (
                    <span className="text-[10px] font-medium text-emerald-600">
                      top
                    </span>
                  )}
                  {!viable && (
                    <span
                      title="Fails a must-have for someone — talk it out; can't mark Go"
                      className="rounded bg-red-100 px-1 py-0.5 text-[10px] font-medium text-red-700"
                    >
                      Not viable
                    </span>
                  )}
                </div>
              )}
              <input
                defaultValue={o.shortName}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== o.shortName) onEditOption(o.id, v, o.description);
                }}
                className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-stone-700 hover:border-stone-200 focus:border-emerald-400 focus:bg-white focus:outline-none"
              />
              <input
                defaultValue={o.description}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== o.description) onEditOption(o.id, o.shortName, v);
                }}
                placeholder="add detail…"
                className="mt-0.5 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-stone-500 hover:border-stone-200 focus:border-emerald-400 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex shrink-0 flex-col items-center gap-0.5">
              <div className="flex gap-0.5">
                <button
                  onClick={() => onSetGoState(o.id, o.goState === "go" ? null : "go")}
                  disabled={!viable && o.goState !== "go"}
                  title={
                    viable || o.goState === "go"
                      ? "Go"
                      : "Not viable — can't mark Go until it meets every must-have"
                  }
                  className={`rounded px-1 text-xs ${
                    o.goState === "go"
                      ? "bg-emerald-100"
                      : !viable
                        ? "opacity-20"
                        : "opacity-40 hover:bg-stone-100 hover:opacity-100"
                  }`}
                >
                  👍
                </button>
                <button
                  onClick={() =>
                    onSetGoState(o.id, o.goState === "no_go" ? null : "no_go")
                  }
                  title="No-go (hides this idea)"
                  className={`rounded px-1 text-xs ${
                    o.goState === "no_go"
                      ? "bg-red-100"
                      : "opacity-40 hover:bg-stone-100 hover:opacity-100"
                  }`}
                >
                  👎
                </button>
              </div>
              <button
                onClick={() => onDeleteOption(o.id)}
                title="Remove idea"
                className="rounded px-1 text-xs text-stone-300 hover:bg-stone-100 hover:text-stone-600"
              >
                ✕
              </button>
            </div>
          </div>
        </th>
        {cols.map((i) => {
          const states = parties.map((p) => getScore(p.id, o.id, i.id));
          const al = alignment(states);
          const myState = getScore(me, o.id, i.id);
          return (
            <td key={i.id} className={`p-1 text-center align-middle ${BG[al]}`}>
              {scoringLocked ? (
                <span className="text-xs text-stone-300">–</span>
              ) : (
                <select
                  value={cellValue(myState)}
                  onChange={(e) => onSetScore(o.id, i.id, fromCellValue(e.target.value))}
                  className="rounded border border-stone-200 bg-white px-1 py-0.5 text-xs text-stone-800 outline-none focus:border-emerald-500"
                >
                  <option value="blank">–</option>
                  <option value="0">○ 0%</option>
                  <option value="25">◔ 25%</option>
                  <option value="50">◑ 50%</option>
                  <option value="75">◕ 75%</option>
                  <option value="100">● 100%</option>
                  <option value="na">n/a</option>
                </select>
              )}
              {others.length > 0 && (
                <div className="mt-0.5 flex flex-wrap justify-center gap-1 text-[10px] text-stone-500">
                  {others.map((p) => {
                    const s = getScore(p.id, o.id, i.id);
                    return (
                      <span key={p.id} title={`${p.displayName}: ${ball(s)}`}>
                        {p.displayName[0]}
                        {ball(s)}
                      </span>
                    );
                  })}
                </div>
              )}
            </td>
          );
        })}
      </tr>
    );
  }

  const legend = (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-stone-500">
      <Legend color="bg-emerald-100" label="Agree" />
      <Legend color="bg-amber-100" label="Close" />
      <Legend color="bg-red-100" label="Far apart" />
      <span className="text-stone-400">
        The number on each idea is its overall score (higher is better); cells show
        each person&apos;s score (the dropdown is yours).
      </span>
    </div>
  );

  const grid =
    cols.length === 0 ? (
      <p className="mt-6 text-sm text-stone-500">
        Add a few interests above to start building the map.
      </p>
    ) : (
      <div className={expanded ? "mt-4 flex-1 overflow-auto" : "mt-4 max-h-[65vh] overflow-auto"}>
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-white p-2 text-left text-xs font-medium text-stone-400">
                idea \ interest
              </th>
              {cols.map(interestHeader)}
            </tr>
          </thead>
          <tbody>
            {visibleOptions.length === 0 ? (
              <tr className="border-t border-stone-100">
                <td colSpan={cols.length + 1} className="p-4 text-sm text-stone-400">
                  No ideas yet — add one above to start scoring.
                </td>
              </tr>
            ) : (
              visibleOptions.map(optionRow)
            )}
          </tbody>
        </table>
      </div>
    );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white p-6">
        {header}
        {lockBanner}
        {toolbar}
        {legend}
        {grid}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      {header}
      {lockBanner}
      {toolbar}
      {legend}
      {grid}
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
