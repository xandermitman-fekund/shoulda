import { anthropic, MEDIATOR_MODEL } from "@/lib/anthropic";
import { intakeSystemPrompt } from "@/lib/mediator";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streaming chat with the AI Mediator during a party's general intake.
 * Body: { partyId: string, message: string }
 * Streams the mediator's reply back as plain text, and persists both the
 * user's message and the mediator's reply to the IntakeMessage table.
 */
export async function POST(req: Request) {
  let body: { partyId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const partyId = String(body.partyId ?? "");
  const message = String(body.message ?? "").trim();
  if (!partyId || !message) {
    return new Response("partyId and message are required", { status: 400 });
  }

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      negotiation: true,
      intakeMessages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!party) {
    return new Response("Party not found", { status: 404 });
  }

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
