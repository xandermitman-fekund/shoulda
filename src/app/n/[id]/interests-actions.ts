"use server";

import { prisma } from "@/lib/prisma";
import { requireParty, resolveActingParty, recordAudit } from "@/lib/participant";
import { consumeAiCredit } from "@/lib/ai-usage";
import { getLimits } from "@/lib/limits";
import { anthropic, MEDIATOR_MODEL } from "@/lib/anthropic";
import { recordAiCost } from "@/lib/ai-cost";
import {
  suggestInterestsSystemPrompt,
  classifyInterestSystemPrompt,
} from "@/lib/mediator";

// messages.create() returns a Stream | Message union; for non-streaming calls we
// read the text block (and usage, for cost tracking) off the result via this shape.
type TextResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};
function firstText(res: TextResponse): string {
  return res.content?.find((b) => b.type === "text")?.text ?? "";
}

export async function createInterest(
  negotiationId: string,
  text: string,
  actingAsPartyId?: string,
) {
  const t = text.trim();
  if (!t) return null;
  const ctx = await resolveActingParty(negotiationId, actingAsPartyId);
  if (!ctx) return null;
  const count = await prisma.interest.count({ where: { negotiationId } });
  const { maxInterests } = await getLimits(negotiationId);
  if (count >= maxInterests) return null; // limit backstop (UI also disables)
  const interest = await prisma.interest.create({
    data: { negotiationId, ownerPartyId: ctx.party.id, text: t },
  });
  await recordAudit({
    negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "interest.create",
    detail: `Added interest "${t.slice(0, 60)}"`,
  });
  return { id: interest.id, text: interest.text };
}

export async function updateInterest(
  interestId: string,
  text: string,
  actingAsPartyId?: string,
) {
  const t = text.trim();
  if (!t) return null;
  const interest = await prisma.interest.findUnique({ where: { id: interestId } });
  if (!interest) return null;
  const ctx = await resolveActingParty(interest.negotiationId, actingAsPartyId);
  if (!ctx || interest.ownerPartyId !== ctx.party.id) return null; // only the owning party's
  await prisma.interest.update({ where: { id: interestId }, data: { text: t } });
  await recordAudit({
    negotiationId: interest.negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "interest.update",
    detail: `Edited interest to "${t.slice(0, 60)}"`,
  });
  return { id: interestId, text: t };
}

export async function deleteInterest(
  interestId: string,
  actingAsPartyId?: string,
) {
  const interest = await prisma.interest.findUnique({ where: { id: interestId } });
  if (!interest) return null;
  const ctx = await resolveActingParty(interest.negotiationId, actingAsPartyId);
  if (!ctx || interest.ownerPartyId !== ctx.party.id) return null; // only the owning party's
  await prisma.interest.delete({ where: { id: interestId } });
  await recordAudit({
    negotiationId: interest.negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "interest.delete",
    detail: `Removed interest "${interest.text.slice(0, 60)}"`,
  });
  return { id: interestId };
}

/** Toggle a "must-have" on a party's interest. Must-haves don't compete for points, so clear any. */
export async function setMustHave(
  interestId: string,
  mustHave: boolean,
  actingAsPartyId?: string,
) {
  const interest = await prisma.interest.findUnique({ where: { id: interestId } });
  if (!interest) return null;
  const ctx = await resolveActingParty(interest.negotiationId, actingAsPartyId);
  if (!ctx || interest.ownerPartyId !== ctx.party.id) return null; // only the owning party's
  await prisma.interest.update({ where: { id: interestId }, data: { mustHave } });
  if (mustHave) {
    await prisma.interestPoint.deleteMany({ where: { interestId } });
  }
  await recordAudit({
    negotiationId: interest.negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "interest.mustHave",
    detail: `${mustHave ? "Marked" : "Unmarked"} "${interest.text.slice(0, 50)}" as must-have`,
  });
  return { id: interestId, mustHave };
}

/** Mark a party's interests as shared with the group. Gates the shared steps until everyone has shared. */
export async function submitInterests(
  negotiationId: string,
  actingAsPartyId?: string,
) {
  const ctx = await resolveActingParty(negotiationId, actingAsPartyId);
  if (!ctx) return { ok: false as const };
  await prisma.party.update({
    where: { id: ctx.party.id },
    data: { interestsReady: true },
  });
  await recordAudit({
    negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "interests.submit",
    detail: "Shared interests with the group",
  });
  return { ok: true as const };
}

/** Re-open a party's interests for editing (un-share). */
export async function reopenInterests(
  negotiationId: string,
  actingAsPartyId?: string,
) {
  const ctx = await resolveActingParty(negotiationId, actingAsPartyId);
  if (!ctx) return { ok: false as const };
  await prisma.party.update({
    where: { id: ctx.party.id },
    data: { interestsReady: false },
  });
  await recordAudit({
    negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "interests.reopen",
    detail: "Re-opened interests for editing",
  });
  return { ok: true as const };
}

