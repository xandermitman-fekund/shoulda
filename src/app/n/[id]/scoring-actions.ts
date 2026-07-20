"use server";

import { prisma } from "@/lib/prisma";
import { resolveActingParty, recordAudit } from "@/lib/participant";

type ScoreInput =
  | { kind: "value"; value: number }
  | { kind: "na" }
  | { kind: "clear" };

/** Set (or clear) a party's score for one option against one interest. */
export async function setScore(
  negotiationId: string,
  optionId: string,
  interestId: string,
  state: ScoreInput,
  actingAsPartyId?: string,
) {
  const ctx = await resolveActingParty(negotiationId, actingAsPartyId);
  if (!ctx) return { ok: false };
  const partyId = ctx.party.id;

  if (state.kind === "clear") {
    await prisma.score.deleteMany({ where: { partyId, optionId, interestId } });
  } else {
    const data =
      state.kind === "na"
        ? { value: null, na: true }
        : { value: state.value, na: false };
    await prisma.score.upsert({
      where: { optionId_interestId_partyId: { optionId, interestId, partyId } },
      create: { partyId, optionId, interestId, ...data },
      update: data,
    });
  }
  await recordAudit({
    negotiationId,
    partyId,
    ctx,
    action: "score.set",
    detail:
      state.kind === "clear"
        ? "Cleared a score"
        : state.kind === "na"
          ? "Scored an option n/a"
          : `Scored an option ${state.value}%`,
  });
  return { ok: true };
}
