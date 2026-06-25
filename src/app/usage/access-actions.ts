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
    create: { email, note, addedBy: admin.id },
    update: { note: note ?? undefined },
  });
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
