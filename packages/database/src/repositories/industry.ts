import type { Competency, Industry, ProgramCompetency, Vacancy } from "@edagent/domain";
import { getPrismaClient } from "../client.js";
import { toVacancy } from "../mappers.js";
import { withOptional } from "../shared.js";

export async function getIndustries(): Promise<Industry[]> {
  const rows = await getPrismaClient().industry.findMany({
    orderBy: [{ priority: "asc" }, { name: "asc" }]
  });

  return rows.map((row: any) =>
    withOptional(
      {
        id: row.id,
        name: row.name,
        priority: row.priority
      },
      "approvedByUserId",
      row.approvedByUserId ?? undefined
    )
  );
}

export async function upsertIndustry(input: {
  name: string;
  priority: number;
  approvedByUserId?: string;
}): Promise<Industry> {
  const row = await getPrismaClient().industry.upsert({
    where: {
      name: input.name
    },
    update: {
      priority: input.priority,
      approvedByUserId: input.approvedByUserId ?? null
    },
    create: {
      name: input.name,
      priority: input.priority,
      approvedByUserId: input.approvedByUserId ?? null
    }
  });

  return withOptional(
    {
      id: row.id,
      name: row.name,
      priority: row.priority
    },
    "approvedByUserId",
    row.approvedByUserId ?? undefined
  );
}

export async function getCompetencies(): Promise<Competency[]> {
  const rows = await getPrismaClient().competency.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });

  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category
  }));
}

export async function replaceProgramCompetencies(input: {
  programName: string;
  items: Array<{
    competencyId: string;
    coverageScore: number;
  }>;
}): Promise<ProgramCompetency[]> {
  const prisma = getPrismaClient();
  await prisma.programCompetency.deleteMany({
    where: {
      programName: input.programName
    }
  });

  if (input.items.length > 0) {
    await prisma.programCompetency.createMany({
      data: input.items.map((item) => ({
        programName: input.programName,
        competencyId: item.competencyId,
        coverageScore: item.coverageScore
      }))
    });
  }

  return getProgramCompetencies();
}

export async function upsertCompetencyByName(name: string, category = "market"): Promise<Competency> {
  const normalizedName = name.trim().toLowerCase();
  const row = await getPrismaClient().competency.upsert({
    where: { name: normalizedName },
    update: { category },
    create: { name: normalizedName, category }
  });

  return {
    id: row.id,
    name: row.name,
    category: row.category
  };
}

export async function getProgramCompetencies(): Promise<ProgramCompetency[]> {
  const rows = await getPrismaClient().programCompetency.findMany({
    orderBy: [{ programName: "asc" }, { createdAt: "asc" }]
  });

  return rows.map((row: any) => ({
    id: row.id,
    programName: row.programName,
    competencyId: row.competencyId,
    coverageScore: row.coverageScore
  }));
}

export async function getVacancies(): Promise<Vacancy[]> {
  const rows = await getPrismaClient().vacancy.findMany({
    include: { competencies: true },
    orderBy: { collectedAt: "desc" }
  });

  return rows.map((row: any) => toVacancy(row));
}

export async function getVacanciesByIndustry(industryId: string): Promise<Vacancy[]> {
  const rows = await getPrismaClient().vacancy.findMany({
    where: { industryId },
    include: { competencies: true },
    orderBy: { collectedAt: "desc" }
  });

  return rows.map((row: any) => toVacancy(row));
}

export async function createOrUpdateVacancy(input: Omit<Vacancy, "id" | "competencyIds"> & { competencyIds: string[] }): Promise<Vacancy> {
  const prisma = getPrismaClient();
  const row = await prisma.vacancy.upsert({
    where: {
      source_externalId: {
        source: input.source,
        externalId: input.externalId ?? `${input.source}-${input.title}-${input.companyName}`
      }
    },
    update: {
      title: input.title,
      companyName: input.companyName,
      areaName: input.areaName ?? null,
      employmentName: input.employmentName ?? null,
      experienceName: input.experienceName ?? null,
      scheduleName: input.scheduleName ?? null,
      url: input.url ?? null,
      alternateUrl: input.alternateUrl ?? null,
      requirement: input.requirement ?? null,
      responsibility: input.responsibility ?? null,
      description: input.description ?? null,
      salaryFrom: input.salaryFrom ?? null,
      salaryTo: input.salaryTo ?? null,
      salaryCurrency: input.salaryCurrency ?? null,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      collectedAt: new Date(input.collectedAt),
      industryId: input.industryId
    },
    create: {
      externalId: input.externalId ?? `${input.source}-${input.title}-${input.companyName}`,
      source: input.source,
      title: input.title,
      companyName: input.companyName,
      areaName: input.areaName ?? null,
      employmentName: input.employmentName ?? null,
      experienceName: input.experienceName ?? null,
      scheduleName: input.scheduleName ?? null,
      url: input.url ?? null,
      alternateUrl: input.alternateUrl ?? null,
      requirement: input.requirement ?? null,
      responsibility: input.responsibility ?? null,
      description: input.description ?? null,
      salaryFrom: input.salaryFrom ?? null,
      salaryTo: input.salaryTo ?? null,
      salaryCurrency: input.salaryCurrency ?? null,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      collectedAt: new Date(input.collectedAt),
      industryId: input.industryId
    },
    include: { competencies: true }
  });

  await prisma.vacancyCompetency.deleteMany({
    where: { vacancyId: row.id }
  });

  if (input.competencyIds.length > 0) {
    await prisma.vacancyCompetency.createMany({
      data: input.competencyIds.map((competencyId) => ({
        vacancyId: row.id,
        competencyId
      })),
      skipDuplicates: true
    });
  }

  const refreshed = await prisma.vacancy.findUniqueOrThrow({
    where: { id: row.id },
    include: { competencies: true }
  });

  return toVacancy(refreshed);
}
