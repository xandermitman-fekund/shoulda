"use server";

import { prisma } from "@/lib/prisma";
import { anthropic, MEDIATOR_MODEL } from "@/lib/anthropic";
import {
  suggestInterestsSystemPrompt,
  classifyInterestSystemPrompt,
} from "@/lib/mediator";

export async function createInterest(partyId: string, text: string) {
  const t = text.trim();
  if (!t) return null;
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return null;
  const interest = await prisma.interest.create({
    data: { negotiationId: party.negotiationId, ownerPartyId: partyId, text: t },
  });
  return { id: interest.id, text: interest.text };
}

export async function updateInterest(id: string, text: string) {
  const t = text.trim();
  if (!t) return null;
  await prisma.interest.update({ where: { id }, data: { text: t } });
  return { id, text: t };
}

export async function deleteInterest(id: string) {
  await prisma.interest.delete({ where: { id } });
  return { id };
}

/** Save a party's 10-point allocation across their own interests. */
export async function saveInterestPoints(
  partyId: string,
  allocations: { interestId: string; points: number }[],
) {
  const sum = allocations.reduce((s, a) => s + a.points, 0);
  if (sum !== 10) {
    return { ok: false as const, error: "Points must add up to exactly 10." };
  }
  if (allocations.some((a) => a.points < 0 || a.points > 10)) {
    return { ok: false as const, error: "Each interest can have 0–10 points." };
  }
  for (const a of allocations) {
    await prisma.interestPoint.upsert({
      where: { interestId_partyId: { interestId: a.interestId, partyId } },
      create: { interestId: a.interestId, partyId, points: a.points },
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

/** Ask the AI Mediator to propose interests from the intake conversation. */
export async function suggestInterests(partyId: string): Promise<string[]> {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
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

  const response = await anthropic.messages.create({
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
  } as Parameters<typeof anthropic.messages.create>[0]);

  const block = Array.isArray(response.content)
    ? response.content.find((b) => b.type === "text")
    : null;
  const raw = block && "text" in block ? block.text : "";
  try {
    const parsed = JSON.parse(raw) as { interests?: { text: string }[] };
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
 * (if needed) coach the user toward the underlying interest. Fails open — if
 * anything goes wrong it returns "interest" so the user is never blocked.
 */
export async function classifyInterest(
  partyId: string,
  text: string,
): Promise<InterestClassification> {
  const fallback: InterestClassification = {
    classification: "interest",
    message: "",
    suggestedInterest: "",
  };
  const t = text.trim();
  if (!t) return fallback;

  const party = await prisma.party.findUnique({ where: { id: partyId } });
  const name = party?.displayName ?? "this person";

  try {
    const response = await anthropic.messages.create({
      model: MEDIATOR_MODEL,
      max_tokens: 512,
      system: classifyInterestSystemPrompt(name),
      messages: [{ role: "user", content: `Statement: "${t}"` }],
      output_config: { format: { type: "json_schema", schema: CLASSIFY_SCHEMA } },
    } as Parameters<typeof anthropic.messages.create>[0]);

    const block = Array.isArray(response.content)
      ? response.content.find((b) => b.type === "text")
      : null;
    const raw = block && "text" in block ? block.text : "";
    const parsed = JSON.parse(raw);
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
