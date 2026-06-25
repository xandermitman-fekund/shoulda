import { anthropic, MEDIATOR_MODEL } from "@/lib/anthropic";
import { intakeSystemPrompt } from "@/lib/mediator";
import { prisma } from "@/lib/prisma";
import { requireParty } from "@/lib/participant";
import { consumeAiCredit } from "@/lib/ai-usage";
import { recordAiCost } from "@/lib/ai-cost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streaming chat with the AI Mediator during a participant's general intake.
 * Body: { negotiationId: string, message: string }
 * The caller's party is derived from their auth session — not from the client.
 */
export async function POST(req: Request) {
  let body: { negotiationId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const negotiationId = String(body.negotiationId ?? "");
  const message = String(body.message ?? "").trim();
  if (!negotiationId || !message) {
    return new Response("negotiationId and message are required", { status: 400 });
  }

  const base = await requireParty(negotiationId);
  if (!base) {
    return new Response("Not a participant", { status: 403 });
  }
  if (!(await consumeAiCredit(base.userId))) {
    const msg =
      "You've reached this demo's monthly limit for the AI mediator. Thanks for trying Common Ground — it's a free demo with usage limits to keep costs in check.";
    return new Response(msg, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  const party = await prisma.party.findUnique({
    where: { id: base.id },
    include: {
      negotiation: true,
      intakeMessages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!party) {
    return new Response("Party not found", { status: 404 });
  }
  const partyId = party.id;

  // Build the conversation: prior stored turns + the new user message.
  const history = party.intakeMessages.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));
  history.push({ role: "user", content: message });

  // Persist the user's message now.
  await prisma.intakeMessage.create({
    data: { partyId, role: "user", content: message },
  });

  const system = intakeSystemPrompt(party.displayName, party.negotiation.label);

  const llm = anthropic.messages.stream({
    model: MEDIATOR_MODEL,
    max_tokens: 2048,
    system,
    messages: history,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const event of llm) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        if (full.trim()) {
          await prisma.intakeMessage.create({
            data: { partyId, role: "assistant", content: full },
          });
        }
        try {
          const finalMsg = await llm.finalMessage();
          await recordAiCost({
            negotiationId,
            userId: base.userId,
            kind: "intake",
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
