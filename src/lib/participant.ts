import type { Party } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { getOrCreateUser } from "./user";

/**
 * Resolve the signed-in user's own Party within a negotiation — or null if they're
 * not signed in / not a participant. This is the trust boundary: server actions
 * derive the caller's party from their auth session, never from client input.
 */
export async function requireParty(negotiationId: string) {
  const user = await getOrCreateUser();
  if (!user) return null;
  return prisma.party.findFirst({
    where: { negotiationId, userId: user.id },
  });
}

export type ActingContext = {
  party: Party;
  actorUserId: string;
  actorLabel: string;
  isProxy: boolean; // true = the owner acting on another party's behalf
};

/**
 * Resolve which Party the caller is acting as for a mutation.
 *
 * - The workspace **owner** may act as ANY party in the workspace (proxy): pass the
 *   target party's id as `actingAsPartyId`.
 * - Anyone else is locked to their own claimed seat (derived from auth), regardless
 *   of `actingAsPartyId`.
 *
 * Returns null if not signed in, not authorized, or the target party doesn't exist.
 */
export async function resolveActingParty(
  negotiationId: string,
  actingAsPartyId?: string,
): Promise<ActingContext | null> {
  const user = await getOrCreateUser();
  if (!user) return null;

  const negotiation = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    select: { ownerUserId: true },
  });
  if (!negotiation) return null;
  const isOwner = negotiation.ownerUserId === user.id;

  // Owner acting as a specific party (proxy path).
  if (isOwner && actingAsPartyId) {
    const target = await prisma.party.findFirst({
      where: { id: actingAsPartyId, negotiationId },
    });
    if (!target) return null;
    return {
      party: target,
      actorUserId: user.id,
      actorLabel: user.displayName,
      isProxy: target.userId !== user.id,
    };
  }

  // Otherwise: act as your own claimed seat.
  const own = await prisma.party.findFirst({
    where: { negotiationId, userId: user.id },
  });
  if (!own) return null;
  return {
    party: own,
    actorUserId: user.id,
    actorLabel: user.displayName,
    isProxy: false,
  };
}

/** Append a change-log entry. Best-effort — never throws into the caller. */
export async function recordAudit(opts: {
  negotiationId: string;
  partyId: string;
  ctx: ActingContext;
  action: string;
  detail?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        negotiationId: opts.negotiationId,
        partyId: opts.partyId,
        actorUserId: opts.ctx.actorUserId,
        actorLabel: opts.ctx.actorLabel,
        isProxy: opts.ctx.isProxy,
        action: opts.action,
        detail: opts.detail,
      },
    });
  } catch {
    // A logging failure must not break the underlying mutation.
  }
}
