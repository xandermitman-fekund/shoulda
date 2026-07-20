"use server";

import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { isAdminEmail } from "@/lib/admin";
import { revalidatePath } from "next/cache";

const clamp = (n: number, def: number) =>
  Math.max(1, Math.min(1000, Math.round(Number.isFinite(n) ? n : def)));

/** Set per-pilot-user caps on one allowlist entry. Admin only. */
export async function setAllowlistLimits(formData: FormData) {
  const user = await getOrCreateUser();
  if (!user || !isAdminEmail(user.email)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const maxParties = clamp(Number(formData.get("maxParties")), 5);
  const maxOptions = clamp(Number(formData.get("maxOptions")), 7);
  const maxInterests = clamp(Number(formData.get("maxInterests")), 7);

  await prisma.allowlist
    .update({
      where: { id },
      data: { maxParties, maxOptions, maxInterests },
    })
    .catch(() => {});
  revalidatePath("/usage");
}
