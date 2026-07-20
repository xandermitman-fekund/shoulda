"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";

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

export type Closure = {
  resolutionType: string;
  fbHelped: string;
  fbFavorite: string;
  fbChange: string;
  fbOther: string;
};

/** Coarse status derived from the chosen resolution type. */
function statusFor(resolutionType: string): string {
  if (resolutionType.startsWith("Agreement reached")) return "Resolved";
  if (resolutionType.startsWith("Negotiation canceled")) return "Abandoned";
  return "Ended";
}

/** End the negotiation and record the Guide's exit survey. Owner (Guide) only. */
export async function endNegotiation(
  negotiationId: string,
  input: Closure,
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
    data: {
      status,
      endedAt: new Date(),
      resolutionType,
      fbHelped: input.fbHelped || null,
      fbFavorite: input.fbFavorite?.slice(0, 4000) || null,
      fbChange: input.fbChange?.slice(0, 4000) || null,
      fbOther: input.fbOther?.slice(0, 4000) || null,
    },
  });
  return { ok: true, status };
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
