import { recommendAdaptiveStrategy } from "@edagent/ai";
import { PrismaClient } from "@prisma/client";
import type {
  AdaptiveRecommendation,
  AdaptiveRecommendationStats,
  AgentMemoryEvent,
  AuditLog,
  BackgroundJob,
  Company,
  CompanyContact,
  CompanyScore,
  CompanyStage,
  Competency,
  Industry,
  IndustrySource,
  IngestionRun,
  Message,
  MessageDraft,
  MessageEvent,
  MessageEventType,
  MessageKind,
  MessageStatus,
  OutreachCampaign,
  PartnerAgreement,
  PlatformSnapshot,
  ProjectBrief,
  ProjectRole,
  ProgramCompetency,
  MemoryOverview,
  Reply,
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

function toMessageKind(value: "outreach_email" | "follow_up_email"): MessageKind {
  return value === "follow_up_email" ? "follow-up-email" : "outreach-email";
}

function fromMessageKind(value: MessageKind): "outreach_email" | "follow_up_email" {
  return value === "follow-up-email" ? "follow_up_email" : "outreach_email";
}

function toMessageEventType(
  value: "queued" | "sent" | "delivered" | "replied" | "failed" | "follow_up_scheduled" | "escalated"
): MessageEventType {
  return value === "follow_up_scheduled" ? "follow-up-scheduled" : value;
}

function fromMessageEventType(
  value: MessageEventType
): "queued" | "sent" | "delivered" | "replied" | "failed" | "follow_up_scheduled" | "escalated" {
  return value === "follow-up-scheduled" ? "follow_up_scheduled" : value;
}

function toMessage(row: any): Message {
  let message: Message = {
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    channel: row.channel,
    kind: toMessageKind(row.kind),
    provider: row.provider,
    status: row.status as MessageStatus,
    subject: row.subject,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  message = withOptional(message, "draftId", row.draftId ?? undefined);
  message = withOptional(message, "campaignId", row.campaignId ?? undefined);
  message = withOptional(message, "parentMessageId", row.parentMessageId ?? undefined);
  message = withOptional(message, "providerMessageId", row.providerMessageId ?? undefined);
  message = withOptional(message, "lastError", row.lastError ?? undefined);
  message = withOptional(message, "followUpDueAt", row.followUpDueAt ? row.followUpDueAt.toISOString() : undefined);
  message = withOptional(message, "sentAt", row.sentAt ? row.sentAt.toISOString() : undefined);
  message = withOptional(message, "deliveredAt", row.deliveredAt ? row.deliveredAt.toISOString() : undefined);
  message = withOptional(message, "repliedAt", row.repliedAt ? row.repliedAt.toISOString() : undefined);
  return message;
}

function toMessageEvent(row: any): MessageEvent {
  return {
    id: row.id,
    messageId: row.messageId,
    type: toMessageEventType(row.type),
    payload: jsonRecord(row.payload),
    createdAt: row.createdAt.toISOString()
  };
}

function toOutreachCampaign(row: any): OutreachCampaign {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function jsonRoles(input: unknown): ProjectRole[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const title = typeof (item as { title?: unknown }).title === "string" ? (item as { title: string }).title : null;
    const summary =
      typeof (item as { summary?: unknown }).summary === "string" ? (item as { summary: string }).summary : null;

    if (!title || !summary) {
      return [];
    }

    return [{ title, summary }];
  });
}

function toPartnerAgreement(row: any): PartnerAgreement {
  let agreement: PartnerAgreement = {
    id: row.id,
    companyId: row.companyId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  agreement = withOptional(agreement, "signedAt", row.signedAt ? row.signedAt.toISOString() : undefined);
  return agreement;
}

function toProjectBrief(row: any): ProjectBrief {
  return {
    id: row.id,
    partnerAgreementId: row.partnerAgreementId,
    title: row.title,
    summary: row.summary,
    roles: jsonRoles(row.roles),
    competencyIds: Array.isArray(row.competencies) ? row.competencies.map((item: any) => item.competencyId) : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toReply(row: any): Reply {
  let reply: Reply = {
    id: row.id,
    companyId: row.companyId,
    category: row.category,
    summary: row.summary,
    positive: row.positive,
    escalated: row.escalated,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  reply = withOptional(reply, "messageId", row.messageId ?? undefined);
  reply = withOptional(reply, "incomingFrom", row.incomingFrom ?? undefined);
  reply = withOptional(reply, "rawBody", row.rawBody ?? undefined);
  return reply;
}

function toMemoryEvent(row: any): AgentMemoryEvent {
  let event: AgentMemoryEvent = {
    id: row.id,
    eventType: row.eventType,
    payload: jsonRecord(row.payload),
    createdAt: row.createdAt.toISOString()
  };

  event = withOptional(event, "companyId", row.companyId ?? undefined);
  return event;
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

async function getVacanciesByIndustry(industryId: string): Promise<Vacancy[]> {
  const rows = await getPrismaClient().vacancy.findMany({
    where: { industryId },
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

function mapCompanyWithRelations(row: any): CompanyWithRelations {
  return {
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
  };
}

async function getCompanies(input?: { industryId?: string; stage?: CompanyStage }): Promise<CompanyWithRelations[]> {
  const rows = await getPrismaClient().company.findMany({
    where: {
      ...(input?.industryId ? { industryId: input.industryId } : {}),
      ...(input?.stage ? { stage: input.stage } : {})
    },
    include: {
      contacts: true,
      scores: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "asc" }
  });

  return rows.map((row: any) => mapCompanyWithRelations(row));
}

async function upsertCompany(input: {
  name: string;
  industryId: string;
  region: string;
  size: Company["size"];
  stage: CompanyStage;
  website?: string;
}): Promise<Company> {
  const prisma = getPrismaClient();
  const existing = await prisma.company.findFirst({
    where: {
      industryId: input.industryId,
      name: input.name
    }
  });

  const size = (input.size === "mid-market" ? "mid_market" : input.size) as never;

  const data = {
    name: input.name,
    industryId: input.industryId,
    region: input.region,
    size,
    stage: input.stage,
    website: input.website ?? existing?.website ?? null
  };

  const row = existing
    ? await prisma.company.update({
        where: { id: existing.id },
        data
      })
    : await prisma.company.create({
        data
      });

  return withOptional(
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
  );
}

async function updateCompanyStage(companyId: string, stage: CompanyStage): Promise<Company | null> {
  const row = await getPrismaClient().company.update({
    where: { id: companyId },
    data: { stage }
  });

  return withOptional(
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
  );
}

async function upsertCompanyContact(input: {
  companyId: string;
  fullName: string;
  title: string;
  email?: string;
  linkedinUrl?: string;
}): Promise<CompanyContact> {
  const prisma = getPrismaClient();
  const existing = await prisma.companyContact.findFirst({
    where: {
      companyId: input.companyId,
      fullName: input.fullName
    }
  });

  const data = {
    companyId: input.companyId,
    fullName: input.fullName,
    title: input.title,
    email: input.email ?? existing?.email ?? null,
    linkedinUrl: input.linkedinUrl ?? existing?.linkedinUrl ?? null
  };

  const row = existing
    ? await prisma.companyContact.update({
        where: { id: existing.id },
        data
      })
    : await prisma.companyContact.create({
        data
      });

  return withOptional(
    withOptional(
      {
        id: row.id,
        companyId: row.companyId,
        fullName: row.fullName,
        title: row.title
      },
      "email",
      row.email ?? undefined
    ),
    "linkedinUrl",
    row.linkedinUrl ?? undefined
  );
}

async function createCompanyScore(input: CompanyScore): Promise<CompanyScore> {
  const row = await getPrismaClient().companyScore.create({
    data: {
      companyId: input.companyId,
      total: input.total,
      competencyFit: input.competencyFit,
      reputation: input.reputation,
      educationReadiness: input.educationReadiness
    }
  });

  return {
    companyId: row.companyId,
    total: row.total,
    competencyFit: row.competencyFit,
    reputation: row.reputation,
    educationReadiness: row.educationReadiness
  };
}

async function getCompanyById(companyId: string): Promise<CompanyWithRelations | null> {
  const row = await getPrismaClient().company.findUnique({
    where: { id: companyId },
    include: {
      contacts: true,
      scores: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      industry: true
    }
  });

  return row ? mapCompanyWithRelations(row) : null;
}

async function getMessageDrafts(input?: {
  companyId?: string;
  contactId?: string;
  approved?: boolean;
}): Promise<MessageDraft[]> {
  const rows = await getPrismaClient().messageDraft.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.contactId ? { contactId: input.contactId } : {}),
      ...(input?.approved !== undefined ? { approved: input.approved } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => ({
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    subject: row.subject,
    body: row.body,
    tone: row.tone,
    approved: row.approved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

async function createMessageDraft(input: Omit<MessageDraft, "id" | "createdAt" | "updatedAt">): Promise<MessageDraft> {
  const row = await getPrismaClient().messageDraft.create({
    data: {
      companyId: input.companyId,
      contactId: input.contactId,
      subject: input.subject,
      body: input.body,
      tone: input.tone,
      approved: input.approved
    }
  });

  return {
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    subject: row.subject,
    body: row.body,
    tone: row.tone,
    approved: row.approved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function updateMessageDraftApproval(id: string, approved: boolean): Promise<MessageDraft | null> {
  const row = await getPrismaClient().messageDraft.update({
    where: { id },
    data: { approved }
  });

  return {
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    subject: row.subject,
    body: row.body,
    tone: row.tone,
    approved: row.approved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function getOutreachCampaigns(): Promise<OutreachCampaign[]> {
  const rows = await getPrismaClient().outreachCampaign.findMany({
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toOutreachCampaign(row));
}

async function createOutreachCampaign(input: Omit<OutreachCampaign, "id" | "createdAt" | "updatedAt">): Promise<OutreachCampaign> {
  const row = await getPrismaClient().outreachCampaign.create({
    data: {
      name: input.name,
      channel: input.channel,
      status: input.status
    }
  });

  return toOutreachCampaign(row);
}

async function updateOutreachCampaignStatus(id: string, status: OutreachCampaign["status"]): Promise<OutreachCampaign> {
  const row = await getPrismaClient().outreachCampaign.update({
    where: { id },
    data: { status }
  });

  return toOutreachCampaign(row);
}

async function getMessageDraftById(id: string): Promise<MessageDraft | null> {
  const row = await getPrismaClient().messageDraft.findUnique({
    where: { id }
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    subject: row.subject,
    body: row.body,
    tone: row.tone,
    approved: row.approved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

async function getMessages(input?: {
  companyId?: string;
  campaignId?: string;
  status?: MessageStatus;
  kind?: MessageKind;
}): Promise<Message[]> {
  const rows = await getPrismaClient().message.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input?.status ? { status: input.status } : {}),
      ...(input?.kind ? { kind: fromMessageKind(input.kind) } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toMessage(row));
}

async function getMessageById(id: string): Promise<Message | null> {
  const row = await getPrismaClient().message.findUnique({
    where: { id }
  });

  return row ? toMessage(row) : null;
}

async function createMessage(input: Omit<Message, "id" | "createdAt" | "updatedAt">): Promise<Message> {
  const row = await getPrismaClient().message.create({
    data: {
      companyId: input.companyId,
      contactId: input.contactId,
      draftId: input.draftId ?? null,
      campaignId: input.campaignId ?? null,
      parentMessageId: input.parentMessageId ?? null,
      channel: input.channel,
      kind: fromMessageKind(input.kind),
      provider: input.provider,
      providerMessageId: input.providerMessageId ?? null,
      status: input.status,
      subject: input.subject,
      body: input.body,
      lastError: input.lastError ?? null,
      followUpDueAt: input.followUpDueAt ? new Date(input.followUpDueAt) : null,
      sentAt: input.sentAt ? new Date(input.sentAt) : null,
      deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
      repliedAt: input.repliedAt ? new Date(input.repliedAt) : null
    }
  });

  return toMessage(row);
}

async function updateMessage(id: string, input: Partial<{
  status: MessageStatus;
  provider: string;
  providerMessageId: string | null;
  lastError: string | null;
  followUpDueAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  repliedAt: string | null;
}>): Promise<Message> {
  const data: Record<string, unknown> = {};
  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.provider !== undefined) {
    data.provider = input.provider;
  }
  if (input.providerMessageId !== undefined) {
    data.providerMessageId = input.providerMessageId;
  }
  if (input.lastError !== undefined) {
    data.lastError = input.lastError;
  }
  if (input.followUpDueAt !== undefined) {
    data.followUpDueAt = input.followUpDueAt ? new Date(input.followUpDueAt) : null;
  }
  if (input.sentAt !== undefined) {
    data.sentAt = input.sentAt ? new Date(input.sentAt) : null;
  }
  if (input.deliveredAt !== undefined) {
    data.deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : null;
  }
  if (input.repliedAt !== undefined) {
    data.repliedAt = input.repliedAt ? new Date(input.repliedAt) : null;
  }

  const row = await getPrismaClient().message.update({
    where: { id },
    data: data as never
  });

  return toMessage(row);
}

async function getMessageEvents(input?: { messageId?: string; type?: MessageEventType }): Promise<MessageEvent[]> {
  const rows = await getPrismaClient().messageEvent.findMany({
    where: {
      ...(input?.messageId ? { messageId: input.messageId } : {}),
      ...(input?.type ? { type: fromMessageEventType(input.type) } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toMessageEvent(row));
}

async function createMessageEvent(input: {
  messageId: string;
  type: MessageEventType;
  payload: Record<string, string | number | boolean | null>;
}): Promise<MessageEvent> {
  const row = await getPrismaClient().messageEvent.create({
    data: {
      messageId: input.messageId,
      type: fromMessageEventType(input.type),
      payload: input.payload as never
    }
  });

  return toMessageEvent(row);
}

async function getReplies(input?: { companyId?: string; category?: Reply["category"] }): Promise<Reply[]> {
  const rows = await getPrismaClient().reply.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.category ? { category: input.category } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toReply(row));
}

async function createReply(input: Omit<Reply, "id" | "createdAt" | "updatedAt">): Promise<Reply> {
  const row = await getPrismaClient().reply.create({
    data: {
      messageId: input.messageId ?? null,
      companyId: input.companyId,
      category: input.category,
      summary: input.summary,
      incomingFrom: input.incomingFrom ?? null,
      rawBody: input.rawBody ?? null,
      positive: input.positive,
      escalated: input.escalated
    }
  });

  return toReply(row);
}

async function createMemoryEvent(input: {
  companyId?: string;
  eventType: string;
  payload: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await getPrismaClient().agentMemoryEvent.create({
    data: {
      companyId: input.companyId ?? null,
      eventType: input.eventType,
      payload: input.payload as never
    }
  });
}

async function getMemoryEvents(input?: {
  companyId?: string;
  eventType?: string;
  limit?: number;
}): Promise<AgentMemoryEvent[]> {
  const rows = await getPrismaClient().agentMemoryEvent.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.eventType ? { eventType: input.eventType } : {})
    },
    orderBy: { createdAt: "desc" },
    ...(input?.limit ? { take: input.limit } : {})
  });

  return rows.map((row: any) => toMemoryEvent(row));
}

function buildAdaptiveStatsFromEvents(events: AgentMemoryEvent[]): AdaptiveRecommendationStats {
  const stats: AdaptiveRecommendationStats = {
    eventCount: events.length,
    totalReplies: 0,
    positiveReplies: 0,
    meetingReplies: 0,
    declineReplies: 0,
    questionReplies: 0,
    outreachSent: 0,
    followUpsSent: 0,
    positiveByTone: {} as Partial<Record<"formal" | "neutral" | "friendly", number>>,
    negativeByTone: {} as Partial<Record<"formal" | "neutral" | "friendly", number>>
  };

  for (const event of events) {
    if (event.eventType === "outreach_delivered") {
      stats.outreachSent += 1;
    }
    if (event.eventType === "follow_up_sent") {
      stats.followUpsSent += 1;
    }
    if (event.eventType === "reply_received") {
      stats.totalReplies += 1;
      const category = typeof event.payload.category === "string" ? event.payload.category : "";
      const positive = event.payload.positive === true;
      const tone =
        typeof event.payload.tone === "string" &&
        ["formal", "neutral", "friendly"].includes(event.payload.tone)
          ? (event.payload.tone as "formal" | "neutral" | "friendly")
          : null;

      if (positive) {
        stats.positiveReplies += 1;
      }
      if (category === "meeting") {
        stats.meetingReplies += 1;
      } else if (category === "decline") {
        stats.declineReplies += 1;
      } else if (category === "question") {
        stats.questionReplies += 1;
      }

      if (tone) {
        if (positive) {
          stats.positiveByTone[tone] = (stats.positiveByTone[tone] ?? 0) + 1;
        } else {
          stats.negativeByTone[tone] = (stats.negativeByTone[tone] ?? 0) + 1;
        }
      }
    }
  }

  return stats;
}

function buildRecommendationFromStats(
  scope: "company" | "global",
  stats: AdaptiveRecommendationStats
): AdaptiveRecommendation {
  const recommendation = recommendAdaptiveStrategy(stats);
  return {
    scope,
    recommendedTone: recommendation.recommendedTone,
    recommendedFollowUpDays: recommendation.recommendedFollowUpDays,
    confidence: recommendation.confidence,
    basedOnEvents: stats.eventCount,
    totalReplies: stats.totalReplies,
    positiveReplyRate: recommendation.positiveReplyRate,
    meetingRate: recommendation.meetingRate,
    reasons: recommendation.reasons
  };
}

async function getAdaptiveRecommendationStats(companyId?: string): Promise<AdaptiveRecommendationStats> {
  const events = companyId ? await getMemoryEvents({ companyId, limit: 200 }) : await getMemoryEvents({ limit: 400 });
  return buildAdaptiveStatsFromEvents(events);
}

async function getAdaptiveRecommendation(companyId?: string): Promise<AdaptiveRecommendation> {
  const companyEvents = companyId ? await getMemoryEvents({ companyId, limit: 200 }) : [];
  if (companyEvents.length > 0) {
    return buildRecommendationFromStats("company", buildAdaptiveStatsFromEvents(companyEvents));
  }

  const globalEvents = await getMemoryEvents({ limit: 400 });
  return buildRecommendationFromStats("global", buildAdaptiveStatsFromEvents(globalEvents));
}

async function getMemoryOverview(companyId?: string): Promise<MemoryOverview> {
  const [allEvents, recentEvents, replies, recommendation] = await Promise.all([
    getMemoryEvents(companyId ? { companyId, limit: 400 } : { limit: 400 }),
    getMemoryEvents(companyId ? { companyId, limit: 12 } : { limit: 12 }),
    getReplies(companyId ? { companyId } : undefined),
    getAdaptiveRecommendation(companyId)
  ]);

  const counts = new Map<string, number>();
  for (const event of allEvents) {
    counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
  }

  const topEventTypes = Array.from(counts.entries())
    .map(([eventType, count]) => ({ eventType, count }))
    .sort((left, right) => right.count - left.count || left.eventType.localeCompare(right.eventType))
    .slice(0, 8);

  return {
    ...(companyId ? { companyId } : {}),
    eventCount: allEvents.length,
    replyCount: replies.length,
    recentEvents,
    topEventTypes,
    recommendation
  };
}

async function getPendingFollowUpMessages(dueBefore: string): Promise<Message[]> {
  const rows = await getPrismaClient().message.findMany({
    where: {
      kind: "outreach_email",
      status: {
        in: ["sent", "delivered"]
      },
      followUpDueAt: {
        lte: new Date(dueBefore)
      },
      reply: null,
      followUps: {
        none: {}
      }
    },
    orderBy: { followUpDueAt: "asc" }
  });

  return rows.map((row: any) => toMessage(row));
}

async function getPartnerAgreements(input?: { companyId?: string; status?: PartnerAgreement["status"] }): Promise<PartnerAgreement[]> {
  const rows = await getPrismaClient().partnerAgreement.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.status ? { status: input.status } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toPartnerAgreement(row));
}

async function createPartnerAgreement(input: Omit<PartnerAgreement, "id" | "createdAt" | "updatedAt">): Promise<PartnerAgreement> {
  const row = await getPrismaClient().partnerAgreement.create({
    data: {
      companyId: input.companyId,
      status: input.status,
      signedAt: input.signedAt ? new Date(input.signedAt) : null
    }
  });

  return toPartnerAgreement(row);
}

async function updatePartnerAgreementStatus(
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

async function getPartnerAgreementById(id: string): Promise<PartnerAgreement | null> {
  const row = await getPrismaClient().partnerAgreement.findUnique({
    where: { id }
  });

  return row ? toPartnerAgreement(row) : null;
}

async function getProjectBriefs(input?: { partnerAgreementId?: string }): Promise<ProjectBrief[]> {
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

async function createProjectBrief(input: Omit<ProjectBrief, "id" | "createdAt" | "updatedAt">): Promise<ProjectBrief> {
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

async function getProjectCatalog(): Promise<
  Array<
    ProjectBrief & {
      agreementStatus: PartnerAgreement["status"];
      companyId: string;
      companyName: string;
    }
  >
> {
  const rows = await getPrismaClient().projectBrief.findMany({
    include: {
      competencies: true,
      partnerAgreement: {
        include: {
          company: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => ({
    ...toProjectBrief(row),
    agreementStatus: row.partnerAgreement.status,
    companyId: row.partnerAgreement.companyId,
    companyName: row.partnerAgreement.company.name
  }));
}

async function getShortlist(input?: {
  industryId?: string;
  minimumScore?: number;
  limit?: number;
}): Promise<CompanyWithRelations[]> {
  const companies = await getCompanies(
    input?.industryId
      ? {
          industryId: input.industryId
        }
      : undefined
  );

  return companies
    .filter((company) => {
      const manuallyShortlisted = company.stage === "shortlisted" || company.stage === "approved";
      return manuallyShortlisted || (company.score?.total ?? 0) >= (input?.minimumScore ?? 75);
    })
    .sort((left, right) => (right.score?.total ?? 0) - (left.score?.total ?? 0))
    .slice(0, input?.limit ?? 10);
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
  | "campaigns"
  | "drafts"
  | "messages"
  | "messageEvents"
  | "replies"
  | "agreements"
  | "briefs"
  | "memoryEvents"
  | "users"
  | "settings"
  | "auditLogs"
  | "jobs"
>> {
  const [
    industries,
    competencies,
    programCompetencies,
    vacancies,
    sources,
    ingestionRuns,
    users,
    settings,
    auditLogs,
    jobs,
    companies,
    campaigns,
    drafts,
    messages,
    messageEvents,
    replies,
    agreements,
    briefs,
    memoryEvents
  ] =
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
      getCompanies(),
      getOutreachCampaigns(),
      getMessageDrafts(),
      getMessages(),
      getMessageEvents(),
      getReplies(),
      getPartnerAgreements(),
      getProjectBriefs(),
      getMemoryEvents()
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
    campaigns,
    drafts,
    messages,
    messageEvents,
    replies,
    agreements,
    briefs,
    memoryEvents,
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
  getVacanciesByIndustry,
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
  getCompanyById,
  upsertCompany,
  updateCompanyStage,
  upsertCompanyContact,
  createCompanyScore,
  getShortlist,
  getOutreachCampaigns,
  createOutreachCampaign,
  updateOutreachCampaignStatus,
  getMessageDrafts,
  getMessageDraftById,
  createMessageDraft,
  updateMessageDraftApproval,
  getMessages,
  getMessageById,
  createMessage,
  updateMessage,
  getMessageEvents,
  createMessageEvent,
  getReplies,
  createReply,
  createMemoryEvent,
  getMemoryEvents,
  getAdaptiveRecommendationStats,
  getAdaptiveRecommendation,
  getMemoryOverview,
  getPendingFollowUpMessages,
  getPartnerAgreements,
  getPartnerAgreementById,
  createPartnerAgreement,
  updatePartnerAgreementStatus,
  getProjectBriefs,
  createProjectBrief,
  getProjectCatalog,
  getIndustrySources,
  getIndustrySourceByKind,
  upsertIndustrySource,
  getIngestionRuns,
  createIngestionRun,
  updateIngestionRun,
  getCompetencyGapMatrix,
  getSnapshot
};
