import { PrismaClient } from "@prisma/client";
import type {
  AuditLog,
  BackgroundJob,
  Company,
  CompanyContact,
  CompanyScore,
  Competency,
  Industry,
  IndustrySource,
  IngestionRun,
  PlatformSnapshot,
  ProgramCompetency,
  SourceKind,
  SystemSetting,
  User,
  Vacancy
} from "@edagent/domain";

declare global {
  var __edagentPrisma: PrismaClient | undefined;
}

function getPrismaClient(): PrismaClient {
  if (!globalThis.__edagentPrisma) {
    globalThis.__edagentPrisma = new PrismaClient();
  }

  return globalThis.__edagentPrisma;
}

function withOptional<T extends object, K extends string, V>(
  object: T,
  key: K,
  value: V | undefined
): T & Partial<Record<K, V>> {
  if (value === undefined) {
    return object;
  }

  return {
    ...object,
    [key]: value
  };
}

function jsonRecord(input: unknown): Record<string, string | number | boolean | null> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = value;
    }
  }

  return result;
}

function toCompanySize(value: "startup" | "smb" | "mid_market" | "enterprise"): Company["size"] {
  return value === "mid_market" ? "mid-market" : value;
}

function toBackgroundJob(row: any): BackgroundJob {
  return withOptional(
    {
      id: row.id,
      queue: row.queue,
      type: row.type,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      payload: jsonRecord(row.payload),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    },
    "lastError",
    row.lastError ?? undefined
  );
}

function toIndustrySource(row: any): IndustrySource {
  return {
    id: row.id,
    industryId: row.industryId,
    source: row.source,
    status: row.status,
    config: jsonRecord(row.config)
  };
}

function toIngestionRun(row: any): IngestionRun {
  let run: IngestionRun = {
    id: row.id,
    industryId: row.industryId,
    sourceId: row.sourceId,
    status: row.status,
    query: row.query,
    processedCount: row.processedCount,
    competencyCount: row.competencyCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  run = withOptional(run, "page", row.page ?? undefined);
  run = withOptional(run, "perPage", row.perPage ?? undefined);
  run = withOptional(run, "totalFound", row.totalFound ?? undefined);
  run = withOptional(run, "startedAt", row.startedAt ? row.startedAt.toISOString() : undefined);
  run = withOptional(run, "finishedAt", row.finishedAt ? row.finishedAt.toISOString() : undefined);
  run = withOptional(run, "errorMessage", row.errorMessage ?? undefined);
  return run;
}

function toVacancy(row: any): Vacancy {
  let vacancy: Vacancy = {
    id: row.id,
    source: row.source,
    title: row.title,
    companyName: row.companyName,
    industryId: row.industryId,
    competencyIds: Array.isArray(row.competencies) ? row.competencies.map((item: any) => item.competencyId) : [],
    collectedAt: row.collectedAt.toISOString()
  };

  vacancy = withOptional(vacancy, "externalId", row.externalId ?? undefined);
  vacancy = withOptional(vacancy, "areaName", row.areaName ?? undefined);
  vacancy = withOptional(vacancy, "employmentName", row.employmentName ?? undefined);
  vacancy = withOptional(vacancy, "experienceName", row.experienceName ?? undefined);
  vacancy = withOptional(vacancy, "scheduleName", row.scheduleName ?? undefined);
  vacancy = withOptional(vacancy, "url", row.url ?? undefined);
  vacancy = withOptional(vacancy, "alternateUrl", row.alternateUrl ?? undefined);
  vacancy = withOptional(vacancy, "requirement", row.requirement ?? undefined);
  vacancy = withOptional(vacancy, "responsibility", row.responsibility ?? undefined);
  vacancy = withOptional(vacancy, "description", row.description ?? undefined);
  vacancy = withOptional(vacancy, "salaryFrom", row.salaryFrom ?? undefined);
  vacancy = withOptional(vacancy, "salaryTo", row.salaryTo ?? undefined);
  vacancy = withOptional(vacancy, "salaryCurrency", row.salaryCurrency ?? undefined);
  vacancy = withOptional(vacancy, "publishedAt", row.publishedAt ? row.publishedAt.toISOString() : undefined);
  return vacancy;
}

async function getIndustries(): Promise<Industry[]> {
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

async function getCompetencies(): Promise<Competency[]> {
  const rows = await getPrismaClient().competency.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });

  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category
  }));
}

