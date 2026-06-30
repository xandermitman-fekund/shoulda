import { prisma } from "@/lib/prisma";
import type { Scipab } from "./scipab-actions";

// The shareable, multi-user state of a negotiation, shaped for the current viewer.
// Single source of truth for both the initial page load and the live-sync poll,
// so what you see on first load and what arrives via polling never drift apart.
export type SharedState = {
  label: string;
  description: string;
  status: string;
  inviteCode: string;
  currentPartyId: string;
  parties: {
    id: string;
    displayName: string;
    role: string;
    interestsReady: boolean;
  }[];
  allInterests: {
    id: string;
    text: string;
    mustHave: boolean;
    ownerPartyId: string;
    myPoints: number;
    totalPoints: number;
    backerIds: string[];
  }[];
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
  const me = negotiation.parties.find((p) => p.userId === userId);
  if (!me) return null;

  const parties = negotiation.parties.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    role: p.role,
    interestsReady: p.interestsReady,
  }));

  const allInterests = negotiation.parties.flatMap((p) =>
    p.interests.map((i) => ({
      id: i.id,
      text: i.text,
      mustHave: i.mustHave,
      ownerPartyId: p.id,
      myPoints: i.points.find((pt) => pt.partyId === me.id)?.points ?? 0,
      totalPoints: i.points.reduce((s, pt) => s + pt.points, 0),
      backerIds: i.points.filter((pt) => pt.points > 0).map((pt) => pt.partyId),
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
    inviteCode: negotiation.inviteCode,
    currentPartyId: me.id,
    parties,
    allInterests,
    options,
    scores,
    scipab,
  };
}