/** Save a party's point allocation across *everyone's* interests, capped at that party's budget. */
export async function saveInterestPoints(
  negotiationId: string,
  allocations: { interestId: string; points: number }[],
  actingAsPartyId?: string,
) {
  const ctx = await resolveActingParty(negotiationId, actingAsPartyId);
  if (!ctx) return { ok: false as const, error: "You're not a participant." };
  const budget = ctx.party.pointBudget;

  const sum = allocations.reduce((s, a) => s + a.points, 0);
  if (sum > budget) {
    return {
      ok: false as const,
      error: `Points can add up to at most ${budget}.`,
    };
  }
  if (allocations.some((a) => a.points < 0 || a.points > budget)) {
    return { ok: false as const, error: `Each interest can have 0–${budget} points.` };
  }
  for (const a of allocations) {
    await prisma.interestPoint.upsert({
      where: {
        interestId_partyId: { interestId: a.interestId, partyId: ctx.party.id },
      },
      create: { interestId: a.interestId, partyId: ctx.party.id, points: a.points },
      update: { points: a.points },
    });
  }
  await recordAudit({
    negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "points.save",
    detail: `Saved priorities (${sum}/${budget} points)`,
  });
  return { ok: true as const };
}

const INTEREST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    interests: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
  },
  required: ["interests"],
} as const;

/** Ask the AI Mediator to propose the caller's interests from their intake chat. */
export async function suggestInterests(negotiationId: string): Promise<string[]> {
  const base = await requireParty(negotiationId);
  if (!base || !base.userId) return [];
  if (!(await consumeAiCredit(base.userId))) return [];
  const party = await prisma.party.findUnique({
    where: { id: base.id },
    include: {
      negotiation: true,
      intakeMessages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!party) return [];

  const convo = party.intakeMessages
    .map(
      (m) =>
        `${m.role === "assistant" ? "Mediator" : party.displayName}: ${m.content}`,
    )
    .join("\n");

  const response = (await anthropic.messages.create({
    model: MEDIATOR_MODEL,
    max_tokens: 1024,
    system: suggestInterestsSystemPrompt(party.displayName),
    messages: [
      {
        role: "user",
        content: `Case: "${party.negotiation.label}"\n\nIntake conversation so far:\n${
          convo || "(no conversation yet)"
        }\n\nPropose ${party.displayName}'s interests.`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: INTEREST_SCHEMA } },
  } as Parameters<typeof anthropic.messages.create>[0])) as unknown as TextResponse;

  await recordAiCost({
    negotiationId,
    userId: base.userId,
    kind: "suggest_interests",
    model: MEDIATOR_MODEL,
    usage: response.usage,
  });

  try {
    const parsed = JSON.parse(firstText(response)) as {
      interests?: { text: string }[];
    };
    return (parsed.interests ?? []).map((i) => i.text).filter(Boolean);
  } catch {
    return [];
  }
}

const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    classification: { type: "string", enum: ["interest", "option", "unclear"] },
    message: { type: "string" },
    suggestedInterest: { type: "string" },
  },
  required: ["classification", "message", "suggestedInterest"],
} as const;

export type InterestClassification = {
  classification: "interest" | "option" | "unclear";
  message: string;
  suggestedInterest: string;
};

/**
 * Classify a typed statement as a genuine interest vs. a position/option, and
 * (if needed) coach the user toward the underlying interest. Fails open.
 */
export async function classifyInterest(
  negotiationId: string,
  text: string,
): Promise<InterestClassification> {
  const fallback: InterestClassification = {
    classification: "interest",
    message: "",
    suggestedInterest: "",
  };
  const t = text.trim();
  if (!t) return fallback;

  const party = await requireParty(negotiationId);
  const name = party?.displayName ?? "this person";

  try {
    const response = (await anthropic.messages.create({
      model: MEDIATOR_MODEL,
      max_tokens: 512,
      system: classifyInterestSystemPrompt(name),
      messages: [{ role: "user", content: `Statement: "${t}"` }],
      output_config: { format: { type: "json_schema", schema: CLASSIFY_SCHEMA } },
    } as Parameters<typeof anthropic.messages.create>[0])) as unknown as TextResponse;

    if (party?.userId) {
      await recordAiCost({
        negotiationId,
        userId: party.userId,
        kind: "classify",
        model: MEDIATOR_MODEL,
        usage: response.usage,
      });
    }

    const parsed = JSON.parse(firstText(response));
    if (
      parsed.classification === "interest" ||
      parsed.classification === "option" ||
      parsed.classification === "unclear"
    ) {
      return {
        classification: parsed.classification,
        message: String(parsed.message ?? ""),
        suggestedInterest: String(parsed.suggestedInterest ?? ""),
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}
