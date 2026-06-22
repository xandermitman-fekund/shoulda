import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";

/**
 * Sync the signed-in Clerk user into our database and return the User record.
 * Returns null if no one is signed in.
 */
export async function getOrCreateUser() {
  const cu = await currentUser();
  if (!cu) return null;

  const email = cu.emailAddresses?.[0]?.emailAddress ?? null;
  const displayName =
    cu.firstName?.trim() ||
    cu.username?.trim() ||
    email?.split("@")[0] ||
    "User";

  return prisma.user.upsert({
    where: { id: cu.id },
    create: { id: cu.id, email, displayName },
    update: { email, displayName },
  });
}
