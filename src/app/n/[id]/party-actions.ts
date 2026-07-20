"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { getLimits } from "@/lib/limits";

/** Return the signed-in user IFF they own this workspace, else null. Owner-only gate. */
async function requireOwner(negotiationId: string) {
  const user = await getOrCreateUser();
  if (!user) return null;
  const neg = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    select: { ownerUserId: true },
  });
  if (!neg || neg.ownerUserId !== user.id) return null;
  return user;
}

const clampBudget = (n: number) => Math.max(0, Math.min(1000, Math.round(n)));

/** Create a new (proxy) party seat in the workspace. Owner only. */
export async function createParty(
  negotiationId: string,
  displayName: string,
  pointBudget = 10,
) {
  const owner = await requireOwner(negotiationId);
  if (!owner) return null;
  const name = displayName.trim().slice(0, 80);
  if (!name) return null;
  const count = await prisma.party.count({ where: { negotiationId } });
  const { maxParties } = await getLimits(negotiationId);
  if (count >= maxParties) return null; // limit backstop (UI also disables)
  const party = await prisma.party.create({
    data: {
      negotiationId,
      userId: null, // proxy seat until a real person claims it
      displayName: name,
      pointBudget: clampBudget(pointBudget),
      role: "participant",
      orderIndex: count,
    },
  });
  return {
    id: party.id,
    displayName: party.displayName,
    pointBudget: party.pointBudget,
    inviteCode: party.inviteCode,
    userId: party.userId,
    role: party.role,
  };
}

/** Rename a party. Owner only. */
export async function renameParty(partyId: string, displayName: string) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return null;
  const owner = await requireOwner(party.negotiationId);
  if (!owner) return null;
  const name = displayName.trim().slice(0, 80);
  if (!name) return null;
  await prisma.party.update({ where: { id: partyId }, data: { displayName: name } });
  return { id: partyId, displayName: name };
}

/** Set a party's interest-point budget. Owner only. Does NOT strip already-spent points. */
export async function setPointBudget(partyId: string, pointBudget: number) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return null;
  const owner = await requireOwner(party.negotiationId);
  if (!owner) return null;
  const budget = clampBudget(pointBudget);
  await prisma.party.update({ where: { id: partyId }, data: { pointBudget: budget } });
  return { id: partyId, pointBudget: budget };
}

/** Delete a party seat (and its data via cascade). Owner only; cannot delete the owner's own seat. */
export async function deleteParty(partyId: string) {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return null;
  const owner = await requireOwner(party.negotiationId);
  if (!owner) return null;
  if (party.userId === owner.id) return null; // never delete your own seat
  await prisma.party.delete({ where: { id: partyId } });
  return { id: partyId };
}
