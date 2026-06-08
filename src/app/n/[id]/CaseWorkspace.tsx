"use client";

import Link from "next/link";
import { useState } from "react";
import IntakeChat, { type Msg } from "./IntakeChat";
import InterestsPanel, { type Interest } from "./InterestsPanel";
import PrioritiesPanel from "./PrioritiesPanel";
import OptionsPanel, { type Option } from "./OptionsPanel";
import ScoringGrid, { type ScoreState } from "./ScoringGrid";
import NegotiationMap from "./NegotiationMap";
import {
  createInterest,
  updateInterest,
  deleteInterest,
  saveInterestPoints,
  suggestInterests,
  classifyInterest,
} from "./interests-actions";
import { createOption, deleteOption, suggestOptions } from "./options-actions";
import { setScore } from "./scoring-actions";

type Party = { id: string; displayName: string; role: string };
type Phase = "intake" | "interests" | "priorities" | "options" | "scoring" | "map";
type ScoreSeed = {
  partyId: string;
  optionId: string;
  interestId: string;
  value: number | null;
  na: boolean;
};

export default function CaseWorkspace({
  negotiationId,
  caseLabel,
  status,
  description,
  parties,
  intakeByParty,
  interestsByParty,
  initialOptions,
  initialScores,
}: {
  negotiationId: string;
  caseLabel: string;
  status: string;
  description: string;
  parties: Party[];
  intakeByParty: Record<string, Msg[]>;
  interestsByParty: Record<string, Interest[]>;
  initialOptions: Option[];
  initialScores: ScoreSeed[];
}) {
  const [selectedId, setSelectedId] = useState(parties[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>("intake");

  const [msgs, setMsgs] = useState<Record<string, Msg[]>>(intakeByParty);
  const [interests, setInterests] =
    useState<Record<string, Interest[]>>(interestsByParty);
  const [suggestionsByParty, setSuggestionsByParty] = useState<
    Record<string, string[]>
  >({});
  const [streaming, setStreaming] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [optionSuggestions, setOptionSuggestions] = useState<
    { shortName: string; description: string }[]
  >([]);
  const [suggestingOptions, setSuggestingOptions] = useState(false);

  const [scores, setScores] = useState<Record<string, ScoreState>>(() => {
    const m: Record<string, ScoreState> = {};
    for (const s of initialScores ?? []) {
      m[`${s.partyId}|${s.optionId}|${s.interestId}`] = {
        value: s.value,
        na: s.na,
      };
    }
    return m;
  });

  const selected = parties.find((p) => p.id === selectedId);

  // Interests across ALL parties, sorted by priority points (desc) — these are
  // the columns of the scoring grid and the map.
  const allInterests = parties
    .flatMap((p) => (interests[p.id] ?? []).map((i) => ({ ...i })))
    .sort((a, b) => b.points - a.points || a.text.localeCompare(b.text));
  const sortedOptions = [...options].sort((a, b) =>
    a.shortName.localeCompare(b.shortName),
  );

  // ---- Intake chat ----
  function updateMsgs(partyId: string, updater: (prev: Msg[]) => Msg[]) {
    setMsgs((prev) => ({ ...prev, [partyId]: updater(prev[partyId] ?? []) }));
  }

  async function handleSend(text: string) {
    const partyId = selectedId;
    setStreaming(true);
    updateMsgs(partyId, (prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    try {
      const res = await fetch("/api/mediator/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId, message: text }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        updateMsgs(partyId, (prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistant };
          return copy;
        });
      }
    } catch {
      updateMsgs(partyId, (prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "⚠️ Something went wrong reaching the mediator. Try again.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  // ---- Interests ----
  function setPartyInterests(
    partyId: string,
    updater: (prev: Interest[]) => Interest[],
  ) {
    setInterests((prev) => ({
      ...prev,
      [partyId]: updater(prev[partyId] ?? []),
    }));
  }

  async function handleAdd(text: string) {
    const partyId = selectedId;
    const r = await createInterest(partyId, text);
    if (r) {
      setPartyInterests(partyId, (prev) => [
        ...prev,
        { id: r.id, text: r.text, points: 0 },
      ]);
    }
  }

  async function handleEditInterest(id: string, text: string) {
    const partyId = selectedId;
    await updateInterest(id, text);
    setPartyInterests(partyId, (prev) =>
      prev.map((i) => (i.id === id ? { ...i, text } : i)),
    );
  }

  async function handleDeleteInterest(id: string) {
    const partyId = selectedId;
    await deleteInterest(id);
    setPartyInterests(partyId, (prev) => prev.filter((i) => i.id !== id));
  }

  async function handleSavePoints(
    allocs: { interestId: string; points: number }[],
  ) {
    const partyId = selectedId;
    const r = await saveInterestPoints(partyId, allocs);
    if (r.ok) {
      setPartyInterests(partyId, (prev) =>
        prev.map((i) => ({
          ...i,
          points: allocs.find((a) => a.interestId === i.id)?.points ?? i.points,
        })),
      );
    }
    return r;
  }

  async function handleSuggest() {
    const partyId = selectedId;
    setSuggesting(true);
    try {
      const list = await suggestInterests(partyId);
      setSuggestionsByParty((prev) => ({ ...prev, [partyId]: list }));
    } finally {
      setSuggesting(false);
    }
  }

  function handleClassify(text: string) {
    return classifyInterest(selectedId, text);
  }

  // ---- Options (shared) ----
  async function handleAddOption(shortName: string, description: string) {
    const r = await createOption(negotiationId, shortName, description);
    if (r) setOptions((prev) => [...prev, r]);
  }

  async function handleDeleteOption(id: string) {
    await deleteOption(id);
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleSuggestOptions() {
    setSuggestingOptions(true);
    try {
      setOptionSuggestions(await suggestOptions(negotiationId));
    } finally {
      setSuggestingOptions(false);
    }
  }

  // ---- Scoring ----
  function scoreKey(partyId: string, optionId: string, interestId: string) {
    return `${partyId}|${optionId}|${interestId}`;
  }
  function getScore(
    partyId: string,
    optionId: string,
    interestId: string,
  ): ScoreState {
    return scores[scoreKey(partyId, optionId, interestId)] ?? {
      value: null,
      na: false,
    };
  }
  async function handleSetScore(
    optionId: string,
    interestId: string,
    next: ScoreState | null,
  ) {
    const partyId = selectedId;
    const key = scoreKey(partyId, optionId, interestId);
    setScores((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    if (next === null) {
      await setScore(partyId, optionId, interestId, { kind: "clear" });
    } else if (next.na) {
      await setScore(partyId, optionId, interestId, { kind: "na" });
    } else {
      await setScore(partyId, optionId, interestId, {
        kind: "value",
        value: next.value ?? 0,
      });
    }
  }

  const opener = selected
    ? `Hi ${selected.displayName}. I'm your mediator — I'm here to help everyone find a solution you can all say "yes" to. There are no wrong answers here. To start, what's something about you that would help me understand where you're coming from?`
    : "";

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
          ← All cases
        </Link>

        <header className="mt-4 mb-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              {caseLabel}
            </h1>
            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {status}
            </span>
          </div>
          {description && <p className="mt-2 text-stone-600">{description}</p>}
        </header>

        {/* Actor switcher */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
            You are acting as
          </p>
          <div className="flex flex-wrap gap-2">
            {parties.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  p.id === selectedId
                    ? "bg-stone-900 text-white"
                    : "border border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                }`}
              >
                {p.displayName}
              </button>
            ))}
          </div>
        </div>

        {/* Phase tabs */}
        <div className="mb-5 flex flex-wrap gap-1 border-b border-stone-200">
          <Tab active={phase === "intake"} onClick={() => setPhase("intake")}>
            1 · Meet the mediator
          </Tab>
          <Tab active={phase === "interests"} onClick={() => setPhase("interests")}>
            2 · What matters
          </Tab>
          <Tab active={phase === "priorities"} onClick={() => setPhase("priorities")}>
            3 · Priorities
          </Tab>
          <Tab active={phase === "options"} onClick={() => setPhase("options")}>
            4 · Options
          </Tab>
          <Tab active={phase === "scoring"} onClick={() => setPhase("scoring")}>
            5 · Scoring
          </Tab>
          <Tab active={phase === "map"} onClick={() => setPhase("map")}>
            6 · The map
          </Tab>
        </div>

        {phase === "intake" && selected && (
          <IntakeChat
            partyName={selected.displayName}
            opener={opener}
            messages={msgs[selectedId] ?? []}
            streaming={streaming}
            onSend={handleSend}
          />
        )}

        {phase === "interests" && selected && (
          <InterestsPanel
            partyName={selected.displayName}
            interests={interests[selectedId] ?? []}
            suggestions={suggestionsByParty[selectedId] ?? []}
            suggesting={suggesting}
            onAdd={handleAdd}
            onEdit={handleEditInterest}
            onDelete={handleDeleteInterest}
            onSuggest={handleSuggest}
            onAcceptSuggestion={(text) => handleAdd(text)}
            onClassify={handleClassify}
          />
        )}

        {phase === "priorities" && selected && (
          <PrioritiesPanel
            partyName={selected.displayName}
            interests={interests[selectedId] ?? []}
            onSavePoints={handleSavePoints}
          />
        )}

        {phase === "options" && (
          <OptionsPanel
            options={options}
            suggestions={optionSuggestions}
            suggesting={suggestingOptions}
            onAdd={handleAddOption}
            onDelete={handleDeleteOption}
            onSuggest={handleSuggestOptions}
            onAcceptSuggestion={(name, desc) => handleAddOption(name, desc)}
          />
        )}

        {phase === "scoring" && selected && (
          <ScoringGrid
            partyName={selected.displayName}
            interests={allInterests}
            options={sortedOptions}
            getScore={(optionId, interestId) =>
              getScore(selectedId, optionId, interestId)
            }
            onSet={handleSetScore}
          />
        )}

        {phase === "map" && (
          <NegotiationMap
            interests={allInterests}
            options={sortedOptions}
            parties={parties}
            getScore={getScore}
          />
        )}

        <p className="mt-4 text-center text-xs text-stone-400">
          {phase === "map"
            ? "Green cells are where you already agree. Next: vote ideas up or down and get to yes."
            : "Next up: scoring every option against every interest — then the map lights up."}
        </p>
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-emerald-600 text-stone-900"
          : "border-transparent text-stone-400 hover:text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}
