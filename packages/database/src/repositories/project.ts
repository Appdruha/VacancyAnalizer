import type {
  CommunicationPackage,
  CompanyStage,
  PartnerAgreement,
  ProjectBrief
} from "@edagent/domain";
import { getPrismaClient } from "../client.js";
import { toCommunicationPackage, toPartnerAgreement, toProjectBrief } from "../mappers.js";
import { fromCommunicationPackageKind } from "../shared.js";

export async function getPartnerAgreements(input?: {
  companyId?: string;
  status?: PartnerAgreement["status"];
}): Promise<PartnerAgreement[]> {
  const rows = await getPrismaClient().partnerAgreement.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.status ? { status: input.status } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toPartnerAgreement(row));
}

export async function createPartnerAgreement(input: Omit<PartnerAgreement, "id" | "createdAt" | "updatedAt">): Promise<PartnerAgreement> {
  const row = await getPrismaClient().partnerAgreement.create({
    data: {
      companyId: input.companyId,
      status: input.status,
      signedAt: input.signedAt ? new Date(input.signedAt) : null
    }
  });

  return toPartnerAgreement(row);
}

export async function updatePartnerAgreementStatus(
  id: string,
  status: PartnerAgreement["status"],
  signedAt?: string
): Promise<PartnerAgreement> {
  const row = await getPrismaClient().partnerAgreement.update({
    where: { id },
    data: {
      status,
      signedAt: signedAt ? new Date(signedAt) : status === "signed" ? new Date() : null
    }
  });

  return toPartnerAgreement(row);
}

export async function getPartnerAgreementById(id: string): Promise<PartnerAgreement | null> {
  const row = await getPrismaClient().partnerAgreement.findUnique({
    where: { id }
  });

  return row ? toPartnerAgreement(row) : null;
}

export async function getProjectBriefs(input?: { partnerAgreementId?: string }): Promise<ProjectBrief[]> {
  const rows = await getPrismaClient().projectBrief.findMany({
    where: {
      ...(input?.partnerAgreementId ? { partnerAgreementId: input.partnerAgreementId } : {})
    },
    include: {
      competencies: true
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toProjectBrief(row));
}

export async function createProjectBrief(input: Omit<ProjectBrief, "id" | "createdAt" | "updatedAt">): Promise<ProjectBrief> {
  const prisma = getPrismaClient();
  const row = await prisma.projectBrief.create({
    data: {
      partnerAgreementId: input.partnerAgreementId,
      title: input.title,
      summary: input.summary,
      roles: input.roles as never
    }
  });

  await prisma.projectCompetency.deleteMany({
    where: { projectBriefId: row.id }
  });

  if (input.competencyIds.length > 0) {
    await prisma.projectCompetency.createMany({
      data: input.competencyIds.map((competencyId) => ({
        projectBriefId: row.id,
        competencyId
      })),
      skipDuplicates: true
    });
  }

  const refreshed = await prisma.projectBrief.findUniqueOrThrow({
    where: { id: row.id },
    include: {
      competencies: true
    }
  });

  return toProjectBrief(refreshed);
}

export async function getProjectCatalog(): Promise<
  Array<
    ProjectBrief & {
      agreementStatus: PartnerAgreement["status"];
      companyId: string;
      companyName: string;
      companyRegion: string;
      companyStage: CompanyStage;
      competencyNames: string[];
      materialsCount: number;
      scoreTotal?: number;
    }
  >
> {
  const rows = await getPrismaClient().projectBrief.findMany({
    include: {
      competencies: true,
      partnerAgreement: {
        include: {
          company: {
            include: {
              communicationPackages: true,
              scores: {
                orderBy: { createdAt: "desc" },
                take: 1
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => ({
    ...toProjectBrief(row),
    agreementStatus: row.partnerAgreement.status,
    companyId: row.partnerAgreement.companyId,
    companyName: row.partnerAgreement.company.name,
    companyRegion: row.partnerAgreement.company.region,
    companyStage: row.partnerAgreement.company.stage,
    competencyNames: Array.isArray(row.competencies)
      ? row.competencies
          .map((item: any) => item.competency?.name)
          .filter((value: unknown): value is string => typeof value === "string")
      : [],
    materialsCount: Array.isArray(row.partnerAgreement.company.communicationPackages)
      ? row.partnerAgreement.company.communicationPackages.length
      : 0,
    ...(row.partnerAgreement.company.scores?.[0]?.total !== undefined
      ? { scoreTotal: row.partnerAgreement.company.scores[0].total as number }
      : {})
  }));
}

export async function getCommunicationPackages(input?: {
  companyId?: string;
  partnerAgreementId?: string;
  kind?: CommunicationPackage["kind"];
}): Promise<CommunicationPackage[]> {
  const rows = await (getPrismaClient() as any).communicationPackage.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.partnerAgreementId ? { partnerAgreementId: input.partnerAgreementId } : {}),
      ...(input?.kind ? { kind: fromCommunicationPackageKind(input.kind) } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toCommunicationPackage(row));
}

export async function createCommunicationPackage(
  input: Omit<CommunicationPackage, "id" | "createdAt" | "updatedAt">
): Promise<CommunicationPackage> {
  const row = await (getPrismaClient() as any).communicationPackage.create({
    data: {
      companyId: input.companyId,
      partnerAgreementId: input.partnerAgreementId ?? null,
      kind: fromCommunicationPackageKind(input.kind),
      title: input.title,
      summary: input.summary,
      body: input.body,
      bullets: input.bullets as never
    }
  });

  return toCommunicationPackage(row);
}