async function upsertCompetencyByName(name: string, category = "market"): Promise<Competency> {
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

async function getProgramCompetencies(): Promise<ProgramCompetency[]> {
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

async function getVacancies(): Promise<Vacancy[]> {
  const rows = await getPrismaClient().vacancy.findMany({
    include: { competencies: true },
    orderBy: { collectedAt: "desc" }
  });

  return rows.map((row: any) => toVacancy(row));
}

async function createOrUpdateVacancy(input: Omit<Vacancy, "id" | "competencyIds"> & { competencyIds: string[] }): Promise<Vacancy> {
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

async function getUsers(): Promise<User[]> {
  const rows = await getPrismaClient().user.findMany({
    orderBy: { createdAt: "asc" }
  });

  return rows.map((row: any) => ({
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role
  }));
}

async function findUserByEmail(email: string): Promise<User | null> {
  const row = await getPrismaClient().user.findUnique({
    where: { email }
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role
  };
}

async function getSettings(): Promise<SystemSetting[]> {
  const rows = await getPrismaClient().systemSetting.findMany({
    orderBy: { key: "asc" }
  });

  return rows.map((row: any) => ({
    key: row.key,
    value: row.value,
    updatedAt: row.updatedAt.toISOString()
  }));
}

async function upsertSetting(key: string, value: string): Promise<SystemSetting> {
  const row = await getPrismaClient().systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });

  return {
    key: row.key,
    value: row.value,
    updatedAt: row.updatedAt.toISOString()
  };
}

async function getAuditLogs(): Promise<AuditLog[]> {
  const rows = await getPrismaClient().auditLog.findMany({
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => ({
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString()
  }));
}

async function createAuditLog(entry: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
  const row = await getPrismaClient().auditLog.create({
    data: entry
  });

  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString()
  };
}

async function getJobs(): Promise<BackgroundJob[]> {
  const rows = await getPrismaClient().backgroundJob.findMany({
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toBackgroundJob(row));
}

async function createJob(input: Omit<BackgroundJob, "id" | "createdAt" | "updatedAt">): Promise<BackgroundJob> {
  const row = await getPrismaClient().backgroundJob.create({
    data: {
      queue: input.queue,
      type: input.type,
      status: input.status,
      attempts: input.attempts,
      maxAttempts: input.maxAttempts,
      payload: input.payload as never,
      lastError: input.lastError ?? null
    }
  });

  return toBackgroundJob(row);
}

async function claimNextJob(): Promise<BackgroundJob | null> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx: any) => {
    const candidate = await tx.backgroundJob.findFirst({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" }
    });

    if (!candidate) {
      return null;
    }

    const updated = await tx.backgroundJob.updateMany({
      where: {
        id: candidate.id,
        status: "queued"
      },
      data: {
        status: "running",
        attempts: { increment: 1 }
      }
    });

    if (updated.count === 0) {
      return null;
    }

    const claimed = await tx.backgroundJob.findUnique({
      where: { id: candidate.id }
    });

    return claimed ? toBackgroundJob(claimed) : null;
  });
}

async function completeJob(jobId: string): Promise<BackgroundJob | null> {
  const row = await getPrismaClient().backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      lastError: null
    }
  });

  return toBackgroundJob(row);
}

