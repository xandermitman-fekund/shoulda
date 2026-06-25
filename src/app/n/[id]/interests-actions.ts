"use server";

import { prisma } from "@/lib/prisma";
import { requireParty } from "@/lib/participant";
import { consumeAiCredit } from "@/lib/ai-usage";
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

export async function createInterest(negotiationId: string, text: string) {
  const t = text.trim();
  if (!t) return null;
  const party = await requireParty(negotiationId);
  if (!party) return null;
  const interest = await prisma.interest.create({
    data: { negotiationId, ownerPartyId: party.id, text: t },
  });
  return { id: interest.id, text: interest.text };
}

export async function updateInterest(interestId: string, text: string) {
  const t = text.trim();
  if (!t) return null;
  const interest = await prisma.interest.findUnique({ where: { id: interestId } });
  if (!interest) return null;
  const party = await requireParty(interest.negotiationId);
  if (!party || interest.ownerPartyId !== party.id) return null; // only your own
  await prisma.interest.update({ where: { id: interestId }, data: { text: t } });
  return { id: interestId, text: t };
}

export async function deleteInterest(interestId: string) {
  const interest = await prisma.interest.findUnique({ where: { id: interestId } });
  if (!interest) return null;
  const party = await requireParty(interest.negotiationId);
  if (!party || interest.ownerPartyId !== party.id) return null; // only your own
  await prisma.interest.delete({ where: { id: interestId } });
  return { id: interestId };
}

/** Toggle a "must-have" on the caller's interest. Must-haves don't compete for points, so clear any. */
export async function setMustHave(interestId: string, mustHave: boolean) {
  const interest = await prisma.interest.findUnique({ where: { id: interestId } });
  if (!interest) return null;
  const party = await requireParty(interest.negotiationId);
  if (!party || interest.ownerPartyId !== party.id) return null; // only your own
  await prisma.interest.update({ where: { id: interestId }, data: { mustHave } });
  if (mustHave) {
    await prisma.interestPoint.deleteMany({ where: { interestId } });
  }
  return { id: interestId, mustHave };
}

/** Mark the caller's interests as shared with the group. Gates the shared steps until everyone has shared. */
export async function submitInterests(negotiationId: string) {
  const party = await requireParty(negotiationId);
  if (!party) return { ok: false as const };
  await prisma.party.update({
    where: { id: party.id },
    data: { interestsReady: true },
  });
  return { ok: true as const };
}

/** Re-open the caller's interests for editing (un-share). */
export async function reopenInterests(negotiationId: string) {
  const party = await requireParty(negotiationId);
  if (!party) return { ok: false as const };
  await prisma.party.update({
    where: { id: party.id },
    data: { interestsReady: false },
  });
  return { ok: true as const };
}

/** Save the caller's 10-point allocation across *everyone's* interests (their own + the others'). */
export async function saveInterestPoints(
  negotiationId: string,
  allocations: { interestId: string; points: number }[],
) {
  const party = await requireParty(negotiationId);
  if (!party) return { ok: false as const, error: "You're not a participant." };

  const sum = allocations.reduce((s, a) => s + a.points, 0);
  if (sum !== 10) {
    return { ok: false as const, error: "Points must add up to exactly 10." };
  }
  if (allocations.some((a) => a.points < 0 || a.points > 10)) {
    return { ok: false as const, error: "Each interest can have 0–10 points." };
  }
  for (const a of allocations) {
    await prisma.interestPoint.upsert({
      where: { interestId_partyId: { interestId: a.interestId, partyId: party.id } },
      create: { interestId: a.interestId, partyId: party.id, points: a.points },
      update: { points: a.points },
    });
  }
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
  if (!base) return [];
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

    if (party) {
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
