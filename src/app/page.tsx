import Link from "next/link";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { isAdminEmail } from "@/lib/admin";
import { isAdmitted } from "@/lib/access";
import { createCase } from "./actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

export default async function Home() {
  const user = await getOrCreateUser();
  const signedIn = Boolean(user);
  const admin = isAdminEmail(user?.email);
  const admitted = signedIn ? await isAdmitted(user?.email) : false;
  const requestUrl = process.env.PILOT_REQUEST_URL ?? "";

  const cases = user
    ? await prisma.negotiation.findMany({
        where: { parties: { some: { userId: user.id } } },
        orderBy: { updatedAt: "desc" },
        include: { parties: { orderBy: { orderIndex: "asc" } } },
      })
    : [];

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        {/* Top bar */}
        <div className="mb-10 flex items-center justify-between">
          <span className="font-semibold tracking-tight text-stone-900">
            Common Ground
          </span>
          <div className="flex items-center gap-3">
            {signedIn ? (
              <>
                {admin && (
                  <Link
                    href="/usage"
                    className="text-sm font-medium text-stone-600 hover:text-stone-900"
                  >
                    Usage &amp; cost
                  </Link>
                )}
                <UserButton />
              </>
            ) : (
              <>
                <SignInButton mode="modal">
                  <button className="text-sm font-medium text-stone-600 hover:text-stone-900">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                    Sign up
                  </button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>

        {!signedIn ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
              Find your way to “yes,” together.
            </h1>
            <p className="mx-auto mt-3 max-w-md text-stone-600">
              Got a group decision to make? Surface what everyone actually cares
              about, put ideas on the table, and watch a shared map reveal where
              you already agree — with an AI guide leading the way.
            </p>
            <div className="mt-7">
              <SignUpButton mode="modal">
                <button className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700">
                  Get started — it&apos;s free
                </button>
              </SignUpButton>
            </div>
          </section>
        ) : (
          <>
            <header className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                Your negotiations
              </h1>
              <p className="mt-1 text-stone-500">
                Start a new one, or pick up where you left off.
              </p>
            </header>

            {admitted ? (
              <section className="mb-10 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-medium text-stone-900">Start a new one</h2>
                <form action={createCase} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700">
                      What are you working out?
                    </label>
                    <input
                      name="label"
                      required
                      placeholder="e.g. Where should the team offsite be?"
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
                  <p className="text-xs text-stone-400">
                    You&apos;ll be added as the first participant — invite others with a
                    link once it&apos;s created.
                  </p>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
                  >
                    Create →
                  </button>
                </form>
              </section>
            ) : (
              <section className="mb-10 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-medium text-stone-900">
                  You&apos;re on the waitlist
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  Common Ground is in a small private pilot right now. You can still
                  take part in any negotiation you&apos;re{" "}
                  <strong>invited</strong> to — starting your own opens up once
                  you&apos;re admitted.
                </p>
                {requestUrl && (
                  <a
                    href={requestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Request access →
                  </a>
                )}
              </section>
            )}

            <section>
              <h2 className="mb-4 text-lg font-medium text-stone-900">Recent</h2>
              {cases.length === 0 ? (
                <p className="text-stone-500">No negotiations yet. Start one above.</p>
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
          </>
        )}
      </div>
    </div>
  );
}
