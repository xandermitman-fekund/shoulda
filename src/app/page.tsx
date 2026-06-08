import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCase } from "./actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

export default async function Home() {
  const cases = await prisma.negotiation.findMany({
    orderBy: { updatedAt: "desc" },
    include: { parties: { orderBy: { orderIndex: "asc" } } },
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Common Ground
          </h1>
          <p className="mt-1 text-stone-500">
            Find your way to “yes,” together — guided every step by an AI mediator.
          </p>
        </header>

        <section className="mb-12 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-stone-900">Start a new case</h2>
          <form action={createCase} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700">
                What are you working out?
              </label>
              <input
                name="label"
                required
                placeholder="e.g. Dividing the family home"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">
                A little more detail (optional)
              </label>
              <textarea
                name="description"
                rows={2}
                placeholder="Briefly, what's this about?"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700">First person</label>
                <input name="partyA" defaultValue="Party A" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700">Second person</label>
                <input name="partyB" defaultValue="Party B" className={inputClass} />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Create case →
            </button>
          </form>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-stone-900">Your cases</h2>
          {cases.length === 0 ? (
            <p className="text-stone-500">No cases yet. Start one above.</p>
          ) : (
            <ul className="space-y-3">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/n/${c.id}`}
                    className="block rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-emerald-400 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-stone-900">{c.label}</span>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                        {c.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {c.parties.map((p) => p.displayName).join("  •  ")}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
