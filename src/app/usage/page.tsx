import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { isAdminEmail } from "@/lib/admin";
import { negotiationRef } from "@/lib/ref";
import { addToAllowlist, removeFromAllowlist } from "./access-actions";
import { setAllowlistLimits } from "./settings-actions";

export const dynamic = "force-dynamic";

function usd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

/** Compact elapsed time (start → resolution), e.g. "2d 3h", "5h 12m", "45m", "30s". */
function formatDuration(ms: number): string {
  if (ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
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
        _count: { select: { parties: true } },
        feedback: {
          orderBy: { createdAt: "asc" },
          include: { party: { select: { displayName: true } } },
        },
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
      return { neg: n, ...a };
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
            Every negotiation and what it&apos;s costing you in AI. Titles are hidden
            — each row shows a stable reference code that participants can see too.
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
                <th className="p-3 text-right">Elapsed</th>
                <th className="p-3">Last AI activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-stone-400">
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
                      <span
                        className="font-mono text-stone-500"
                        title="Stable reference — titles are hidden from the operator view; participants see this same code"
                      >
                        {negotiationRef(neg.id)}
                      </span>
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
                    <td
                      className="p-3 text-right tabular-nums text-stone-600"
                      title="Start → resolution"
                    >
                      {neg.endedAt
                        ? formatDuration(
                            neg.endedAt.getTime() - neg.createdAt.getTime(),
                          )
                        : "—"}
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

        {/* Feedback & outcomes */}
        {negotiations.some((n) => n.feedback.length > 0) && (
          <section className="mt-10">
            <h2 className="text-lg font-medium text-stone-900">
              Feedback &amp; outcomes
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Exit surveys from the Guide and parties, per negotiation.
            </p>
            <div className="mt-4 space-y-3">
              {negotiations
                .filter((n) => n.feedback.length > 0)
                .map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm text-stone-500">
                        {negotiationRef(n.id)}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                        {n.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-700">
                      <span className="text-stone-400">Official outcome:</span>{" "}
                      {n.resolutionType ?? "—"}
                    </p>
                    <div className="mt-3 space-y-2">
                      {n.feedback.map((f) => (
                        <div
                          key={f.id}
                          className="rounded-lg bg-stone-50 p-3"
                        >
                          <p className="text-xs font-medium text-stone-500">
                            {f.party.displayName}
                          </p>
                          {f.helped && (
                            <p className="mt-0.5 text-sm text-stone-700">
                              <span className="text-stone-400">Better outcome:</span>{" "}
                              {f.helped}
                            </p>
                          )}
                          {f.favorite && (
                            <Feedback label="Favorite" text={f.favorite} />
                          )}
                          {f.change && (
                            <Feedback label="Would change" text={f.change} />
                          )}
                          {f.other && <Feedback label="For you" text={f.other} />}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-stone-400">
                      {n.owner.displayName}
                      {n.owner.email && ` · ${n.owner.email}`}
                      {n.endedAt && ` · ${n.endedAt.toISOString().slice(0, 10)}`}
                    </p>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Pilot access */}
        <section className="mt-10">
          <h2 className="text-lg font-medium text-stone-900">Pilot access</h2>
          <p className="mt-1 text-sm text-stone-500">
            Only these emails can <strong>create</strong> negotiations. Anyone can
            still join one they&apos;re invited to. Admins are always admitted. Each
            row&apos;s caps (parties / ideas / interests) apply to that person&apos;s
            negotiations — raise them to unblock a specific customer.
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
                  <th className="p-3">Caps · parties / ideas / interests</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {allowlist.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-stone-400">
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
                      <td className="p-3">
                        <form
                          action={setAllowlistLimits}
                          className="flex items-center gap-1"
                        >
                          <input type="hidden" name="id" value={a.id} />
                          <CapInput name="maxParties" value={a.maxParties} />
                          <span className="text-stone-300">/</span>
                          <CapInput name="maxOptions" value={a.maxOptions} />
                          <span className="text-stone-300">/</span>
                          <CapInput name="maxInterests" value={a.maxInterests} />
                          <button
                            type="submit"
                            className="ml-1 rounded-md border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-600 hover:border-stone-400"
                          >
                            Save
                          </button>
                        </form>
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

function Feedback({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-stone-700">{text}</p>
    </div>
  );
}

function CapInput({ name, value }: { name: string; value: number }) {
  return (
    <input
      type="number"
      name={name}
      min={1}
      defaultValue={value}
      className="w-12 rounded border border-stone-300 px-1 py-0.5 text-center text-sm text-stone-800 outline-none focus:border-emerald-500"
    />
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
