"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { resolveActingParty } from "@/lib/participant";

export const RESOLUTION_TYPES = [
  "Agreement reached successfully",
  "Agreement reached but not every party was satisfied",
  "Negotiation canceled / abandoned / deprioritized",
  "Other",
] as const;

export const HELPED_SCALE = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
] as const;

export type FeedbackInput = {
  resolutionType: string;
  helped: string;
  favorite: string;
  change: string;
  other: string;
};

/** Coarse negotiation status derived from the chosen resolution type. */
function statusFor(resolutionType: string): string {
  if (resolutionType.startsWith("Agreement reached")) return "Resolved";
  if (resolutionType.startsWith("Negotiation canceled")) return "Abandoned";
  return "Ended";
}

function feedbackData(input: FeedbackInput) {
  return {
    resolutionType: input.resolutionType || null,
    helped: input.helped || null,
    favorite: input.favorite?.slice(0, 4000) || null,
    change: input.change?.slice(0, 4000) || null,
    other: input.other?.slice(0, 4000) || null,
  };
}

/** End the negotiation (Guide only): set the official outcome + status, and record the Guide's survey. */
export async function endNegotiation(
  negotiationId: string,
  input: FeedbackInput,
): Promise<{ ok: true; status: string } | { ok: false }> {
  const user = await getOrCreateUser();
  if (!user) return { ok: false };
  const neg = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    select: { ownerUserId: true },
  });
  if (!neg || neg.ownerUserId !== user.id) return { ok: false };

  const resolutionType = String(input.resolutionType || "Other");
  const status = statusFor(resolutionType);
  await prisma.negotiation.update({
    where: { id: negotiationId },
    data: { status, endedAt: new Date(), resolutionType },
  });

  // Store the Guide's own survey like any party's.
  const guideParty = await prisma.party.findFirst({
    where: { negotiationId, userId: user.id },
    select: { id: true },
  });
  if (guideParty) {
    const data = feedbackData(input);
    await prisma.feedback.upsert({
      where: { negotiationId_partyId: { negotiationId, partyId: guideParty.id } },
      create: { negotiationId, partyId: guideParty.id, ...data },
      update: data,
    });
  }
  return { ok: true, status };
}

/** Record (or update) the acting party's end-of-negotiation survey. Does not change status. */
export async function submitFeedback(
  negotiationId: string,
  input: FeedbackInput,
  actingAsPartyId?: string,
): Promise<{ ok: boolean }> {
  const ctx = await resolveActingParty(negotiationId, actingAsPartyId);
  if (!ctx) return { ok: false };
  const data = feedbackData(input);
  await prisma.feedback.upsert({
    where: { negotiationId_partyId: { negotiationId, partyId: ctx.party.id } },
    create: { negotiationId, partyId: ctx.party.id, ...data },
    update: data,
  });
  return { ok: true };
}

/** Reopen an ended negotiation (back to In Progress). Owner (Guide) only. */
export async function reopenNegotiation(
  negotiationId: string,
): Promise<{ ok: boolean }> {
  const user = await getOrCreateUser();
  if (!user) return { ok: false };
  const neg = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    select: { ownerUserId: true },
  });
  if (!neg || neg.ownerUserId !== user.id) return { ok: false };
  await prisma.negotiation.update({
    where: { id: negotiationId },
    data: { status: "In Progress", endedAt: null },
  });
  return { ok: true };
}
