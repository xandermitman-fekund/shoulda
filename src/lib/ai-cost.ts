import { prisma } from "@/lib/prisma";

// USD per 1,000,000 tokens. Unknown models fall back to Opus pricing (conservative).
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-opus-4-6": { in: 5, out: 25 },
  "claude-opus-4-5": { in: 5, out: 25 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-sonnet-4-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

export function aiCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[model] ?? { in: 5, out: 25 };
  return (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
}

type Usage = { input_tokens?: number | null; output_tokens?: number | null };

/**
 * Log one AI call to the cost ledger. Best-effort — never throws into the caller,
 * so cost logging can't break a user-facing AI action.
 */
export async function recordAiCost(opts: {
  negotiationId: string;
  userId: string;
  kind: string;
  model: string;
  usage?: Usage | null;
}): Promise<void> {
  const inputTokens = opts.usage?.input_tokens ?? 0;
  const outputTokens = opts.usage?.output_tokens ?? 0;
  try {
    await prisma.aiCall.create({
      data: {
        negotiationId: opts.negotiationId,
        userId: opts.userId,
        kind: opts.kind,
        model: opts.model,
        inputTokens,
        outputTokens,
        costUsd: aiCostUsd(opts.model, inputTokens, outputTokens),
      },
    });
  } catch {
    // Swallow — a logging failure must not surface to the user.
  }
}
