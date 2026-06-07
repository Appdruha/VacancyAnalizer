import { recommendAdaptiveStrategy } from "@edagent/ai";
import type {
  AdaptiveRecommendation,
  AdaptiveRecommendationStats,
  AgentMemoryEvent,
  Company,
  CompanyContact,
  CompanyScore,
  CommunicationPackage,
  CompanyStage,
  IndustrySource,
  IngestionRun,
  KnowledgeChunk,
  KnowledgeDocument,
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
  MemoryOverview,
  Reply,
  SourceKind,
  Vacancy
} from "@edagent/domain";
import { getPrismaClient } from "./client.js";
import {
  toBackgroundJob,
  toCommunicationPackage,
  toIngestionRun,
  toIndustrySource,
  toMemoryEvent,
  toMessage,
  toMessageEvent,
  toOutreachCampaign,
  toPartnerAgreement,
  toProjectBrief,
  toReply,
  toVacancy
} from "./mappers.js";
import {
  fromCommunicationPackageKind,
  fromMessageEventType,
  fromMessageKind,
  jsonRecord,
  toCompanySize,
  withOptional
} from "./shared.js";
import {
  createOrUpdateVacancy,
  getCompetencies,
  getIndustries,
  getProgramCompetencies,
  getVacancies,
  getVacanciesByIndustry,
  replaceProgramCompetencies,
  upsertCompetencyByName,
  upsertIndustry
} from "./repositories/industry.js";
import {
  createCompanyScore,
  getCompanies,
  getCompanyById,
  getShortlist,
  updateCompanyStage,
  upsertCompany,
  upsertCompanyContact,
  type CompanyWithRelations
} from "./repositories/company.js";
import {
  createMemoryEvent,
  getAdaptiveRecommendation,
  getAdaptiveRecommendationStats,
  getMemoryEvents,
  getMemoryOverview
} from "./repositories/memory.js";
import {
  getKnowledgeDocuments,
  replaceKnowledgeChunks,
  searchKnowledgeChunks,
  upsertKnowledgeDocument
} from "./repositories/rag.js";
import {
  createCommunicationPackage,
  createPartnerAgreement,
  createProjectBrief,
  getCommunicationPackages,
  getPartnerAgreementById,
  getPartnerAgreements,
  getProjectBriefs,
  getProjectCatalog,
  updatePartnerAgreementStatus
} from "./repositories/project.js";
import {
  createMessage,
  createMessageDraft,
  createMessageEvent,
  createOutreachCampaign,
  createReply,
  getMessageById,
  getMessageDraftById,
  getMessageDrafts,
  getMessageEvents,
  getMessages,
  getOutreachCampaigns,
  getPendingFollowUpMessages,
  getReplies,
  updateMessage,
  updateMessageDraftApproval,
  updateOutreachCampaignStatus
} from "./repositories/outreach.js";
import {
  claimNextJob,
  completeJob,
  createAuditLog,
  createJob,
  ensureSystemBootstrap,
  failJob,
  findUserByEmail,
  getAuditLogs,
  getJobStats,
  getJobs,
  getSettings,
  getUsers,
  upsertSetting,
  upsertUserByEmail
} from "./repositories/system.js";

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
  | "communicationPackages"
  | "memoryEvents"
  | "knowledgeDocuments"
  | "knowledgeChunks"
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
    communicationPackages,
    memoryEvents,
    knowledgeDocuments,
    knowledgeChunks
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
      getCommunicationPackages(),
      getMemoryEvents(),
      getKnowledgeDocuments(),
      getKnowledgeDocuments().then(async (documents) => {
        const prisma = getPrismaClient() as any;
        const rows = await prisma.knowledgeChunk.findMany({
          orderBy: [{ createdAt: "desc" }, { chunkIndex: "asc" }]
        });
        return rows.map((row: any) => ({
          id: row.id,
          documentId: row.documentId,
          ...(row.companyId ? { companyId: row.companyId } : {}),
          chunkIndex: row.chunkIndex,
          content: row.content,
          tokenCount: row.tokenCount,
          embedding: Array.isArray(row.embedding) ? row.embedding.filter((item: unknown): item is number => typeof item === "number") : [],
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString()
        })) as KnowledgeChunk[];
      })
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
    communicationPackages,
    memoryEvents,
    knowledgeDocuments,
    knowledgeChunks,
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
  upsertIndustry,
  getCompetencies,
  upsertCompetencyByName,
  getProgramCompetencies,
  replaceProgramCompetencies,
  getVacancies,
  getVacanciesByIndustry,
  createOrUpdateVacancy,
  getUsers,
  ensureSystemBootstrap,
  findUserByEmail,
  upsertUserByEmail,
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
  getCommunicationPackages,
  createCommunicationPackage,
  getKnowledgeDocuments,
  upsertKnowledgeDocument,
  replaceKnowledgeChunks,
  searchKnowledgeChunks,
  getIndustrySources,
  getIndustrySourceByKind,
  upsertIndustrySource,
  getIngestionRuns,
  createIngestionRun,
  updateIngestionRun,
  getCompetencyGapMatrix,
  getSnapshot
};
