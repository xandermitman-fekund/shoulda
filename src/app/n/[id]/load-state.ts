import { prisma } from "@/lib/prisma";
import type { Scipab } from "./scipab-actions";

// The shareable, multi-user state of a workspace, shaped for the current viewer.
// Single source of truth for both the initial page load and the live-sync poll,
// so what you see on first load and what arrives via polling never drift apart.
export type SharedParty = {
  id: string;
  displayName: string;
  role: string;
  interestsReady: boolean;
  pointBudget: number;
  inviteCode: string;
  claimed: boolean; // a real user holds this seat
  isViewer: boolean; // this is the current viewer's own seat
};

export type SharedInterest = {
  id: string;
  text: string;
  mustHave: boolean;
  ownerPartyId: string;
  totalPoints: number;
  backerIds: string[];
  pointsByParty: Record<string, number>; // partyId -> points, so any acting party can be shown
};

export type SharedState = {
  label: string;
  description: string;
  status: string;
  isOwner: boolean; // viewer owns the workspace (the PM / nudger)
  viewerPartyId: string; // the viewer's own seat
  parties: SharedParty[];
  allInterests: SharedInterest[];
  options: {
    id: string;
    shortName: string;
    description: string;
    goState: "go" | "no_go" | null;
  }[];
  scores: {
    partyId: string;
    optionId: string;
    interestId: string;
    value: number | null;
    na: boolean;
  }[];
  scipab: Scipab | null;
};

export async function loadSharedState(
  negotiationId: string,
  userId: string,
): Promise<SharedState | null> {
  const negotiation = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    include: {
      parties: {
        orderBy: { orderIndex: "asc" },
        include: {
          interests: { orderBy: { createdAt: "asc" }, include: { points: true } },
        },
      },
      options: {
        orderBy: { createdAt: "asc" },
        include: { scores: true },
      },
    },
  });
  if (!negotiation) return null;

  const isOwner = negotiation.ownerUserId === userId;
  const me = negotiation.parties.find((p) => p.userId === userId);
  // Access: you must either own the workspace or hold a seat in it.
  if (!isOwner && !me) return null;
  // The owner always has their own auto-created seat; fall back to it defensively.
  const viewerParty = me ?? negotiation.parties.find((p) => p.userId === userId);
  if (!viewerParty) return null;

  const parties: SharedParty[] = negotiation.parties.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    role: p.role,
    interestsReady: p.interestsReady,
    pointBudget: p.pointBudget,
    inviteCode: p.inviteCode,
    claimed: p.userId !== null,
    isViewer: p.id === viewerParty.id,
  }));

  const allInterests: SharedInterest[] = negotiation.parties.flatMap((p) =>
    p.interests.map((i) => ({
      id: i.id,
      text: i.text,
      mustHave: i.mustHave,
      ownerPartyId: p.id,
      totalPoints: i.points.reduce((s, pt) => s + pt.points, 0),
      backerIds: i.points.filter((pt) => pt.points > 0).map((pt) => pt.partyId),
      pointsByParty: Object.fromEntries(
        i.points.map((pt) => [pt.partyId, pt.points]),
      ),
    })),
  );

  const options = negotiation.options.map((o) => ({
    id: o.id,
    shortName: o.shortName,
    description: o.description,
    goState: o.goState as "go" | "no_go" | null,
  }));

  const scores = negotiation.options.flatMap((o) =>
    o.scores.map((s) => ({
      partyId: s.partyId,
      optionId: o.id,
      interestId: s.interestId,
      value: s.value,
      na: s.na,
    })),
  );

  let scipab: Scipab | null = null;
  if (negotiation.scipab) {
    try {
      scipab = JSON.parse(negotiation.scipab) as Scipab;
    } catch {
      scipab = null;
    }
  }

  return {
    label: negotiation.label,
    description: negotiation.description,
    status: negotiation.status,
    isOwner,
    viewerPartyId: viewerParty.id,
    parties,
    allInterests,
    options,
    scores,
    scipab,
  };
}
