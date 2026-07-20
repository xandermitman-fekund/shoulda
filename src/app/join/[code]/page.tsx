import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { claimAndEnter } from "./join-actions";

export const dynamic = "force-dynamic";

/**
 * Per-party invite landing. A signed-in visitor who opens /join/<party inviteCode>
 * is offered the seat: "You've been invited to represent [Party]." On "Let's go!"
 * they claim it and enter the workspace. Protected by middleware, so anonymous
 * visitors sign in first.
 */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ taken?: string }>;
}) {
  const { code } = await params;
  const { taken } = await searchParams;
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  const party = await prisma.party.findUnique({
    where: { inviteCode: code },
    include: { negotiation: { select: { label: true } } },
  });
  if (!party) notFound();

  // Already the caller's seat (or they already hold one here) → straight in.
  const existing = await prisma.party.findFirst({
    where: { negotiationId: party.negotiationId, userId: user.id },
  });
  if (existing) redirect(`/n/${party.negotiationId}`);

  const seatTaken = Boolean(party.userId) || Boolean(taken);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        {seatTaken ? (
          <>
            <h1 className="text-xl font-semibold text-stone-900">
              This seat is already taken
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Someone has already claimed the{" "}
              <span className="font-medium text-stone-700">
                {party.displayName}
              </span>{" "}
              seat. Ask whoever invited you for a fresh link.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-600">
              You&apos;re invited
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
              Represent{" "}
              <span className="text-emerald-700">{party.displayName}</span>
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              in &ldquo;{party.negotiation.label}&rdquo;. You&apos;ll share what
              matters to you and how you see the options — in your own private space.
            </p>
            <form action={claimAndEnter} className="mt-6">
              <input type="hidden" name="code" value={code} />
              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700"
              >
                Let&apos;s go →
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
