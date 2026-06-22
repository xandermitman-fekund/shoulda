import { prisma } from "./prisma";

// Monthly AI-call cap per user (cost guardrail for the public demo).
const CAP = Number(process.env.AI_MONTHLY_CAP ?? 100);

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Count one AI call against the user's monthly cap (atomic increment).
 * Returns true if the call is within the cap, false if they're over it.
 */
export async function consumeAiCredit(userId: string): Promise<boolean> {
  const period = currentPeriod();
  const usage = await prisma.aiUsage.upsert({
    where: { userId_period: { userId, period } },
    create: { userId, period, count: 1 },
    update: { count: { increment: 1 } },
  });
  return usage.count <= CAP;
}
