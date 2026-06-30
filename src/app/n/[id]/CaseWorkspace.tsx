"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import IntakeChat, { type Msg } from "./IntakeChat";
import InterestsPanel from "./InterestsPanel";
import PrioritiesPanel from "./PrioritiesPanel";
import OptionsPanel, { type Option } from "./OptionsPanel";
import ScoringGrid, { type ScoreState } from "./ScoringGrid";
import MapWorkspace from "./MapWorkspace";
import {
  createInterest,
  updateInterest,
  deleteInterest,
  setMustHave,
  saveInterestPoints,
  submitInterests,
  reopenInterests,
  suggestInterests,
  classifyInterest,
} from "./interests-actions";
import ScipabPanel from "./ScipabPanel";
import {
  createOption,
  updateOption,
  deleteOption,
  setGoState,
  suggestOptions,
} from "./options-actions";
import { setScore } from "./scoring-actions";
import { draftScipab, type Scipab } from "./scipab-actions";
import { pollState } from "./sync-actions";
import { negotiationRef } from "@/lib/ref";

type Party = { id: string; displayName: string; role: string; interestsReady: boolean };
type Phase =
  | "intake"
  | "interests"
  | "priorities"
  | "options"
  | "scoring"
  | "map"
  | "scipab";
type WorkInterest = {
  id: string;
  text: string;
  mustHave: boolean;
  ownerPartyId: string; // internal only — who typed it; never exposed in the UI
  myPoints: number;
  totalPoints: number;
  backerIds: string[]; // parties with ≥1 point on this interest (the association)
};

// One badge style per party, assigned by join order. Stable across the workspace.
const PARTY_BADGE_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
];
export type Backer = {
  id: string;
  name: string;
  initial: string;
  color: string;
};
type ScoreSeed = {
  partyId: string;
  optionId: string;
  interestId: string;
  value: number | null;
  na: boolean;
};

function buildScoreMap(seeds: ScoreSeed[]): Record<string, ScoreState> {
  const m: Record<string, ScoreState> = {};
  for (const s of seeds ?? []) {
    m[`${s.partyId}|${s.optionId}|${s.interestId}`] = {
      value: s.value,
      na: s.na,
    };
  }
  return m;
}

