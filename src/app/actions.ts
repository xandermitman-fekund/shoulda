"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { isAdmitted } from "@/lib/access";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

/**
 * Self-serve pilot request: a signed-in user opts into the pilot from the
 * waitlist panel. Adds their email to the allowlist as NOT approved; an admin
 * approves it in /usage. No-op if a row already exists (never touches an
 * existing approval, so re-clicking can't downgrade an admitted user).
 */
export async function requestPilotAccess() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  const email = user.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) return;
  await prisma.allowlist.upsert({
    where: { email },
    create: { email, approved: false, note: "self-requested" },
    update: {}, // leave any existing row (and its approval) untouched
  });
  revalidatePath("/");
}
