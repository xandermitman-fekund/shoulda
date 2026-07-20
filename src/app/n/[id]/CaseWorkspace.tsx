"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import IntakeChat, { type Msg } from "./IntakeChat";
import InterestsPanel from "./InterestsPanel";
import PrioritiesPanel from "./PrioritiesPanel";
import OptionsPanel, { type Option } from "./OptionsPanel";
import ScoringGrid, { type ScoreState } from "./ScoringGrid";
import MapWorkspace from "./MapWorkspace";
import ScipabPanel from "./ScipabPanel";
import PartyManager from "./PartyManager";
import ChangeLog from "./ChangeLog";
import FeedbackModal from "./FeedbackModal";
import {
  endNegotiation,
  submitFeedback,
  reopenNegotiation,
  type FeedbackInput,
} from "./status-actions";
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
import type { SharedParty, SharedInterest } from "./load-state";
import type { Limits } from "@/lib/limits";
import { negotiationRef } from "@/lib/ref";

type TopTab = "intake" | "map" | "agreement";
type SubPhase = "chat" | "interests" | "priorities" | "options" | "scoring";

// One badge style per party, assigned by join order. Stable across the workspace.
const PARTY_BADGE_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
];
export type Backer = { id: string; name: string; initial: string; color: string };

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
    m[`${s.partyId}|${s.optionId}|${s.interestId}`] = { value: s.value, na: s.na };
  }
  return m;
}

// Recompute an interest's totals after a party's points change.
function withPartyPoints(
  i: SharedInterest,
  partyId: string,
  points: number,
): SharedInterest {
  const pointsByParty = { ...i.pointsByParty };
  if (points > 0) pointsByParty[partyId] = points;
  else delete pointsByParty[partyId];
  return {
    ...i,
    pointsByParty,
    totalPoints: Object.values(pointsByParty).reduce((s, n) => s + n, 0),
    backerIds: Object.keys(pointsByParty),
  };
}