export default function CaseWorkspace({
  negotiationId,
  caseLabel,
  status,
  description,
  parties: initialParties,
  currentPartyId,
  inviteCode,
  intakeByParty,
  allInterests,
  initialOptions,
  initialScores,
  initialScipab,
}: {
  negotiationId: string;
  caseLabel: string;
  status: string;
  description: string;
  parties: Party[];
  currentPartyId: string;
  inviteCode: string;
  intakeByParty: Record<string, Msg[]>;
  allInterests: WorkInterest[];
  initialOptions: Option[];
  initialScores: ScoreSeed[];
  initialScipab: Scipab | null;
}) {
  // You are always your own party — no actor switching.
  const me = currentPartyId;
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [phase, setPhase] = useState<Phase>("intake");

  const [msgs, setMsgs] = useState<Record<string, Msg[]>>(intakeByParty);
  const [interests, setInterests] = useState<WorkInterest[]>(allInterests);
  const [readyByParty, setReadyByParty] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(parties.map((p) => [p.id, p.interestsReady])),
  );
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

  const [scores, setScores] = useState<Record<string, ScoreState>>(() =>
    buildScoreMap(initialScores),
  );

  const [scipab, setScipab] = useState<Scipab | null>(initialScipab);
  const [draftingScipab, setDraftingScipab] = useState(false);
  const [scipabError, setScipabError] = useState("");

  // ---- Live sync: poll the shared board and merge in everyone else's changes ----
  const lastSync = useRef<string>("");
  useEffect(() => {
    let active = true;
    async function tick() {
      if (typeof document !== "undefined" && document.hidden) return;
      let result: Awaited<ReturnType<typeof pollState>>;
      try {
        result = await pollState(negotiationId);
      } catch {
        return;
      }
      if (!active || !result) return;
      const data = result;
      const snap = JSON.stringify({
        parties: data.parties,
        allInterests: data.allInterests,
        options: data.options,
        scores: data.scores,
        scipab: data.scipab,
      });
      if (snap === lastSync.current) return; // nothing changed — skip the churn
      lastSync.current = snap;

      setParties(data.parties);
      // Keep my own readiness local (optimistic + authoritative for me).
      setReadyByParty((prev) => {
        const next: Record<string, boolean> = {};
        for (const p of data.parties)
          next[p.id] =
            p.id === me ? (prev[p.id] ?? p.interestsReady) : p.interestsReady;
        return next;
      });
      setInterests(data.allInterests);
      setOptions(data.options);
      // My scores are write-through — keep mine local, take everyone else's from the server.
      setScores((prev) => {
        const next = buildScoreMap(data.scores);
        for (const key of Object.keys(next))
          if (key.split("|")[0] === me) delete next[key];
        for (const key of Object.keys(prev))
          if (key.split("|")[0] === me) next[key] = prev[key];
        return next;
      });
      setScipab(data.scipab);
    }
    const id = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negotiationId, me]);

  const self = parties.find((p) => p.id === me);
  const others = parties.filter((p) => p.id !== me);
  const myName = self?.displayName ?? "You";

  // ---- Readiness / the gate ----
  const submitted = !!readyByParty[me];
  // Shared steps open once at least one other person has joined and everyone has shared.
  const allReady = parties.length >= 2 && parties.every((p) => readyByParty[p.id]);

  const sortInterests = (list: WorkInterest[]) =>
    [...list].sort(
      (a, b) =>
        Number(b.mustHave) - Number(a.mustHave) ||
        b.totalPoints - a.totalPoints ||
        a.text.localeCompare(b.text),
    );

  // Resolve a party id into a display badge (initial + color), color stable by join order.
  function badgeFor(partyId: string): Backer {
    const idx = parties.findIndex((p) => p.id === partyId);
    const name = parties[idx]?.displayName ?? "?";
    return {
      id: partyId,
      name,
      initial: name[0]?.toUpperCase() ?? "?",
      color: PARTY_BADGE_COLORS[(idx < 0 ? 0 : idx) % PARTY_BADGE_COLORS.length],
    };
  }
  const myBadge = badgeFor(me);

  // Your own interests (step 2) — in creation order.
  const myInterests = interests
    .filter((i) => i.ownerPartyId === me)
    .map((i) => ({ id: i.id, text: i.text, mustHave: i.mustHave }));

  // Everyone's interests, for the cross-party priorities step. No authorship shown —
  // badges come from who's backing each one with points (your own resolves live in the panel).
  const priorityInterests = sortInterests(interests).map((i) => ({
    id: i.id,
    text: i.text,
    mustHave: i.mustHave,
    myPoints: i.myPoints,
    otherBackers: i.backerIds.filter((id) => id !== me).map(badgeFor),
  }));

  // Everyone's interests ranked by combined points, for the read-only scoring grid.
  const gridInterests = sortInterests(interests).map((i) => ({
    id: i.id,
    text: i.text,
    mustHave: i.mustHave,
    points: i.totalPoints,
    backers: i.backerIds.map(badgeFor),
  }));

  // Everyone's interests for the editable map workspace.
  const mapInterests = interests.map((i) => ({
    id: i.id,
    text: i.text,
    mustHave: i.mustHave,
    isMine: i.ownerPartyId === me,
    myPoints: i.myPoints,
    totalPoints: i.totalPoints,
    backers: i.backerIds.map(badgeFor),
  }));

  const sortedOptions = [...options].sort((a, b) =>
    a.shortName.localeCompare(b.shortName),
  );
  // No-go'd options are hidden from the read-only scoring grid.
  const activeOptions = sortedOptions.filter((o) => o.goState !== "no_go");

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

  async function handleSend(
    text: string,
    image?: { type: string; data: string },
  ) {
    setStreaming(true);
    updateMsgs((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        imageType: image?.type,
        imageData: image?.data,
      },
      { role: "assistant", content: "" },
    ]);
    try {
      const res = await fetch("/api/mediator/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negotiationId, message: text, image }),
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
  async function handleAdd(text: string) {
    const r = await createInterest(negotiationId, text);
    if (r)
      setInterests((prev) => [
        ...prev,
        {
          id: r.id,
          text: r.text,
          mustHave: false,
          ownerPartyId: me,
          myPoints: 0,
          totalPoints: 0,
          backerIds: [],
        },
      ]);
  }

  async function handleEditInterest(id: string, text: string) {
    await updateInterest(id, text);
    setInterests((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  }

  async function handleDeleteInterest(id: string) {
    await deleteInterest(id);
    setInterests((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleToggleMustHave(id: string, mustHave: boolean) {
    await setMustHave(id, mustHave);
    setInterests((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              mustHave,
              myPoints: mustHave ? 0 : i.myPoints,
              totalPoints: mustHave ? 0 : i.totalPoints,
              backerIds: mustHave ? [] : i.backerIds,
            }
          : i,
      ),
    );
  }

  async function handleSavePoints(
    allocs: { interestId: string; points: number }[],
  ) {
    const r = await saveInterestPoints(negotiationId, allocs);
    if (r.ok) {
      const byId = new Map(allocs.map((a) => [a.interestId, a.points]));
      setInterests((prev) =>
        prev.map((i) => {
          if (!byId.has(i.id)) return i;
          const newMy = byId.get(i.id) ?? 0;
          const others = i.backerIds.filter((id) => id !== me);
          return {
            ...i,
            myPoints: newMy,
            totalPoints: i.totalPoints - i.myPoints + newMy,
            backerIds: newMy > 0 ? [...others, me] : others,
          };
        }),
      );
    }
    return r;
  }

  // Set my points on a single interest from the map (rebuilds the full allocation).
  async function handleSetInterestPoints(id: string, points: number) {
    const allocs = interests
      .filter((i) => !i.mustHave)
      .map((i) => ({
        interestId: i.id,
        points: i.id === id ? Math.max(0, Math.min(10, points)) : i.myPoints,
      }));
    if (allocs.reduce((s, a) => s + a.points, 0) > 10) return;
    await handleSavePoints(allocs);
  }

  async function handleSubmitInterests() {
    setReadyByParty((prev) => ({ ...prev, [me]: true }));
    await submitInterests(negotiationId);
  }

  async function handleReopenInterests() {
    setReadyByParty((prev) => ({ ...prev, [me]: false }));
    await reopenInterests(negotiationId);
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
    if (r) setOptions((prev) => [...prev, { ...r, goState: null }]);
  }

  async function handleSetGoState(
    id: string,
    goState: "go" | "no_go" | null,
  ) {
    setOptions((prev) =>
      prev.map((o) => (o.id === id ? { ...o, goState } : o)),
    );
    await setGoState(id, goState);
  }

  async function handleDeleteOption(id: string) {
    await deleteOption(id);
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleEditOption(
    id: string,
    shortName: string,
    description: string,
  ) {
    const r = await updateOption(id, shortName, description);
    if (r)
      setOptions((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, shortName: r.shortName, description: r.description }
            : o,
        ),
      );
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

  // ---- The agreement (SCIPAB) ----
  async function handleDraftScipab() {
    setDraftingScipab(true);
    setScipabError("");
    try {
      const r = await draftScipab(negotiationId);
      if (r.ok) setScipab(r.scipab);
      else setScipabError(r.error);
    } finally {
      setDraftingScipab(false);
    }
  }

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
          <p
            className="mt-2 font-mono text-xs text-stone-400"
            title="Reference code — what the operator sees instead of your title (your title stays private to participants)"
          >
            ref {negotiationRef(negotiationId)}
          </p>
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
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-1.5 text-xs text-stone-400"
              title="This board updates automatically as everyone makes changes."
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
            <button
              onClick={copyInvite}
              className="shrink-0 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              {copied ? "Invite link copied ✓" : "Invite others"}
            </button>
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
            3 · Priorities{!allReady && " 🔒"}
          </Tab>
          <Tab active={phase === "options"} onClick={() => setPhase("options")}>
            4 · Options
          </Tab>
          <Tab active={phase === "scoring"} onClick={() => setPhase("scoring")}>
            5 · Scoring{!allReady && " 🔒"}
          </Tab>
          <Tab active={phase === "map"} onClick={() => setPhase("map")}>
            6 · The map
          </Tab>
          <Tab active={phase === "scipab"} onClick={() => setPhase("scipab")}>
            7 · The agreement
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
            interests={myInterests}
            suggestions={suggestionsByParty[me] ?? []}
            suggesting={suggesting}
            submitted={submitted}
            onAdd={handleAdd}
            onEdit={handleEditInterest}
            onDelete={handleDeleteInterest}
            onToggleMustHave={handleToggleMustHave}
            onSuggest={handleSuggest}
            onAcceptSuggestion={(text) => {
              handleAdd(text);
              setSuggestionsByParty((prev) => ({
                ...prev,
                [me]: (prev[me] ?? []).filter((s) => s !== text),
              }));
            }}
            onClassify={handleClassify}
            onSubmit={handleSubmitInterests}
            onReopen={handleReopenInterests}
          />
        )}

        {phase === "priorities" &&
          (allReady ? (
            <PrioritiesPanel
              partyName={myName}
              interests={priorityInterests}
              myBadge={myBadge}
              onSavePoints={handleSavePoints}
            />
          ) : (
            <LockedStep
              title="Priorities open once everyone's shared"
              parties={parties}
              readyByParty={readyByParty}
              me={me}
              meReady={submitted}
              onGoShare={() => setPhase("interests")}
            />
          ))}

        {phase === "options" && (
          <OptionsPanel
            options={options}
            suggestions={optionSuggestions}
            suggesting={suggestingOptions}
            onAdd={handleAddOption}
            onDelete={handleDeleteOption}
            onSuggest={handleSuggestOptions}
            onAcceptSuggestion={(name, desc) => handleAddOption(name, desc)}
            onDismissSuggestion={(i) =>
              setOptionSuggestions((prev) => prev.filter((_, idx) => idx !== i))
            }
            onSetGoState={handleSetGoState}
          />
        )}

        {phase === "scoring" &&
          (allReady ? (
            <ScoringGrid
              partyName={myName}
              interests={gridInterests}
              options={activeOptions}
              getScore={(optionId, interestId) => getScore(me, optionId, interestId)}
              onSet={handleSetScore}
            />
          ) : (
            <LockedStep
              title="Scoring opens once everyone's shared"
              parties={parties}
              readyByParty={readyByParty}
              me={me}
              meReady={submitted}
              onGoShare={() => setPhase("interests")}
            />
          ))}

        {phase === "map" && (
          <MapWorkspace
            me={me}
            parties={parties}
            interests={mapInterests}
            options={sortedOptions}
            scoringLocked={!allReady}
            getScore={getScore}
            onAddInterest={handleAdd}
            onEditInterest={handleEditInterest}
            onDeleteInterest={handleDeleteInterest}
            onToggleMustHave={handleToggleMustHave}
            onSetPoints={handleSetInterestPoints}
            onAddOption={(name, desc) => handleAddOption(name, desc)}
            onEditOption={handleEditOption}
            onDeleteOption={handleDeleteOption}
            onSetGoState={handleSetGoState}
            onSetScore={handleSetScore}
          />
        )}

        {phase === "scipab" && (
          <ScipabPanel
            scipab={scipab}
            drafting={draftingScipab}
            error={scipabError}
            hasOptions={options.length > 0}
            onDraft={handleDraftScipab}
          />
        )}

        <p className="mt-4 text-center text-xs text-stone-400">
          {phase === "map"
            ? "Green cells are where you already agree."
            : phase === "scipab"
              ? "Your living document of record — re-draft anytime as things change."
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

/** Shown for the shared steps until everyone has shared their interests. */
function LockedStep({
  title,
  parties,
  readyByParty,
  me,
  meReady,
  onGoShare,
}: {
  title: string;
  parties: { id: string; displayName: string }[];
  readyByParty: Record<string, boolean>;
  me: string;
  meReady: boolean;
  onGoShare: () => void;
}) {
  const soloed = parties.length < 2;
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-lg">
          🔒
        </span>
        <h2 className="text-lg font-medium text-stone-900">{title}</h2>
      </div>
      {soloed ? (
        <p className="mt-2 text-sm text-stone-500">
          You&apos;re the only one here so far. This step opens once someone else joins
          and shares what matters to them — the whole point is to weigh and score each
          other&apos;s interests, not just your own. Use{" "}
          <strong>Invite others</strong> at the top to bring them in.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-stone-500">
            This opens once <strong>everyone</strong> has shared their interests. Then
            you&apos;ll weigh and score the whole group&apos;s interests together —
            including theirs.
          </p>
          <ul className="mt-4 space-y-1.5">
            {parties.map((p) => {
              const ready = !!readyByParty[p.id];
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span>{ready ? "✓" : "⏳"}</span>
                  <span className={ready ? "text-stone-700" : "text-stone-500"}>
                    {p.displayName}
                    {p.id === me ? " (you)" : ""}
                  </span>
                  <span className="text-xs text-stone-400">
                    {ready ? "shared" : "still adding…"}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            {!meReady && (
              <button
                onClick={onGoShare}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Share my interests →
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-stone-400"
            >
              Check for updates
            </button>
          </div>
        </>
      )}
    </section>
  );
}
