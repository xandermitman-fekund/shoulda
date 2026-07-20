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

  // The viewer's own intake chat is private — loaded once, never synced or proxied.
  const myIntake = await prisma.intakeMessage.findMany({
    where: { partyId: shared.viewerPartyId },
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
    [shared.viewerPartyId]: myIntake.map((m) => ({
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
      isOwner={shared.isOwner}
      viewerPartyId={shared.viewerPartyId}
      parties={shared.parties}
      intakeByParty={intakeByParty}
      allInterests={shared.allInterests}
      initialOptions={shared.options}
      initialScores={shared.scores}
      initialScipab={shared.scipab}
    />
  );
}
