"use server";

import { prisma } from "@/lib/prisma";
import { anthropic, MEDIATOR_MODEL } from "@/lib/anthropic";
import { suggestOptionsSystemPrompt } from "@/lib/mediator";

/** Add a shared option to the board. Authorship is intentionally NOT recorded. */
export async function createOption(
  negotiationId: string,
  shortName: string,
  description: string,
) {
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
  return {
    id: option.id,
    shortName: option.shortName,
    description: option.description,
  };
}

/** Only the mediator can remove an option. */
export async function deleteOption(id: string) {
  await prisma.option.delete({ where: { id } });
  return { id };
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
  const neg = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    include: { interests: true, options: true },
  });
  if (!neg) return [];

  // Interests are listed anonymously (no party names) to keep the mediator neutral.
  const interestsText =
    neg.interests.map((i) => `- ${i.text}`).join("\n") || "(none shared yet)";
  const existing =
    neg.options.map((o) => `- ${o.shortName}`).join("\n") || "(none yet)";

  const response = await anthropic.messages.create({
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
  } as Parameters<typeof anthropic.messages.create>[0]);

  const block = Array.isArray(response.content)
    ? response.content.find((b) => b.type === "text")
    : null;
  const raw = block && "text" in block ? block.text : "";
  try {
    const parsed = JSON.parse(raw) as {
      options?: { shortName: string; description: string }[];
    };
    return (parsed.options ?? []).filter((o) => o.shortName);
  } catch {
    return [];
  }
}
