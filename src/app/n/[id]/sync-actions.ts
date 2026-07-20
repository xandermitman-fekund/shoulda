"use server";

import { getOrCreateUser } from "@/lib/user";
import { loadSharedState, type SharedState } from "./load-state";

/** Re-fetch the shared workspace state for live sync. Returns null if not signed in / no access. */
export async function pollState(
  negotiationId: string,
): Promise<SharedState | null> {
  const user = await getOrCreateUser();
  if (!user) return null;
  return loadSharedState(negotiationId, user.id);
}
