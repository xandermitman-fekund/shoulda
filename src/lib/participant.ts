import { prisma } from "./prisma";
import { getOrCreateUser } from "./user";

/**
 * Resolve the signed-in user's Party within a negotiation — or null if they're
 * not signed in / not a participant. This is the trust boundary: server actions
 * derive the caller's party from their auth session, never from client input.
 */
export async function requireParty(negotiationId: string) {
  const user = await getOrCreateUser();
  if (!user) return null;
  return prisma.party.findUnique({
    where: { negotiationId_userId: { negotiationId, userId: user.id } },
  });
}
