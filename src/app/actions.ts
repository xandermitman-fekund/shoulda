"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { isAdmitted } from "@/lib/access";
import { redirect } from "next/navigation";

/**
 * Create a negotiation owned by the signed-in user, adding them as the first
 * participant. Others join later via the invite link.
 */
export async function createCase(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  // Pilot gate: only admitted users may create (anyone may still join via invite).
  if (!(await isAdmitted(user.email))) redirect("/");

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const description = String(formData.get("description") ?? "").trim();

  const created = await prisma.negotiation.create({
    data: {
      label,
      description,
      status: "In Progress",
      ownerUserId: user.id,
      parties: {
        create: [
          {
            userId: user.id,
            displayName: user.displayName,
            role: "owner",
            orderIndex: 0,
          },
        ],
      },
    },
  });

  redirect(`/n/${created.id}`);
}
