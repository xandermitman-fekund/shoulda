import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

function usd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

export default async function UsagePage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  if (!isAdminEmail(user.email)) notFound();

  const [negotiations, calls] = await Promise.all([
    prisma.negotiation.findMany({
      orderBy: { createdAt: "desc" },
      include: { owner: true, _count: { select: { parties: true } } },
    }),
    prisma.aiCall.findMany({
      select: { negotiationId: true, costUsd: true, createdAt: true },
    }),
  ]);

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  type Agg = { calls: number; cost: number; monthCost: number; lastAt: Date | null };
  const agg = new Map<string, Agg>();
  let totalCost = 0;
  let totalMonthCost = 0;
  let totalCalls = 0;

  for (const c of calls) {
    totalCost += c.costUsd;
    totalCalls += 1;
    const inMonth = c.createdAt >= monthStart;
    if (inMonth) totalMonthCost += c.costUsd;
    if (!c.negotiationId) continue;
    const a =
      agg.get(c.negotiationId) ??
      { calls: 0, cost: 0, monthCost: 0, lastAt: null };
    a.calls += 1;
    a.cost += c.costUsd;
    if (inMonth) a.monthCost += c.costUsd;
    if (!a.lastAt || c.createdAt > a.lastAt) a.lastAt = c.createdAt;
    agg.set(c.negotiationId, a);
  }

  const rows = negotiations
    .map((n) => {
      const a =
        agg.get(n.id) ?? { calls: 0, cost: 0, monthCost: 0, lastAt: null };
      return { neg: n, ...a };
    })
    .sort((x, y) => y.cost - x.cost);

  const activeCount = negotiations.filter(
    (n) => n.status === "In Progress",
  ).length;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
          ← Home
        </Link>

        <header className="mt-4 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Usage &amp; cost
          </h1>
          <p className="mt-1 text-stone-500">
            Every negotiation and what it&apos;s costing you in AI (operator view).
          </p>
        </header>

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Negotiations" value={String(negotiations.length)} sub={`${activeCount} active`} />
          <Stat label="AI spend · this month" value={usd(totalMonthCost)} />
          <Stat label="AI spend · all time" value={usd(totalCost)} />
          <Stat label="AI calls · all time" value={String(totalCalls)} />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                <th className="p-3">Negotiation</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">People</th>
                <th className="p-3 text-right">AI calls</th>
                <th className="p-3 text-right">Cost · mo</th>
                <th className="p-3 text-right">Cost · all</th>
                <th className="p-3">Last AI activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-stone-400">
                    No negotiations yet.
                  </td>
                </tr>
              ) : (
                rows.map(({ neg, calls, cost, monthCost, lastAt }) => (
                  <tr
                    key={neg.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                  >
                    <td className="p-3">
                      <Link
                        href={`/n/${neg.id}`}
                        className="font-medium text-stone-900 hover:text-emerald-700"
                      >
                        {neg.label}
                      </Link>
                    </td>
                    <td className="p-3 text-stone-600">
                      <div>{neg.owner.displayName}</div>
                      {neg.owner.email && (
                        <div className="text-xs text-stone-400">
                          {neg.owner.email}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          neg.status === "In Progress"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {neg.status}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums text-stone-700">
                      {neg._count.parties}
                    </td>
                    <td className="p-3 text-right tabular-nums text-stone-700">
                      {calls}
                    </td>
                    <td className="p-3 text-right tabular-nums text-stone-700">
                      {usd(monthCost)}
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium text-stone-900">
                      {usd(cost)}
                    </td>
                    <td className="p-3 text-stone-500">
                      {lastAt
                        ? `${lastAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-stone-400">
          Cost is computed from real token usage per call (Anthropic list pricing
          for the model in use). It reflects your API spend, separate from any
          Claude subscription.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-stone-900">
        {value}
      </div>
      {sub && <div className="text-xs text-stone-400">{sub}</div>}
    </div>
  );
}
