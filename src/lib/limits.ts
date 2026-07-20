import { prisma } from "./prisma";

export type Limits = {
  maxParties: number;
  maxOptions: number;
  maxInterests: number;
};

// Free-tier defaults — intentionally limited. Raise per-customer via their
// allowlist entry to unblock a specific pilot user.
export const DEFAULT_LIMITS: Limits = {
  maxParties: 5,
  maxOptions: 7,
  maxInterests: 7,
};

/**
 * Limits for a negotiation = the caps configured for its OWNER (the pilot user /
 * "customer"), looked up by their allowlist entry. Owners with no allowlist entry
 * (e.g. admins) get the free-tier defaults.
 */
export async function getLimits(negotiationId: string): Promise<Limits> {
  const negotiation = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    select: { owner: { select: { email: true } } },
  });
  const email = negotiation?.owner?.email?.toLowerCase();
  if (!email) return DEFAULT_LIMITS;

  const entry = await prisma.allowlist.findUnique({ where: { email } });
  if (!entry) return DEFAULT_LIMITS;
  return {
    maxParties: entry.maxParties,
    maxOptions: entry.maxOptions,
    maxInterests: entry.maxInterests,
  };
}
