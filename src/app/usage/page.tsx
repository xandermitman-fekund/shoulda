import { createHash } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { isAdminEmail } from "@/lib/admin";
import { addToAllowlist, removeFromAllowlist } from "./access-actions";

export const dynamic = "force-dynamic";

function usd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

// Opaque, stable handle for a negotiation you're not part of — derived from its
// unique ID (not its title), so it reveals nothing about the content.
function privacyTag(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 8);
}

export default async function UsagePage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  if (!isAdminEmail(user.email)) notFound();

  const [negotiations, calls] = await Promise.all([
    prisma.negotiation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: true,
        parties: { select: { userId: true } },
        _count: { select: { parties: true } },
      },
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
      // You can only see a title for a negotiation you're actually part of.
      const mine = n.parties.some((p) => p.userId === user.id);
      return { neg: n, mine, ...a };
    })
    .sort((x, y) => y.cost - x.cost);

  const activeCount = negotiations.filter(
    (n) => n.status === "In Progress",
  ).length;

  // Pilot allowlist + which admitted emails have actually signed up.
  const allowlist = await prisma.allowlist.findMany({
    orderBy: { createdAt: "desc" },
  });
  const signedUp = allowlist.length
    ? new Set(
        (
          await prisma.user.findMany({
            where: { email: { in: allowlist.map((a) => a.email) } },
            select: { email: true },
          })
        ).map((u) => (u.email ?? "").toLowerCase()),
      )
    : new Set<string>();

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
                rows.map(({ neg, mine, calls, cost, monthCost, lastAt }) => (
                  <tr
                    key={neg.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                  >
                    <td className="p-3">
                      {mine ? (
                        <Link
                          href={`/n/${neg.id}`}
                          className="font-medium text-stone-900 hover:text-emerald-700"
                        >
                          {neg.label}
                        </Link>
                      ) : (
                        <span
                          className="font-mono text-stone-400"
                          title="A negotiation you're not part of — title hidden for privacy"
                        >
                          Private · {privacyTag(neg.id)}
                        </span>
                      )}
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

        {/* Pilot access */}
        <section className="mt-10">
          <h2 className="text-lg font-medium text-stone-900">Pilot access</h2>
          <p className="mt-1 text-sm text-stone-500">
            Only these emails can <strong>create</strong> negotiations. Anyone can
            still join one they&apos;re invited to. Admins are always admitted.
          </p>

          <form
            action={addToAllowlist}
            className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="flex-1">
              <label className="block text-xs font-medium text-stone-500">
                Email to admit
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="person@example.com"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-stone-500">
                Note (optional)
              </label>
              <input
                name="note"
                placeholder="e.g. from intake form 6/25"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Admit
            </button>
          </form>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                  <th className="p-3">Email</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Note</th>
                  <th className="p-3">Admitted</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {allowlist.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-stone-400">
                      No one admitted yet. Add an email above to start the pilot.
                    </td>
                  </tr>
                ) : (
                  allowlist.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-stone-100 last:border-0"
                    >
                      <td className="p-3 font-medium text-stone-800">{a.email}</td>
                      <td className="p-3">
                        {signedUp.has(a.email) ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            signed up
                          </span>
                        ) : (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                            invited
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-stone-500">{a.note ?? "—"}</td>
                      <td className="p-3 text-stone-500">
                        {a.createdAt.toISOString().slice(0, 10)}
                      </td>
                      <td className="p-3 text-right">
                        <form action={removeFromAllowlist}>
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            type="submit"
                            className="rounded-md px-2 py-1 text-xs font-medium text-stone-400 hover:bg-red-50 hover:text-red-600"
                          >
                            Revoke
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
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
