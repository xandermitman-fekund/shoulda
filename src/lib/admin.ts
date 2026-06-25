/**
 * Operator/admin gate. Set ADMIN_EMAILS (comma-separated) in the environment to
 * grant access to operator views like the usage/cost console. Empty = no admins.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

/** True if any admin email is configured at all. */
export function adminsConfigured(): boolean {
  return Boolean((process.env.ADMIN_EMAILS ?? "").trim());
}