async function failJob(jobId: string, errorMessage: string): Promise<BackgroundJob | null> {
  const prisma = getPrismaClient();
  const current = await prisma.backgroundJob.findUnique({
    where: { id: jobId }
  });

  if (!current) {
    return null;
  }

  const shouldRetry = current.attempts < current.maxAttempts;
  const row = await prisma.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: shouldRetry ? "queued" : "failed",
      lastError: errorMessage
    }
  });

  return toBackgroundJob(row);
}

async function getJobStats(): Promise<Record<BackgroundJob["status"], number>> {
  const grouped = await getPrismaClient().backgroundJob.groupBy({
    by: ["status"],
    _count: { status: true }
  });

  return (grouped as Array<{ status: BackgroundJob["status"]; _count: { status: number } }>).reduce(
    (acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    },
    {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0
    }
  );
}

type CompanyWithRelations = Company & {
  contacts: CompanyContact[];
  score: CompanyScore | null;
};

async function getCompanies(): Promise<CompanyWithRelations[]> {
  const rows = await getPrismaClient().company.findMany({
    include: {
      contacts: true,
      scores: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return rows.map((row: any) => ({
    ...withOptional(
      {
        id: row.id,
        name: row.name,
        industryId: row.industryId,
        region: row.region,
        size: toCompanySize(row.size),
        stage: row.stage
      },
      "website",
      row.website ?? undefined
    ),
    contacts: row.contacts.map((contact: any) =>
      withOptional(
        withOptional(
          {
            id: contact.id,
            companyId: contact.companyId,
            fullName: contact.fullName,
            title: contact.title
          },
          "email",
          contact.email ?? undefined
        ),
        "linkedinUrl",
        contact.linkedinUrl ?? undefined
      )
    ),
    score: row.scores[0]
      ? {
          companyId: row.scores[0].companyId,
          total: row.scores[0].total,
          competencyFit: row.scores[0].competencyFit,
          reputation: row.scores[0].reputation,
          educationReadiness: row.scores[0].educationReadiness
        }
      : null
  }));
}

async function getIndustrySources(): Promise<IndustrySource[]> {
  const rows = await getPrismaClient().industrySource.findMany({
    orderBy: [{ industryId: "asc" }, { source: "asc" }]
  });

  return rows.map((row: any) => toIndustrySource(row));
}

async function getIndustrySourceByKind(industryId: string, source: SourceKind): Promise<IndustrySource | null> {
  const row = await getPrismaClient().industrySource.findUnique({
    where: {
      industryId_source: {
        industryId,
        source
      }
    }
  });

  return row ? toIndustrySource(row) : null;
}

async function upsertIndustrySource(input: {
  industryId: string;
  source: SourceKind;
  status: IndustrySource["status"];
  config: Record<string, string | number | boolean | null>;
}): Promise<IndustrySource> {
  const row = await getPrismaClient().industrySource.upsert({
    where: {
      industryId_source: {
        industryId: input.industryId,
        source: input.source
      }
    },
    update: {
      status: input.status,
      config: input.config as never
    },
    create: {
      industryId: input.industryId,
      source: input.source,
      status: input.status,
      config: input.config as never
    }
  });

  return toIndustrySource(row);
}

async function getIngestionRuns(): Promise<IngestionRun[]> {
  const rows = await getPrismaClient().ingestionRun.findMany({
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toIngestionRun(row));
}

async function createIngestionRun(input: {
  industryId: string;
  sourceId: string;
  status: IngestionRun["status"];
  query: string;
  page?: number;
  perPage?: number;
}): Promise<IngestionRun> {
  const row = await getPrismaClient().ingestionRun.create({
    data: {
      industryId: input.industryId,
      sourceId: input.sourceId,
      status: input.status,
      query: input.query,
      page: input.page ?? null,
      perPage: input.perPage ?? null
    }
  });

  return toIngestionRun(row);
}

async function updateIngestionRun(
  id: string,
  input: Partial<{
    status: IngestionRun["status"];
    totalFound: number;
    processedCount: number;
    competencyCount: number;
    startedAt: string;
    finishedAt: string;
    errorMessage: string | null;
  }>
): Promise<IngestionRun> {
  const data: Record<string, unknown> = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.totalFound !== undefined) {
    data.totalFound = input.totalFound;
  }
  if (input.processedCount !== undefined) {
    data.processedCount = input.processedCount;
  }
  if (input.competencyCount !== undefined) {
    data.competencyCount = input.competencyCount;
  }
  if (input.startedAt !== undefined) {
    data.startedAt = input.startedAt ? new Date(input.startedAt) : null;
  }
  if (input.finishedAt !== undefined) {
    data.finishedAt = input.finishedAt ? new Date(input.finishedAt) : null;
  }
  if (input.errorMessage !== undefined) {
    data.errorMessage = input.errorMessage;
  }

  const row = await getPrismaClient().ingestionRun.update({
    where: { id },
    data: data as never
  });

  return toIngestionRun(row);
}

async function getCompetencyGapMatrix(): Promise<
  Array<{
    competencyId: string;
    competencyName: string;
    category: string;
    programCoverage: number;
    marketDemand: number;
    gapScore: number;
  }>
> {
  const prisma = getPrismaClient();
  const competencies = await prisma.competency.findMany({
    include: {
      programMappings: true,
      vacancyMappings: true
    },
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });

  return competencies.map((competency: any) => {
    const programCoverage =
      competency.programMappings.reduce((sum: number, item: any) => sum + item.coverageScore, 0) /
        Math.max(competency.programMappings.length, 1) || 0;
    const marketDemand = competency.vacancyMappings.length;
    return {
      competencyId: competency.id,
      competencyName: competency.name,
      category: competency.category,
      programCoverage: Math.round(programCoverage),
      marketDemand,
      gapScore: Math.max(0, marketDemand * 10 - Math.round(programCoverage))
    };
  });
}

async function getSnapshot(): Promise<Pick<
  PlatformSnapshot,
  | "industries"
  | "competencies"
  | "programCompetencies"
  | "vacancies"
  | "sources"
  | "ingestionRuns"
  | "companies"
  | "contacts"
  | "scores"
  | "users"
  | "settings"
  | "auditLogs"
  | "jobs"
>> {
  const [industries, competencies, programCompetencies, vacancies, sources, ingestionRuns, users, settings, auditLogs, jobs, companies] =
    await Promise.all([
      getIndustries(),
      getCompetencies(),
      getProgramCompetencies(),
      getVacancies(),
      getIndustrySources(),
      getIngestionRuns(),
      getUsers(),
      getSettings(),
      getAuditLogs(),
      getJobs(),
      getCompanies()
    ]);

  const plainCompanies: Company[] = companies.map(({ contacts: _contacts, score: _score, ...company }) => company);
  const contacts = companies.flatMap((company) => company.contacts);
  const scores = companies.flatMap((company) => (company.score ? [company.score] : []));

  return {
    industries,
    competencies,
    programCompetencies,
    vacancies,
    sources,
    ingestionRuns,
    companies: plainCompanies,
    contacts,
    scores,
    users,
    settings,
    auditLogs,
    jobs
  };
}

export async function canReachDatabase(): Promise<boolean> {
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await getPrismaClient().$disconnect();
}

export const database = {
  canReachDatabase,
  getIndustries,
  getCompetencies,
  upsertCompetencyByName,
  getProgramCompetencies,
  getVacancies,
  createOrUpdateVacancy,
  getUsers,
  findUserByEmail,
  getSettings,
  upsertSetting,
  getAuditLogs,
  createAuditLog,
  getJobs,
  getJobStats,
  createJob,
  claimNextJob,
  completeJob,
  failJob,
  getCompanies,
  getIndustrySources,
  getIndustrySourceByKind,
  upsertIndustrySource,
  getIngestionRuns,
  createIngestionRun,
  updateIngestionRun,
  getCompetencyGapMatrix,
  getSnapshot
};
