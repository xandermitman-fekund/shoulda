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
  setMustHave,
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
  currentPartyId,
  inviteCode,
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
  currentPartyId: string;
  inviteCode: string;
  intakeByParty: Record<string, Msg[]>;
  interestsByParty: Record<string, Interest[]>;
  initialOptions: Option[];
  initialScores: ScoreSeed[];
}) {
  // You are always your own party — no actor switching.
  const me = currentPartyId;
  const [phase, setPhase] = useState<Phase>("intake");

  const [msgs, setMsgs] = useState<Record<string, Msg[]>>(intakeByParty);
  const [interests, setInterests] =
    useState<Record<string, Interest[]>>(interestsByParty);
  const [suggestionsByParty, setSuggestionsByParty] = useState<
    Record<string, string[]>
  >({});
  const [streaming, setStreaming] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const self = parties.find((p) => p.id === me);
  const others = parties.filter((p) => p.id !== me);

  const allInterests = parties
    .flatMap((p) => (interests[p.id] ?? []).map((i) => ({ ...i })))
    .sort(
      (a, b) =>
        Number(b.mustHave) - Number(a.mustHave) ||
        b.points - a.points ||
        a.text.localeCompare(b.text),
    );
  const sortedOptions = [...options].sort((a, b) =>
    a.shortName.localeCompare(b.shortName),
  );

  function copyInvite() {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ---- Intake chat ----
  function updateMsgs(updater: (prev: Msg[]) => Msg[]) {
    setMsgs((prev) => ({ ...prev, [me]: updater(prev[me] ?? []) }));
  }

  async function handleSend(text: string) {
    setStreaming(true);
    updateMsgs((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    try {
      const res = await fetch("/api/mediator/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negotiationId, message: text }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        updateMsgs((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistant };
          return copy;
        });
      }
    } catch {
      updateMsgs((prev) => {
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

  // ---- Interests (yours) ----
  function setMyInterests(updater: (prev: Interest[]) => Interest[]) {
    setInterests((prev) => ({ ...prev, [me]: updater(prev[me] ?? []) }));
  }

  async function handleAdd(text: string) {
    const r = await createInterest(negotiationId, text);
    if (r)
      setMyInterests((prev) => [
        ...prev,
        { id: r.id, text: r.text, points: 0, mustHave: false },
      ]);
  }

  async function handleEditInterest(id: string, text: string) {
    await updateInterest(id, text);
    setMyInterests((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  }

  async function handleDeleteInterest(id: string) {
    await deleteInterest(id);
    setMyInterests((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleToggleMustHave(id: string, mustHave: boolean) {
    await setMustHave(id, mustHave);
    setMyInterests((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, mustHave, points: mustHave ? 0 : i.points } : i,
      ),
    );
  }

  async function handleSavePoints(
    allocs: { interestId: string; points: number }[],
  ) {
    const r = await saveInterestPoints(negotiationId, allocs);
    if (r.ok) {
      setMyInterests((prev) =>
        prev.map((i) => ({
          ...i,
          points: allocs.find((a) => a.interestId === i.id)?.points ?? i.points,
        })),
      );
    }
    return r;
  }

  async function handleSuggest() {
    setSuggesting(true);
    try {
      const list = await suggestInterests(negotiationId);
      setSuggestionsByParty((prev) => ({ ...prev, [me]: list }));
    } finally {
      setSuggesting(false);
    }
  }

  function handleClassify(text: string) {
    return classifyInterest(negotiationId, text);
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

  // ---- Scoring (yours) ----
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
    const key = scoreKey(me, optionId, interestId);
    setScores((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    if (next === null) {
      await setScore(negotiationId, optionId, interestId, { kind: "clear" });
    } else if (next.na) {
      await setScore(negotiationId, optionId, interestId, { kind: "na" });
    } else {
      await setScore(negotiationId, optionId, interestId, {
        kind: "value",
        value: next.value ?? 0,
      });
    }
  }

  const myName = self?.displayName ?? "You";
  const opener = `Hi ${myName}. I'm your mediator — I'm here to help everyone find a solution you can all say "yes" to. There are no wrong answers here. To start, what's something about you that would help me understand where you're coming from?`;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
          ← All negotiations
        </Link>

        <header className="mt-4 mb-5">
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

        {/* Participants + invite */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-sm text-stone-600">
            You&apos;re here as{" "}
            <span className="font-medium text-stone-900">{myName}</span>
            {others.length > 0 ? (
              <> · with {others.map((o) => o.displayName).join(", ")}</>
            ) : (
              <> · no one else has joined yet</>
            )}
          </p>
          <button
            onClick={copyInvite}
            className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            {copied ? "Invite link copied ✓" : "Invite others"}
          </button>
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

        {phase === "intake" && (
          <IntakeChat
            partyName={myName}
            opener={opener}
            messages={msgs[me] ?? []}
            streaming={streaming}
            onAdvance={() => setPhase("interests")}
            onSend={handleSend}
          />
        )}

        {phase === "interests" && (
          <InterestsPanel
            partyName={myName}
            interests={interests[me] ?? []}
            suggestions={suggestionsByParty[me] ?? []}
            suggesting={suggesting}
            onAdd={handleAdd}
            onEdit={handleEditInterest}
            onDelete={handleDeleteInterest}
            onToggleMustHave={handleToggleMustHave}
            onSuggest={handleSuggest}
            onAcceptSuggestion={(text) => handleAdd(text)}
            onClassify={handleClassify}
          />
        )}

        {phase === "priorities" && (
          <PrioritiesPanel
            partyName={myName}
            interests={interests[me] ?? []}
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

        {phase === "scoring" && (
          <ScoringGrid
            partyName={myName}
            interests={allInterests}
            options={sortedOptions}
            getScore={(optionId, interestId) => getScore(me, optionId, interestId)}
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
            ? "Green cells are where you already agree."
            : "Invite the others, then work through the steps together."}
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
