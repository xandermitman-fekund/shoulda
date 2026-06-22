import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";

export const dynamic = "force-dynamic";

/**
 * Invite-link landing. A signed-in visitor who opens /join/<inviteCode> is added
 * as a participant (if not already) and sent into the negotiation. The route is
 * protected by middleware, so anonymous visitors sign in first, then land here.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  const negotiation = await prisma.negotiation.findUnique({
    where: { inviteCode: code },
    include: { parties: true },
  });
  if (!negotiation) notFound();

  const already = negotiation.parties.some((p) => p.userId === user.id);
  if (!already) {
    await prisma.party.create({
      data: {
        negotiationId: negotiation.id,
        userId: user.id,
        displayName: user.displayName,
        role: "participant",
        orderIndex: negotiation.parties.length,
      },
    });
  }

  redirect(`/n/${negotiation.id}`);
}