export default function CaseWorkspace({
  negotiationId,
  caseLabel,
  status: initialStatus,
  description,
  isOwner,
  viewerPartyId,
  parties: initialParties,
  intakeByParty,
  allInterests,
  initialOptions,
  initialScores,
  initialScipab,
  initialMyFeedback,
  limits,
}: {
  negotiationId: string;
  caseLabel: string;
  status: string;
  description: string;
  isOwner: boolean;
  viewerPartyId: string;
  parties: SharedParty[];
  intakeByParty: Record<string, Msg[]>;
  allInterests: SharedInterest[];
  initialOptions: Option[];
  initialScores: ScoreSeed[];
  initialScipab: Scipab | null;
  initialMyFeedback: FeedbackInput | null;
  limits: Limits;
}) {
  const [parties, setParties] = useState<SharedParty[]>(initialParties);
  const [status, setStatus] = useState(initialStatus);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [myFeedbackDone, setMyFeedbackDone] = useState(!!initialMyFeedback);
  const [addError, setAddError] = useState("");
  // Which party the current user is acting as. Non-owners are always their own seat.
  const [actingPartyId, setActingPartyId] = useState(viewerPartyId);
  const acting = parties.find((p) => p.id === actingPartyId) ?? parties.find((p) => p.id === viewerPartyId);
  const actingId = acting?.id ?? viewerPartyId;
  const actingBudget = acting?.pointBudget ?? 10;
  const isProxy = isOwner && actingId !== viewerPartyId;

  const [topTab, setTopTab] = useState<TopTab>("map");
  const [subPhase, setSubPhase] = useState<SubPhase>("chat");
  const [managing, setManaging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [msgs, setMsgs] = useState<Record<string, Msg[]>>(intakeByParty);
  const [interests, setInterests] = useState<SharedInterest[]>(allInterests);
  const [readyByParty, setReadyByParty] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialParties.map((p) => [p.id, p.interestsReady])),
  );
  const [suggestionsByParty, setSuggestionsByParty] = useState<Record<string, string[]>>({});
  const [streaming, setStreaming] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

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

  // In proxy mode there is no Intake surface — force to Map.
  useEffect(() => {
    if (isProxy && topTab === "intake") setTopTab("map");
  }, [isProxy, topTab]);

  // ---- Live sync ----
  const actingRef = useRef(actingId);
  actingRef.current = actingId;
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
        status: data.status,
        parties: data.parties,
        allInterests: data.allInterests,
        options: data.options,
        scores: data.scores,
        scipab: data.scipab,
      });
      if (snap === lastSync.current) return;
      lastSync.current = snap;

      setStatus(data.status);
      setParties(data.parties);
      setReadyByParty((prev) => {
        const next: Record<string, boolean> = {};
        for (const p of data.parties)
          next[p.id] =
            p.id === actingRef.current ? (prev[p.id] ?? p.interestsReady) : p.interestsReady;
        return next;
      });
      setInterests(data.allInterests);
      setOptions(data.options);
      // Keep the acting party's in-flight scores local so they don't flicker mid-edit.
      setScores((prev) => {
        const next = buildScoreMap(data.scores);
        const keep = actingRef.current;
        for (const key of Object.keys(next))
          if (key.split("|")[0] === keep) delete next[key];
        for (const key of Object.keys(prev))
          if (key.split("|")[0] === keep) next[key] = prev[key];
        return next;
      });
      setScipab(data.scipab);
    }
    const id = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [negotiationId]);

  const actingName = acting?.displayName ?? "You";
  const viewerName = parties.find((p) => p.id === viewerPartyId)?.displayName ?? "You";

  // ---- Readiness / the gate ----
  const submitted = !!readyByParty[actingId];
  const allReady = parties.length >= 2 && parties.every((p) => readyByParty[p.id]);
  // The owner (nudger) orchestrates freely; only invited real parties are gated.
  const scoringLocked = !isOwner && !allReady;

  const sortInterests = (list: SharedInterest[]) =>
    [...list].sort(
      (a, b) =>
        Number(b.mustHave) - Number(a.mustHave) ||
        b.totalPoints - a.totalPoints ||
        a.text.localeCompare(b.text),
    );

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
  const actingBadge = badgeFor(actingId);
  const actingPoints = (i: SharedInterest) => i.pointsByParty[actingId] ?? 0;
  const actingSpent = interests
    .filter((i) => !i.mustHave)
    .reduce((s, i) => s + actingPoints(i), 0);

  // Interests owned by the acting party (Intake "what matters").
  const myInterests = interests
    .filter((i) => i.ownerPartyId === actingId)
    .map((i) => ({ id: i.id, text: i.text, mustHave: i.mustHave }));

  const priorityInterests = sortInterests(interests).map((i) => ({
    id: i.id,
    text: i.text,
    mustHave: i.mustHave,
    myPoints: actingPoints(i),
    otherBackers: i.backerIds.filter((id) => id !== actingId).map(badgeFor),
  }));

  const gridInterests = sortInterests(interests).map((i) => ({
    id: i.id,
    text: i.text,
    mustHave: i.mustHave,
    points: i.totalPoints,
    backers: i.backerIds.map(badgeFor),
  }));

  const mapInterests = interests.map((i) => ({
    id: i.id,
    text: i.text,
    mustHave: i.mustHave,
    isMine: i.ownerPartyId === actingId,
    myPoints: actingPoints(i),
    totalPoints: i.totalPoints,
    backers: i.backerIds.map(badgeFor),
  }));

  const sortedOptions = [...options].sort((a, b) => a.shortName.localeCompare(b.shortName));
  const activeOptions = sortedOptions.filter((o) => o.goState !== "no_go");

  // Per-negotiation caps (admin-configured). Existing items over a lowered cap stay;
  // the limit only blocks adding more.
  const atPartyLimit = parties.length >= limits.maxParties;
  const atInterestLimit = interests.length >= limits.maxInterests;
  const atOptionLimit = options.length >= limits.maxOptions;

  // ---- Intake chat (viewer's own seat only — never proxied) ----
  function updateMsgs(updater: (prev: Msg[]) => Msg[]) {
    setMsgs((prev) => ({ ...prev, [viewerPartyId]: updater(prev[viewerPartyId] ?? []) }));
  }
  async function handleSend(text: string, image?: { type: string; data: string }) {
    setStreaming(true);
    updateMsgs((prev) => [
      ...prev,
      { role: "user", content: text, imageType: image?.type, imageData: image?.data },
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
          content: "⚠️ Something went wrong reaching the assistant. Try again.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  // ---- Interests (as the acting party) ----
  async function handleAdd(text: string) {
    const r = await createInterest(negotiationId, text, actingId);
    if ("id" in r) {
      setAddError("");
      setInterests((prev) => [
        ...prev,
        {
          id: r.id,
          text: r.text,
          mustHave: false,
          ownerPartyId: actingId,
          totalPoints: 0,
          backerIds: [],
          pointsByParty: {},
        },
      ]);
    } else {
      setAddError(r.error);
    }
  }
  async function handleEditInterest(id: string, text: string) {
    await updateInterest(id, text, actingId);
    setInterests((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
  }
  async function handleDeleteInterest(id: string) {
    await deleteInterest(id, actingId);
    setInterests((prev) => prev.filter((i) => i.id !== id));
  }
  async function handleToggleMustHave(id: string, mustHave: boolean) {
    const before = interests.find((i) => i.id === id);
    // Optimistic: flip immediately so the click always gives feedback.
    setInterests((prev) =>
      prev.map((i) =>
        i.id === id
          ? mustHave
            ? { ...i, mustHave, pointsByParty: {}, totalPoints: 0, backerIds: [] }
            : { ...i, mustHave }
          : i,
      ),
    );
    const r = await setMustHave(id, mustHave, actingId);
    // Revert if the server rejected it (keeps local + server in sync).
    if (!r && before) {
      setInterests((prev) => prev.map((i) => (i.id === id ? before : i)));
    }
  }
  async function handleSavePoints(allocs: { interestId: string; points: number }[]) {
    const r = await saveInterestPoints(negotiationId, allocs, actingId);
    if (r.ok) {
      const byId = new Map(allocs.map((a) => [a.interestId, a.points]));
      setInterests((prev) =>
        prev.map((i) =>
          byId.has(i.id) ? withPartyPoints(i, actingId, byId.get(i.id) ?? 0) : i,
        ),
      );
    }
    return r;
  }
  async function handleSetInterestPoints(id: string, points: number) {
    const allocs = interests
      .filter((i) => !i.mustHave)
      .map((i) => ({
        interestId: i.id,
        points: i.id === id ? Math.max(0, Math.min(actingBudget, points)) : actingPoints(i),
      }));
    if (allocs.reduce((s, a) => s + a.points, 0) > actingBudget) return;
    await handleSavePoints(allocs);
  }
  async function handleSubmitInterests() {
    setReadyByParty((prev) => ({ ...prev, [actingId]: true }));
    await submitInterests(negotiationId, actingId);
  }
  async function handleReopenInterests() {
    setReadyByParty((prev) => ({ ...prev, [actingId]: false }));
    await reopenInterests(negotiationId, actingId);
  }
  async function handleSuggest() {
    setSuggesting(true);
    try {
      const list = await suggestInterests(negotiationId);
      setSuggestionsByParty((prev) => ({ ...prev, [actingId]: list }));
    } finally {
      setSuggesting(false);
    }
  }
  function handleClassify(text: string) {
    return classifyInterest(negotiationId, text);
  }

  // ---- Options (shared; audited to the acting party) ----
  async function handleAddOption(shortName: string, description: string) {
    const r = await createOption(negotiationId, shortName, description, actingId);
    if (r) setOptions((prev) => [...prev, { ...r, goState: null }]);
  }
  async function handleSetGoState(id: string, goState: "go" | "no_go" | null) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, goState } : o)));
    await setGoState(id, goState, actingId);
  }
  async function handleDeleteOption(id: string) {
    await deleteOption(id, actingId);
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }
  async function handleEditOption(id: string, shortName: string, description: string) {
    const r = await updateOption(id, shortName, description, actingId);
    if (r)
      setOptions((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, shortName: r.shortName, description: r.description } : o,
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

  // ---- Scoring (as the acting party) ----
  function scoreKey(partyId: string, optionId: string, interestId: string) {
    return `${partyId}|${optionId}|${interestId}`;
  }
  function getScore(partyId: string, optionId: string, interestId: string): ScoreState {
    return scores[scoreKey(partyId, optionId, interestId)] ?? { value: null, na: false };
  }
  async function handleSetScore(
    optionId: string,
    interestId: string,
    next: ScoreState | null,
  ) {
    const key = scoreKey(actingId, optionId, interestId);
    setScores((prev) => {
      const copy = { ...prev };
      if (next === null) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    if (next === null) {
      await setScore(negotiationId, optionId, interestId, { kind: "clear" }, actingId);
    } else if (next.na) {
      await setScore(negotiationId, optionId, interestId, { kind: "na" }, actingId);
    } else {
      await setScore(
        negotiationId,
        optionId,
        interestId,
        { kind: "value", value: next.value ?? 0 },
        actingId,
      );
    }
  }

  // ---- Agreement ----
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

  // ---- End / feedback / reopen ----
  async function handleEndSubmit(data: FeedbackInput): Promise<boolean> {
    const r = await endNegotiation(negotiationId, data);
    if (r.ok) {
      setStatus(r.status);
      setMyFeedbackDone(true);
    }
    return r.ok;
  }
  async function handleFeedbackSubmit(data: FeedbackInput): Promise<boolean> {
    const r = await submitFeedback(negotiationId, data, actingId);
    if (r.ok) setMyFeedbackDone(true);
    return r.ok;
  }
  async function handleReopen() {
    setStatus("In Progress");
    await reopenNegotiation(negotiationId);
  }

  // ---- Party management callbacks (owner) ----
  const onPartyCreated = (p: SharedParty & { interestsReady?: boolean }) => {
    setParties((prev) => [...prev, { ...p, interestsReady: false }]);
    setReadyByParty((prev) => ({ ...prev, [p.id]: false }));
  };
  const onPartyRenamed = (id: string, name: string) =>
    setParties((prev) => prev.map((p) => (p.id === id ? { ...p, displayName: name } : p)));
  const onPartyBudget = (id: string, budget: number) =>
    setParties((prev) => prev.map((p) => (p.id === id ? { ...p, pointBudget: budget } : p)));
  const onPartyDeleted = (id: string) => {
    setParties((prev) => prev.filter((p) => p.id !== id));
    setInterests((prev) => prev.filter((i) => i.ownerPartyId !== id));
    if (actingId === id) setActingPartyId(viewerPartyId);
  };

  const opener = `Hi ${viewerName}. I'm your assistant — I'm here to help capture what matters to you so we can find a solution everyone can get behind. There are no wrong answers. To start, what's something that would help me understand where you're coming from?`;

  const showIntake = !isProxy;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
          ← All negotiations
        </Link>

        <header className="mt-4 mb-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              {caseLabel}
            </h1>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                status === "In Progress"
                  ? "bg-emerald-100 text-emerald-700"
                  : status === "Resolved"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-stone-200 text-stone-600"
              }`}
            >
              {status}
            </span>
          </div>
          {description && <p className="mt-2 text-stone-600">{description}</p>}
          <p className="mt-2 font-mono text-xs text-stone-400" title="Stable reference code">
            ref {negotiationRef(negotiationId)}
          </p>
        </header>

        {/* Control bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-stone-600">
            {isOwner ? (
              <>
                <span>Acting as</span>
                <select
                  value={actingId}
                  onChange={(e) => setActingPartyId(e.target.value)}
                  className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm font-medium text-stone-900 outline-none focus:border-emerald-500"
                >
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                      {p.id === viewerPartyId ? " (you)" : ""}
                    </option>
                  ))}
                </select>
                {isProxy && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    on their behalf
                  </span>
                )}
              </>
            ) : (
              <span>
                You&apos;re representing{" "}
                <span className="font-medium text-stone-900">{actingName}</span>
              </span>
            )}
          </div>
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
              onClick={() => setShowHistory((s) => !s)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 hover:border-stone-400"
            >
              {showHistory ? "Hide history" : "History"}
            </button>
            {isOwner && (
              <button
                onClick={() => setManaging((m) => !m)}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                {managing ? "Done" : "Manage parties"}
              </button>
            )}
            {isOwner &&
              (status === "In Progress" ? (
                <button
                  onClick={() => setSurveyOpen(true)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 hover:border-red-300 hover:text-red-600"
                >
                  End negotiation
                </button>
              ) : (
                <button
                  onClick={handleReopen}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 hover:border-stone-400"
                >
                  Reopen
                </button>
              ))}
          </div>
        </div>

        {status !== "In Progress" && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-100 px-4 py-2.5 text-sm text-stone-600">
            <span>
              This negotiation has ended —{" "}
              <span className="font-medium text-stone-800">{status}</span>.
              {isOwner && " Reopen it to make further changes."}
            </span>
            {!isOwner &&
              (myFeedbackDone ? (
                <span className="flex items-center gap-2 text-stone-500">
                  Thanks for your feedback ✓
                  <button
                    onClick={() => setSurveyOpen(true)}
                    className="font-medium text-emerald-700 hover:underline"
                  >
                    Edit
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setSurveyOpen(true)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Share your feedback →
                </button>
              ))}
          </div>
        )}

        {isOwner && managing && (
          <div className="mb-5">
            <PartyManager
              negotiationId={negotiationId}
              atLimit={atPartyLimit}
              maxParties={limits.maxParties}
              parties={parties.map((p) => ({
                id: p.id,
                displayName: p.displayName,
                role: p.role,
                pointBudget: p.pointBudget,
                inviteCode: p.inviteCode,
                claimed: p.claimed,
                isViewer: p.id === viewerPartyId,
              }))}
              onCreated={(p) => onPartyCreated({ ...p, interestsReady: false } as SharedParty)}
              onRenamed={onPartyRenamed}
              onBudget={onPartyBudget}
              onDeleted={onPartyDeleted}
            />
          </div>
        )}

        {showHistory && (
          <div className="mb-5">
            <ChangeLog
              negotiationId={negotiationId}
              partyId={actingId}
              partyName={actingName}
            />
          </div>
        )}

        {/* Top-level surfaces */}
        <div className="mb-5 flex flex-wrap gap-1 border-b border-stone-200">
          {showIntake && (
            <Tab active={topTab === "intake"} onClick={() => setTopTab("intake")}>
              Intake
            </Tab>
          )}
          <Tab active={topTab === "map"} onClick={() => setTopTab("map")}>
            Negotiation Map
          </Tab>
          <Tab active={topTab === "agreement"} onClick={() => setTopTab("agreement")}>
            The agreement
          </Tab>
        </div>

        {topTab === "intake" && showIntake && (
          <div className="mx-auto max-w-3xl">
            {/* Intake sub-steps */}
            <div className="mb-5 flex flex-wrap gap-1 border-b border-stone-100">
              <SubTab active={subPhase === "chat"} onClick={() => setSubPhase("chat")}>
                Meet the assistant
              </SubTab>
              <SubTab active={subPhase === "interests"} onClick={() => setSubPhase("interests")}>
                What matters
              </SubTab>
              <SubTab active={subPhase === "priorities"} onClick={() => setSubPhase("priorities")}>
                Priorities{!allReady && " 🔒"}
              </SubTab>
              <SubTab active={subPhase === "options"} onClick={() => setSubPhase("options")}>
                Ideas
              </SubTab>
              <SubTab active={subPhase === "scoring"} onClick={() => setSubPhase("scoring")}>
                Scoring{!allReady && " 🔒"}
              </SubTab>
            </div>

            {subPhase === "chat" && (
              <IntakeChat
                partyName={viewerName}
                opener={opener}
                messages={msgs[viewerPartyId] ?? []}
                streaming={streaming}
                onAdvance={() => setSubPhase("interests")}
                onSend={handleSend}
              />
            )}
            {subPhase === "interests" && (
              <InterestsPanel
                partyName={actingName}
                interests={myInterests}
                atNegotiationLimit={atInterestLimit}
                maxInterests={limits.maxInterests}
                addError={addError}
                suggestions={suggestionsByParty[actingId] ?? []}
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
                    [actingId]: (prev[actingId] ?? []).filter((s) => s !== text),
                  }));
                }}
                onClassify={handleClassify}
                onSubmit={handleSubmitInterests}
                onReopen={handleReopenInterests}
              />
            )}
            {subPhase === "priorities" &&
              (allReady ? (
                <PrioritiesPanel
                  partyName={actingName}
                  budget={actingBudget}
                  interests={priorityInterests}
                  myBadge={actingBadge}
                  onSavePoints={handleSavePoints}
                />
              ) : (
                <LockedStep parties={parties} readyByParty={readyByParty} me={actingId} meReady={submitted} onGoShare={() => setSubPhase("interests")} />
              ))}
            {subPhase === "options" && (
              <OptionsPanel
                options={options}
                atLimit={atOptionLimit}
                maxOptions={limits.maxOptions}
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
            {subPhase === "scoring" &&
              (allReady ? (
                <ScoringGrid
                  partyName={actingName}
                  interests={gridInterests}
                  options={activeOptions}
                  getScore={(optionId, interestId) => getScore(actingId, optionId, interestId)}
                  onSet={handleSetScore}
                />
              ) : (
                <LockedStep parties={parties} readyByParty={readyByParty} me={actingId} meReady={submitted} onGoShare={() => setSubPhase("interests")} />
              ))}
          </div>
        )}

        {topTab === "map" && (
          <MapWorkspace
            me={actingId}
            parties={parties}
            interests={mapInterests}
            options={sortedOptions}
            budget={actingBudget}
            spent={actingSpent}
            atInterestLimit={atInterestLimit}
            maxInterests={limits.maxInterests}
            atOptionLimit={atOptionLimit}
            maxOptions={limits.maxOptions}
            scoringLocked={scoringLocked}
            isOwner={isOwner}
            viewerPartyId={viewerPartyId}
            onSetActing={setActingPartyId}
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

        {topTab === "agreement" && (
          <div className="mx-auto max-w-3xl">
            <ScipabPanel
              scipab={scipab}
              drafting={draftingScipab}
              error={scipabError}
              hasOptions={options.length > 0}
              onDraft={handleDraftScipab}
            />
          </div>
        )}

        <p className="mt-4 text-center text-xs text-stone-400">
          {topTab === "map"
            ? isProxy
              ? `You're working on behalf of ${actingName}. Green cells are where they already agree with others.`
              : "Green cells are where you already agree."
            : topTab === "agreement"
              ? "Your living document of record — re-draft anytime as things change."
              : "Capture what matters, then head to the map."}
        </p>
      </div>

      {surveyOpen &&
        (isOwner ? (
          <FeedbackModal
            title="End negotiation"
            intro="Mark the outcome and share a little feedback. Your answers go to Xander to improve the app."
            submitLabel="End negotiation"
            askResolution
            initial={initialMyFeedback}
            onSubmit={handleEndSubmit}
            onClose={() => setSurveyOpen(false)}
          />
        ) : (
          <FeedbackModal
            title="Share your feedback"
            intro="This negotiation has ended. Share how it went and your thoughts on the app — your answers go to Xander."
            submitLabel="Submit feedback"
            askResolution={false}
            initial={initialMyFeedback}
            onSubmit={handleFeedbackSubmit}
            onClose={() => setSurveyOpen(false)}
          />
        ))}
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
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-emerald-600 text-stone-900"
          : "border-transparent text-stone-400 hover:text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

function SubTab({
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
      className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-stone-400 text-stone-800"
          : "border-transparent text-stone-400 hover:text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

/** Shown for the gated intake sub-steps until everyone has shared their interests. */
function LockedStep({
  parties,
  readyByParty,
  me,
  meReady,
  onGoShare,
}: {
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
        <span aria-hidden className="text-lg">🔒</span>
        <h2 className="text-lg font-medium text-stone-900">
          Opens once everyone has shared
        </h2>
      </div>
      {soloed ? (
        <p className="mt-2 text-sm text-stone-500">
          This opens once someone else joins and shares what matters to them.
        </p>
      ) : (
        <>
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
                Share interests →
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
