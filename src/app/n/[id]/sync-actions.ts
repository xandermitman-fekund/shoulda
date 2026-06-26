"use server";

import { requireParty } from "@/lib/participant";
import { loadSharedState, type SharedState } from "./load-state";

/** Re-fetch the shared negotiation state for live sync. Returns null if not a participant. */
export async function pollState(
  negotiationId: string,
): Promise<SharedState | null> {
  const party = await requireParty(negotiationId);
  if (!party) return null;
  return loadSharedState(negotiationId, party.userId);
}
