"use server";

import { prisma } from "@/lib/prisma";

type ScoreInput =
  | { kind: "value"; value: number }
  | { kind: "na" }
  | { kind: "clear" };

/** Set (or clear) one party's score for one option against one interest. */
export async function setScore(
  partyId: string,
  optionId: string,
  interestId: string,
  state: ScoreInput,
) {
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
