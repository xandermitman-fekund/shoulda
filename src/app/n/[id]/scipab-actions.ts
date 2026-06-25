"use server";

import { prisma } from "@/lib/prisma";
import { requireParty } from "@/lib/participant";
import { consumeAiCredit } from "@/lib/ai-usage";
import { anthropic, MEDIATOR_MODEL } from "@/lib/anthropic";
import { recordAiCost } from "@/lib/ai-cost";
import { scipabSystemPrompt } from "@/lib/mediator";

// messages.create() returns a Stream | Message union; for non-streaming calls we
// read the text block (and usage) off the result via this minimal shape.
type TextResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};
function firstText(res: TextResponse): string {
  return res.content?.find((b) => b.type === "text")?.text ?? "";
}

export type Scipab = {
  situation: string;
  complication: string;
  implication: string;
  position: string;
  action: string;
  benefit: string;
  recommendedOptions: string[];
  tensions: string[];
};

const SCIPAB_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    situation: { type: "string" },
    complication: { type: "string" },
    implication: { type: "string" },
    position: { type: "string" },
    action: { type: "string" },
    benefit: { type: "string" },
    recommendedOptions: { type: "array", items: { type: "string" } },
    tensions: { type: "array", items: { type: "string" } },
  },
  required: [
    "situation",
    "complication",
    "implication",
    "position",
    "action",
    "benefit",
    "recommendedOptions",
    "tensions",
  ],
} as const;

/** Ask the AI Mediator to synthesize the group's SCIPAB document of record from everything entered. */
export async function draftScipab(
  negotiationId: string,
): Promise<{ ok: true; scipab: Scipab } | { ok: false; error: string }> {
  const base = await requireParty(negotiationId);
  if (!base) return { ok: false, error: "You're not a participant." };
  if (!(await consumeAiCredit(base.userId)))
    return { ok: false, error: "Monthly AI limit reached — try again next month." };

  const negotiation = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    include: {
      parties: {
        orderBy: { orderIndex: "asc" },
        include: {
          intakeMessages: { orderBy: { createdAt: "asc" } },
          interests: { orderBy: { createdAt: "asc" }, include: { points: true } },
        },
      },
      options: {
        where: { hidden: false },
        orderBy: { createdAt: "asc" },
        include: { scores: true },
      },
    },
  });
  if (!negotiation) return { ok: false, error: "Not found." };

  const nameByParty = new Map(
    negotiation.parties.map((p) => [p.id, p.displayName]),
  );
  const allInterests = negotiation.parties.flatMap((p) => p.interests);
  const interestText = new Map(allInterests.map((i) => [i.id, i.text]));

  const intakeBlock = negotiation.parties
    .map((p) => {
      const convo = p.intakeMessages
        .map(
          (m) =>
            `${m.role === "assistant" ? "Mediator" : p.displayName}: ${m.content}`,
        )
        .join("\n");
      return `## ${p.displayName}\n${convo || "(no intake conversation)"}`;
    })
    .join("\n\n");

  const interestsBlock = allInterests.length
    ? allInterests
        .map((i) => {
          const weights = i.points
            .filter((pt) => pt.points > 0)
            .map((pt) => `${nameByParty.get(pt.partyId) ?? "?"} ${pt.points}pts`)
            .join(", ");
          return `- "${i.text}"${i.mustHave ? " [must-have]" : ""}${
            weights ? ` — ${weights}` : " — (no points yet)"
          }`;
        })
        .join("\n")
    : "(no interests yet)";

  const optionsBlock = negotiation.options.length
    ? negotiation.options
        .map((o) => `- ${o.shortName}: ${o.description || "(no description)"}`)
        .join("\n")
    : "(no options yet)";

  const scoresBlock = negotiation.options.length
    ? negotiation.options
        .map((o) => {
          const rows = o.scores
            .filter((s) => s.value !== null || s.na)
            .map((s) => {
              const who = nameByParty.get(s.partyId) ?? "?";
              const what = interestText.get(s.interestId) ?? "?";
              const val = s.na ? "n/a" : `${s.value}%`;
              return `    • ${who} rated "${what}": ${val}`;
            })
            .join("\n");
          return `- ${o.shortName}:\n${rows || "    (not scored yet)"}`;
        })
        .join("\n")
    : "(no scores yet)";

  const userContent = `PROBLEM: ${negotiation.label}${
    negotiation.description ? `\n${negotiation.description}` : ""
  }

PEOPLE INVOLVED: ${negotiation.parties.map((p) => p.displayName).join(", ")}

=== INTAKE CONVERSATIONS ===
${intakeBlock}

=== INTERESTS (★ = must-have) AND PRIORITY POINTS ===
${interestsBlock}

=== OPTIONS ON THE TABLE ===
${optionsBlock}

=== SCORES (how well each option meets each interest, per person) ===
${scoresBlock}

Write the group's SCIPAB document of record now.`;

  let scipab: Scipab;
  try {
    const response = (await anthropic.messages.create({
      model: MEDIATOR_MODEL,
      max_tokens: 4096,
      system: scipabSystemPrompt(negotiation.label),
      messages: [{ role: "user", content: userContent }],
      output_config: { format: { type: "json_schema", schema: SCIPAB_SCHEMA } },
    } as Parameters<typeof anthropic.messages.create>[0])) as unknown as TextResponse;

    const parsed = JSON.parse(firstText(response));
    scipab = {
      situation: String(parsed.situation ?? ""),
      complication: String(parsed.complication ?? ""),
      implication: String(parsed.implication ?? ""),
      position: String(parsed.position ?? ""),
      action: String(parsed.action ?? ""),
      benefit: String(parsed.benefit ?? ""),
      recommendedOptions: Array.isArray(parsed.recommendedOptions)
        ? parsed.recommendedOptions.map(String)
        : [],
      tensions: Array.isArray(parsed.tensions)
        ? parsed.tensions.map(String)
        : [],
    };
    await recordAiCost({
      negotiationId,
      userId: base.userId,
      kind: "scipab",
      model: MEDIATOR_MODEL,
      usage: response.usage,
    });
  } catch {
    return {
      ok: false,
      error: "The mediator couldn't draft the agreement. Please try again.",
    };
  }

  await prisma.negotiation.update({
    where: { id: negotiationId },
    data: { scipab: JSON.stringify(scipab), scipabAt: new Date() },
  });

  return { ok: true, scipab };
}
