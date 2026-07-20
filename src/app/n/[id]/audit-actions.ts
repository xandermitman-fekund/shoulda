"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";

export type ChangeLogEntry = {
  id: string;
  actorLabel: string;
  isProxy: boolean;
  action: string;
  detail: string | null;
  createdAt: string;
};

/**
 * Change log for one [workspace × party]. The workspace owner may read any party's
 * log; a claimed party may read their own. This is the transparency record so a
 * party can see exactly what was entered for them and by whom.
 */
export async function getChangeLog(
  negotiationId: string,
  partyId: string,
): Promise<ChangeLogEntry[]> {
  const user = await getOrCreateUser();
  if (!user) return [];

  const [negotiation, party] = await Promise.all([
    prisma.negotiation.findUnique({
      where: { id: negotiationId },
      select: { ownerUserId: true },
    }),
    prisma.party.findFirst({ where: { id: partyId, negotiationId } }),
  ]);
  if (!negotiation || !party) return [];

  const isOwner = negotiation.ownerUserId === user.id;
  const isOwnSeat = party.userId === user.id;
  if (!isOwner && !isOwnSeat) return [];

  const rows = await prisma.auditLog.findMany({
    where: { negotiationId, partyId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    actorLabel: r.actorLabel,
    isProxy: r.isProxy,
    action: r.action,
    detail: r.detail,
    createdAt: r.createdAt.toISOString(),
  }));
}
