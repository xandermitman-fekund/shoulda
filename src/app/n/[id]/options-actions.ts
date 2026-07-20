"use server";

import { prisma } from "@/lib/prisma";
import { requireParty, resolveActingParty, recordAudit } from "@/lib/participant";
import { consumeAiCredit } from "@/lib/ai-usage";
import { anthropic, MEDIATOR_MODEL } from "@/lib/anthropic";
import { recordAiCost } from "@/lib/ai-cost";
import { suggestOptionsSystemPrompt } from "@/lib/mediator";

type TextResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};
function firstText(res: TextResponse): string {
  return res.content?.find((b) => b.type === "text")?.text ?? "";
}

/** Add a shared idea to the board. Ideas are shared (no per-party authorship); the actor is audited. */
export async function createOption(
  negotiationId: string,
  shortName: string,
  description: string,
  actingAsPartyId?: string,
) {
  const ctx = await resolveActingParty(negotiationId, actingAsPartyId);
  if (!ctx) return null;
  const sn = shortName.trim().slice(0, 100);
  if (!sn) return null;
  const option = await prisma.option.create({
    data: {
      negotiationId,
      shortName: sn,
      description: description.trim().slice(0, 4000),
      source: "party",
    },
  });
  await recordAudit({
    negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "option.create",
    detail: `Added idea "${sn}"`,
  });
  return {
    id: option.id,
    shortName: option.shortName,
    description: option.description,
  };
}

/** Edit a shared idea's name/description. Any participant may; the actor is audited. */
export async function updateOption(
  optionId: string,
  shortName: string,
  description: string,
  actingAsPartyId?: string,
) {
  const option = await prisma.option.findUnique({ where: { id: optionId } });
  if (!option) return null;
  const ctx = await resolveActingParty(option.negotiationId, actingAsPartyId);
  if (!ctx) return null;
  const sn = shortName.trim().slice(0, 100);
  if (!sn) return null;
  const desc = description.trim().slice(0, 4000);
  await prisma.option.update({
    where: { id: optionId },
    data: { shortName: sn, description: desc },
  });
  await recordAudit({
    negotiationId: option.negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "option.update",
    detail: `Edited idea "${sn}"`,
  });
  return { id: optionId, shortName: sn, description: desc };
}

/** Remove a shared idea. Any participant may; the actor is audited. */
export async function deleteOption(optionId: string, actingAsPartyId?: string) {
  const option = await prisma.option.findUnique({ where: { id: optionId } });
  if (!option) return null;
  const ctx = await resolveActingParty(option.negotiationId, actingAsPartyId);
  if (!ctx) return null;
  await prisma.option.delete({ where: { id: optionId } });
  await recordAudit({
    negotiationId: option.negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "option.delete",
    detail: `Removed idea "${option.shortName}"`,
  });
  return { id: optionId };
}

/** Set an idea's shared go/no-go state. Any participant may; last write wins; the actor is audited. */
export async function setGoState(
  optionId: string,
  goState: "go" | "no_go" | null,
  actingAsPartyId?: string,
) {
  const option = await prisma.option.findUnique({ where: { id: optionId } });
  if (!option) return null;
  const ctx = await resolveActingParty(option.negotiationId, actingAsPartyId);
  if (!ctx) return null;
  await prisma.option.update({ where: { id: optionId }, data: { goState } });
  await recordAudit({
    negotiationId: option.negotiationId,
    partyId: ctx.party.id,
    ctx,
    action: "option.goState",
    detail: `Set "${option.shortName}" to ${goState ?? "undecided"}`,
  });
  return { id: optionId, goState };
}

const OPTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          shortName: { type: "string" },
          description: { type: "string" },
        },
        required: ["shortName", "description"],
      },
    },
  },
  required: ["options"],
} as const;

/** Ask the AI Mediator to invent new options for mutual gain. */
export async function suggestOptions(
  negotiationId: string,
): Promise<{ shortName: string; description: string }[]> {
  const party = await requireParty(negotiationId);
  if (!party || !party.userId) return [];
  if (!(await consumeAiCredit(party.userId))) return [];

  const neg = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    include: { interests: true, options: true },
  });
  if (!neg) return [];

  const interestsText =
    neg.interests.map((i) => `- ${i.text}`).join("\n") || "(none shared yet)";
  const existing =
    neg.options.map((o) => `- ${o.shortName}`).join("\n") || "(none yet)";

  const response = (await anthropic.messages.create({
    model: MEDIATOR_MODEL,
    max_tokens: 1024,
    system: suggestOptionsSystemPrompt(),
    messages: [
      {
        role: "user",
        content: `Problem: "${neg.label}"${
          neg.description ? `\nDetails: ${neg.description}` : ""
        }\n\nInterests people have shared:\n${interestsText}\n\nOptions already on the table:\n${existing}\n\nPropose new options.`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: OPTIONS_SCHEMA } },
  } as Parameters<typeof anthropic.messages.create>[0])) as unknown as TextResponse;

  await recordAiCost({
    negotiationId,
    userId: party.userId,
    kind: "suggest_options",
    model: MEDIATOR_MODEL,
    usage: response.usage,
  });

  try {
    const parsed = JSON.parse(firstText(response)) as {
      options?: { shortName: string; description: string }[];
    };
    return (parsed.options ?? []).filter((o) => o.shortName);
  } catch {
    return [];
  }
}
