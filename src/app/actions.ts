"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/**
 * Create a new case (negotiation) plus its two parties (single-session v1).
 * Party A is the owner. Redirects into the case workspace on success.
 */
export async function createCase(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  if (!label) {
    // Minimal validation; the form marks this field required client-side too.
    return;
  }
  const description = String(formData.get("description") ?? "").trim();
  const partyA = String(formData.get("partyA") ?? "").trim() || "Party A";
  const partyB = String(formData.get("partyB") ?? "").trim() || "Party B";

  const created = await prisma.negotiation.create({
    data: {
      label,
      description,
      status: "In Progress",
      parties: {
        create: [
          { displayName: partyA, role: "owner", orderIndex: 0 },
          { displayName: partyB, role: "party", orderIndex: 1 },
        ],
      },
    },
  });

  redirect(`/n/${created.id}`);
}
