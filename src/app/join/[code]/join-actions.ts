"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";

/**
 * Claim a party seat via its per-party invite code, then enter the workspace.
 * - Unclaimed seat → the caller becomes that party.
 * - Already the caller's seat, or caller already holds another seat here → just enter.
 * - Seat held by someone else → bounced back to the landing (shown as "taken").
 */
export async function claimAndEnter(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  const party = await prisma.party.findUnique({ where: { inviteCode: code } });
  if (!party) redirect("/");

  // Seat already taken by a different user — don't hijack it.
  if (party.userId && party.userId !== user.id) {
    redirect(`/join/${code}?taken=1`);
  }

  // If the caller already holds a seat in this workspace, just send them in.
  const existing = await prisma.party.findFirst({
    where: { negotiationId: party.negotiationId, userId: user.id },
  });
  if (!existing && !party.userId) {
    await prisma.party.update({
      where: { id: party.id },
      data: { userId: user.id },
    });
  }

  redirect(`/n/${party.negotiationId}`);
}
