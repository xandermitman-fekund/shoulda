"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { isAdminEmail } from "@/lib/admin";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const user = await getOrCreateUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

/** Admit an email to the pilot (may create negotiations). Admin only. */
export async function addToAllowlist(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!email || !email.includes("@")) return;
  await prisma.allowlist.upsert({
    where: { email },
    // Admin-added = pre-approved (admitting IS approving). Re-admitting a
    // self-requested (pending) email approves it too.
    create: { email, note, addedBy: admin.id, approved: true },
    update: { note: note ?? undefined, approved: true },
  });
  revalidatePath("/usage");
}

/** Approve or un-approve a pilot email — this is the create-negotiation gate. Admin only. */
export async function setAllowlistApproval(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(formData.get("id") ?? "");
  const approved = String(formData.get("approved") ?? "") === "true";
  if (!id) return;
  await prisma.allowlist
    .update({ where: { id }, data: { approved } })
    .catch(() => {});
  revalidatePath("/usage");
}

/** Revoke a pilot admission. Admin only. */
export async function removeFromAllowlist(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.allowlist.delete({ where: { id } }).catch(() => {});
  revalidatePath("/usage");
}
