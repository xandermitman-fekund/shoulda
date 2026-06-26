import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import CaseWorkspace from "./CaseWorkspace";
import { loadSharedState } from "./load-state";

export const dynamic = "force-dynamic";

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  // Shared, syncable state (same shape the live-sync poll returns).
  const shared = await loadSharedState(id, user.id);
  if (!shared) notFound();

  // The caller's own intake is private — loaded once, not synced.
  const myIntake = await prisma.intakeMessage.findMany({
    where: { partyId: shared.currentPartyId },
    orderBy: { createdAt: "asc" },
  });
  const intakeByParty: Record<
    string,
    {
      role: "user" | "assistant";
      content: string;
      imageType?: string;
      imageData?: string;
    }[]
  > = {
    [shared.currentPartyId]: myIntake.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      imageType: m.imageType ?? undefined,
      imageData: m.imageData ?? undefined,
    })),
  };

  return (
    <CaseWorkspace
      negotiationId={id}
      caseLabel={shared.label}
      status={shared.status}
      description={shared.description}
      parties={shared.parties}
      currentPartyId={shared.currentPartyId}
      inviteCode={shared.inviteCode}
      intakeByParty={intakeByParty}
      allInterests={shared.allInterests}
      initialOptions={shared.options}
      initialScores={shared.scores}
      initialScipab={shared.scipab}
    />
  );
}
