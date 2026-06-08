import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CaseWorkspace from "./CaseWorkspace";

export const dynamic = "force-dynamic";

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const parties = negotiation.parties.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    role: p.role,
  }));

  const intakeByParty: Record<string, { role: "user" | "assistant"; content: string }[]> = {};
  const interestsByParty: Record<string, { id: string; text: string; points: number }[]> = {};

  for (const p of negotiation.parties) {
    intakeByParty[p.id] = p.intakeMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
    interestsByParty[p.id] = p.interests.map((i) => ({
      id: i.id,
      text: i.text,
      points: i.points.find((pt) => pt.partyId === p.id)?.points ?? 0,
    }));
  }

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

  return (
    <CaseWorkspace
      negotiationId={negotiation.id}
      caseLabel={negotiation.label}
      status={negotiation.status}
      description={negotiation.description}
      parties={parties}
      intakeByParty={intakeByParty}
      interestsByParty={interestsByParty}
      initialOptions={initialOptions}
      initialScores={initialScores}
    />
  );
}
