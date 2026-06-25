import { prisma } from "@/lib/prisma";
import { isAdminEmail, adminsConfigured } from "@/lib/admin";

/**
 * Whether a user is admitted to CREATE negotiations (the cost-generating action).
 * Admins are always admitted; otherwise their email must be on the pilot allowlist.
 * Anyone can still JOIN a negotiation via an invite link regardless of this.
 *
 * Fails OPEN until the pilot is configured: if no admins are set AND nobody has
 * been admitted yet, the gate is inactive (app behaves as before). It switches on
 * the moment ADMIN_EMAILS is set or the first email is admitted.
 */
export async function isAdmitted(email: string | null | undefined): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  if (!adminsConfigured()) {
    const admitted = await prisma.allowlist.count();
    if (admitted === 0) return true; // pilot not configured yet → stay open
  }
  if (!email) return false;
  const row = await prisma.allowlist.findUnique({
    where: { email: email.toLowerCase() },
  });
  return Boolean(row);
}
