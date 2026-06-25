import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import CaseWorkspace from "./CaseWorkspace";
import type { Scipab } from "./scipab-actions";

export const dynamic = "force-dynamic";

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");
  const negotiation = await prisma.negotiation.findUnique({
    where: { id },
    include: {
      parties: {
        orderBy: { orderIndex: "asc" },
        include: {
          intakeMessages: { orderBy: { createdAt: "asc" } },
          interests: {
            orderBy: { createdAt: "asc" },
            include: { points: true },
          },
        },
      },
      options: {
        where: { hidden: false },
        orderBy: { createdAt: "asc" },
        include: { scores: true },
      },
    },
  });
  if (!negotiation) notFound();
  const me = negotiation.parties.find((p) => p.userId === user.id);
  if (!me) notFound();

  const parties = negotiation.parties.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    role: p.role,
    interestsReady: p.interestsReady,
  }));

  const intakeByParty: Record<string, { role: "user" | "assistant"; content: string }[]> = {};
  for (const p of negotiation.parties) {
    intakeByParty[p.id] = p.intakeMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
  }

  // One flat list of every interest. Authorship (ownerPartyId) is kept only for
  // edit permissions — never exposed. A party's *association* with an interest is
  // derived from points: backerIds = everyone who has put at least one point on it.
  const allInterests = negotiation.parties.flatMap((p) =>
    p.interests.map((i) => ({
      id: i.id,
      text: i.text,
      mustHave: i.mustHave,
      ownerPartyId: p.id,
      myPoints: i.points.find((pt) => pt.partyId === me.id)?.points ?? 0,
      totalPoints: i.points.reduce((s, pt) => s + pt.points, 0),
      backerIds: i.points.filter((pt) => pt.points > 0).map((pt) => pt.partyId),
    })),
  );

  const initialOptions = negotiation.options.map((o) => ({
    id: o.id,
    shortName: o.shortName,
    description: o.description,
  }));

  const initialScores = negotiation.options.flatMap((o) =>
    o.scores.map((s) => ({
      partyId: s.partyId,
      optionId: o.id,
      interestId: s.interestId,
      value: s.value,
      na: s.na,
    })),
  );

  let initialScipab: Scipab | null = null;
  if (negotiation.scipab) {
    try {
      initialScipab = JSON.parse(negotiation.scipab) as Scipab;
    } catch {
      initialScipab = null;
    }
  }

  return (
    <CaseWorkspace
      negotiationId={negotiation.id}
      caseLabel={negotiation.label}
      status={negotiation.status}
      description={negotiation.description}
      parties={parties}
      currentPartyId={me.id}
      inviteCode={negotiation.inviteCode}
      intakeByParty={intakeByParty}
      allInterests={allInterests}
      initialOptions={initialOptions}
      initialScores={initialScores}
      initialScipab={initialScipab}
    />
  );
}
