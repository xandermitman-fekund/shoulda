"use server";

import { prisma } from "@/lib/prisma";
import { requireParty } from "@/lib/participant";

type ScoreInput =
  | { kind: "value"; value: number }
  | { kind: "na" }
  | { kind: "clear" };

/** Set (or clear) the caller's own score for one option against one interest. */
export async function setScore(
  negotiationId: string,
  optionId: string,
  interestId: string,
  state: ScoreInput,
) {
  const party = await requireParty(negotiationId);
  if (!party) return { ok: false };
  const partyId = party.id;

  if (state.kind === "clear") {
    await prisma.score.deleteMany({ where: { partyId, optionId, interestId } });
    return { ok: true };
  }
  const data =
    state.kind === "na"
      ? { value: null, na: true }
      : { value: state.value, na: false };

  await prisma.score.upsert({
    where: {
      optionId_interestId_partyId: { optionId, interestId, partyId },
    },
    create: { partyId, optionId, interestId, ...data },
    update: data,
  });
  return { ok: true };
}
