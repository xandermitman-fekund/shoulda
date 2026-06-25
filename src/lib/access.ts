import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

/**
 * Whether a user is admitted to CREATE negotiations (the cost-generating action).
 * Admins are always admitted; otherwise their email must be on the pilot allowlist.
 * Anyone can still JOIN a negotiation via an invite link regardless of this.
 */
export async function isAdmitted(email: string | null | undefined): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  if (!email) return false;
  const row = await prisma.allowlist.findUnique({
    where: { email: email.toLowerCase() },
  });
  return Boolean(row);
}
