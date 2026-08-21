import { anthropic, MEDIATOR_MODEL } from "@/lib/anthropic";
import { coachSystemPrompt } from "@/lib/mediator";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getOrCreateUser } from "@/lib/user";
import { consumeAiCredit } from "@/lib/ai-usage";
import { recordAiCost } from "@/lib/ai-cost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * Streaming strategy chat with the "Coach" for the negotiation's OWNER (Guide).
 * Body: { negotiationId: string, messages: {role, content}[] }
 *
 * The Coach reads the live board (parties, interests, points, options, scores) so its
 * critique is grounded — but it deliberately does NOT read parties' private intake
 * chats. Owner is derived from auth; the client cannot spoof the board state.
 */
export async function POST(req: Request) {
  let body: { negotiationId?: string; messages?: ChatTurn[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const negotiationId = String(body.negotiationId ?? "");
  const turns: ChatTurn[] = Array.isArray(body.messages)
    ? body.messages
        .filter((m) => m && (m.role === "user" || m.role === "assistant"))
        .map((m) => ({ role: m.role, content: String(m.content ?? "") }))
        .filter((m) => m.content.trim())
    : [];
  if (!negotiationId || turns.length === 0) {
    return new Response("negotiationId and at least one message are required", {
      status: 400,
    });
  }

  const user = await getOrCreateUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  // Load the board WITHOUT intake transcripts — the Coach never sees private chats.
  const negotiation = await prisma.negotiation.findUnique({
    where: { id: negotiationId },
    include: {
      parties: {
        orderBy: { orderIndex: "asc" },
        include: {
          interests: { orderBy: { createdAt: "asc" }, include: { points: true } },
        },
      },
      options: { orderBy: { createdAt: "asc" }, include: { scores: true } },
    },
  });
  if (!negotiation) return new Response("Not found", { status: 404 });

  // Coach is a tool for the person running the negotiation.
  if (negotiation.ownerUserId !== user.id) {
    return new Response("Only the negotiation owner can use the Coach", {
      status: 403,
    });
  }

  if (!(await consumeAiCredit(user.id))) {
    return new Response(
      "You've reached your monthly AI limit — try again next month.",
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const stateBlock = buildStateBlock(negotiation);
  const system = coachSystemPrompt(negotiation.label, stateBlock);

  const llm = anthropic.messages.stream({
    model: MEDIATOR_MODEL,
    max_tokens: 1536,
    system,
    messages: turns,
  } as Parameters<typeof anthropic.messages.stream>[0]);

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of llm) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        try {
          const finalMsg = await llm.finalMessage();
          await recordAiCost({
            negotiationId,
            userId: user.id,
            kind: "coach",
            model: MEDIATOR_MODEL,
            usage: finalMsg.usage,
          });
        } catch {
          // cost logging is best-effort
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

type LoadedNegotiation = Prisma.NegotiationGetPayload<{
  include: {
    parties: { include: { interests: { include: { points: true } } } };
    options: { include: { scores: true } };
  };
}>;

/** Render the current board as text for the Coach — no private intake transcripts. */
function buildStateBlock(negotiation: LoadedNegotiation): string {
  const nameByParty = new Map(
    negotiation.parties.map((p) => [p.id, p.displayName]),
  );
  const allInterests = negotiation.parties.flatMap((p) => p.interests);
  const interestText = new Map(allInterests.map((i) => [i.id, i.text]));

  const backing = (interest: (typeof allInterests)[number]): string => {
    const spent = interest.points
      .filter((pt) => pt.points > 0)
      .map((pt) => `${nameByParty.get(pt.partyId) ?? "?"} ${pt.points}pts`)
      .join(", ");
    return spent ? ` — backed by: ${spent}` : " — (no points yet)";
  };

  // Interests grouped under the party that authored them, so the Coach can reason
  // per-party ("consolidate Sales' interests") — this is owner-only, never shown to parties.
  const interestsBlock = negotiation.parties
    .map((p) => {
      const lines = p.interests.length
        ? p.interests
            .map(
              (i) => `- "${i.text}"${i.mustHave ? " ★must-have" : ""}${backing(i)}`,
            )
            .join("\n")
        : "- (none yet)";
      return `## ${p.displayName}\n${lines}`;
    })
    .join("\n\n");

  const optionsBlock = negotiation.options.length
    ? negotiation.options
        .map((o) => {
          const tag =
            o.goState === "go"
              ? " [👍 marked Go]"
              : o.goState === "no_go"
                ? " [👎 no-go'd]"
                : "";
          return `- ${o.shortName}${tag}: ${o.description || "(no description)"}`;
        })
        .join("\n")
    : "(no options on the table yet)";

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

  return `PROBLEM: ${negotiation.label}${
    negotiation.description ? `\n${negotiation.description}` : ""
  }

PARTIES: ${negotiation.parties.map((p) => p.displayName).join(", ") || "(none yet)"}

=== INTERESTS BY PARTY (★ = must-have; "backed by" = who has spent priority points) ===
${interestsBlock}

=== OPTIONS ON THE TABLE ===
${optionsBlock}

=== SCORES (how well each option meets each interest, per person; higher = better) ===
${scoresBlock}`;
}
