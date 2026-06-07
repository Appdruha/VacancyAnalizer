import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type AdaptiveRecommendationStats,
  type Competency,
  type BackgroundJob,
  type CommunicationPackage,
  type Industry,
  type Vacancy,
  type MlEvaluationResult,
  type MlEvaluationSample,
  type Message,
  type MessageDraft,
  type MessageEvent,
  type AgentMemoryEvent,
  type OutreachCampaign,
  type PartnerAgreement,
  type ProjectBrief,
  type Reply,
  type SourceKind,
  type SystemSetting
} from "@edagent/domain";
import {
  type AuditLog,
} from "@edagent/domain";
import { env } from "@edagent/config";
import { database } from "@edagent/database";
import { getMlServiceHealth, runRemoteAdaptiveEvaluation } from "@edagent/integrations";
import { jsonResponse, notFoundResponse, readinessProbe } from "@edagent/shared";
import { explainDiscoveryScore, estimateCompanySize } from "@edagent/scoring";
import { createAuthSession, getAuthenticatedUser, verifyGoogleIdToken, buildGoogleAuthTestPage } from "./lib/auth.js";
import { readBody, send } from "./lib/http.js";
import {
  createAuditEntry,
  createMemoryEntry,
  ensurePlatformBootstrap,
  getAuditActorUserId,
  resolveAdaptiveRecommendation,
  tryDatabase
} from "./lib/platform.js";
import { canAccessRoute } from "./lib/rbac.js";
import {
  agreements,
  auditLogs,
  briefs,
  campaigns,
  createCampaignFallback,
  createJob,
  jobs,
  memoryEvents,
  messageEvents,
  messages,
  replies,
  settings,
  upsertSetting
} from "./lib/runtime-state.js";
import { handleAuthRoutes } from "./routes/auth.js";
import { handleCompanyRoutes } from "./routes/companies.js";
import { handleIndustryRoutes } from "./routes/industry.js";
import { handleMemoryRoutes } from "./routes/memory.js";
import { handleOutreachRoutes } from "./routes/outreach.js";
import { handleProjectRoutes } from "./routes/project.js";
import { handleRagRoutes } from "./routes/rag.js";
import { handleSystemRoutes } from "./routes/system.js";
import { createRagService } from "./services/rag-service.js";

type BootstrapSnapshot = {
  industries: Array<{ id: string; name: string; priority: number; approvedByUserId?: string }>;
  competencies: Array<{ id: string; name: string; category: string }>;
  programCompetencies: Array<{ id: string; programName: string; competencyId: string; coverageScore: number }>;
  vacancies: Array<{
    id: string;
    source: string;
    title: string;
    companyName: string;
    industryId: string;
    competencyIds: string[];
    collectedAt: string;
  }>;
  sources: Array<{
    id: string;
    industryId: string;
    source: SourceKind;
    status: "active" | "disabled";
    config: Record<string, string | number | boolean | null>;
  }>;
  ingestionRuns: Array<{
    id: string;
    industryId: string;
    sourceId: string;
    status: string;
    query: string;
    processedCount: number;
    competencyCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  companies: Array<{
    id: string;
    name: string;
    industryId: string;
    region: string;
    size: string;
    stage: string;
    website?: string;
  }>;
  contacts: Array<{
    id: string;
    companyId: string;
    fullName: string;
    title: string;
    email?: string;
  }>;
  scores: Array<{
    companyId: string;
    total: number;
    competencyFit: number;
    reputation: number;
    educationReadiness: number;
  }>;
  campaigns: OutreachCampaign[];
  drafts: MessageDraft[];
  messages: Message[];
  messageEvents: MessageEvent[];
  replies: Reply[];
  agreements: PartnerAgreement[];
  briefs: ProjectBrief[];
  communicationPackages: CommunicationPackage[];
  memoryEvents: AgentMemoryEvent[];
  users: Array<{ id: string; email: string; fullName: string; role: string }>;
  settings: SystemSetting[];
  auditLogs: AuditLog[];
  jobs: BackgroundJob[];
};

function emptyBootstrapSnapshot(): BootstrapSnapshot {
  return {
    industries: [],
    competencies: [],
    programCompetencies: [],
    vacancies: [],
    sources: [],
    ingestionRuns: [],
    companies: [],
    contacts: [],
    scores: [],
    campaigns: [],
    drafts: [],
    messages: [],
    messageEvents: [],
    replies: [],
    agreements: [],
    briefs: [],
    communicationPackages: [],
    memoryEvents: [],
    users: [],
    settings: [],
    auditLogs: [],
    jobs: []
  };
}

function buildCompanyProfile(input: {
  company: Awaited<ReturnType<typeof database.getCompanyById>>;
  industries: Industry[];
  competencies: Competency[];
  vacancies: Vacancy[];
}) {
  const company = input.company;
  if (!company) {
    return null;
  }

  const industry = input.industries.find((item) => item.id === company.industryId);
  const topCompetencyIds = input.vacancies
    .filter((vacancy) => vacancy.companyName === company.name)
    .flatMap((vacancy) => vacancy.competencyIds);
  const topCompetencies = Array.from(new Set(topCompetencyIds))
    .map((id) => input.competencies.find((item) => item.id === id)?.name)
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
  const primaryContact = company.contacts[0];

  const profile = {
    companyName: company.name,
    industryName: industry?.name ?? "Unknown industry",
    region: company.region,
    stage: company.stage,
    score: company.score,
    topCompetencies
  };

  return {
    ...profile,
    ...(company.website ? { website: company.website } : {}),
    ...(primaryContact?.fullName ? { contactName: primaryContact.fullName } : {}),
    ...(primaryContact?.title ? { contactTitle: primaryContact.title } : {})
  };
}

async function buildCompanyScoreBreakdown(companyId: string) {
  const [company, industries, programCompetencies, vacancies] = await Promise.all([
    database.getCompanyById(companyId),
    database.getIndustries(),
    database.getProgramCompetencies(),
    database.getVacancies()
  ]);

  if (!company) {
    return null;
  }

  const industry = industries.find((item) => item.id === company.industryId);
  const companyVacancies = vacancies.filter((vacancy) => vacancy.companyName === company.name);
  const competencyIds = new Set(companyVacancies.flatMap((item) => item.competencyIds));
  const programCompetencyIds = new Set(programCompetencies.map((item) => item.competencyId));
  const matchedProgramCompetencies = Array.from(competencyIds).filter((id) => programCompetencyIds.has(id)).length;

  return explainDiscoveryScore({
    companyName: company.name,
    industryName: industry?.name ?? "Unknown industry",
    size: company.size || estimateCompanySize(companyVacancies.length),
    vacancyCount: companyVacancies.length,
    matchedProgramCompetencies,
    totalCompanyCompetencies: competencyIds.size,
    contactCount: company.contacts.length,
    hasWebsite: Boolean(company.website),
    region: company.region
  });
}

function buildMlEvaluationBenchmarks(): Array<{
  id: string;
  label: string;
  scenario: "benchmark";
  stats: AdaptiveRecommendationStats;
}> {
  return [
    {
      id: "ml-benchmark-cold-start",
      label: "Cold start without replies",
      scenario: "benchmark",
      stats: {
        eventCount: 1,
        totalReplies: 0,
        positiveReplies: 0,
        meetingReplies: 0,
        declineReplies: 0,
        questionReplies: 0,
        outreachSent: 1,
        followUpsSent: 0,
        positiveByTone: {},
        negativeByTone: {}
      }
    },
    {
      id: "ml-benchmark-meeting-positive",
      label: "Positive thread with meeting intent",
      scenario: "benchmark",
      stats: {
        eventCount: 9,
        totalReplies: 3,
        positiveReplies: 2,
        meetingReplies: 1,
        declineReplies: 0,
        questionReplies: 1,
        outreachSent: 3,
        followUpsSent: 1,
        positiveByTone: {
          friendly: 2
        },
        negativeByTone: {
          formal: 1
        }
      }
    },
    {
      id: "ml-benchmark-decline-heavy",
      label: "Decline-heavy sequence",
      scenario: "benchmark",
      stats: {
        eventCount: 8,
        totalReplies: 3,
        positiveReplies: 0,
        meetingReplies: 0,
        declineReplies: 3,
        questionReplies: 0,
        outreachSent: 4,
        followUpsSent: 2,
        positiveByTone: {},
        negativeByTone: {
          friendly: 2,
          neutral: 1
        }
      }
    },
    {
      id: "ml-benchmark-question-loop",
      label: "Question-heavy operator loop",
      scenario: "benchmark",
      stats: {
        eventCount: 7,
        totalReplies: 2,
        positiveReplies: 0,
        meetingReplies: 0,
        declineReplies: 0,
        questionReplies: 2,
        outreachSent: 2,
        followUpsSent: 1,
        positiveByTone: {},
        negativeByTone: {
          formal: 1
        }
      }
    }
  ];
}

export async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${env.API_PORT}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/health") {
    const databaseReady = await database.canReachDatabase().catch(() => false);

    send(
      res,
      jsonResponse({
        ...readinessProbe("api"),
        app: env.APP_NAME,
        databaseReady
      })
    );
    return;
  }

  const isPublicRoute =
    pathname === "/health" ||
    pathname === "/auth/login" ||
    pathname === "/auth/me" ||
    pathname === "/auth/google" ||
    pathname === "/auth/google/config" ||
    pathname === "/auth/google/test-page";

  if (!isPublicRoute) {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      send(
        res,
        jsonResponse(
          {
            error: "unauthorized",
            message: "Valid bearer token is required."
          },
          401
        )
      );
      return;
    }

    if (!canAccessRoute(user, req.method ?? "GET", pathname)) {
      send(
        res,
        jsonResponse(
          {
            error: "forbidden",
            message: `Role ${user.role} is not allowed to perform this action.`
          },
          403
        )
      );
      return;
    }
  }

  if (
    await handleSystemRoutes(
      { req, res, url, pathname },
      {
        send,
        readBody,
        tryDatabase,
        emptyBootstrapSnapshot,
        settings,
        auditLogs,
        jobs,
        upsertSetting,
        createJob,
        getAuditActorUserId,
        createAuditEntry
      }
    )
  ) {
    return;
  }

  if (
    await handleAuthRoutes(
      { req, res, url, pathname },
      {
        send,
        readBody,
        tryDatabase,
        ensurePlatformBootstrap,
        createAuditEntry,
        createAuthSession,
        buildGoogleAuthTestPage,
        verifyGoogleIdToken,
        getAuthenticatedUser
      }
    )
  ) {
    return;
  }

  if (
    await handleIndustryRoutes(
      { req, res, url, pathname },
      {
        send,
        readBody,
        tryDatabase,
        createJob,
        createAuditEntry,
        ensurePlatformBootstrap
      }
    )
  ) {
    return;
  }

  if (
    await handleCompanyRoutes(
      { req, res, url, pathname },
      {
        send,
        readBody,
        tryDatabase,
        createJob,
        getAuditActorUserId,
        createAuditEntry,
        resolveAdaptiveRecommendation,
        buildCompanyProfile,
        buildCompanyScoreBreakdown
      }
    )
  ) {
    return;
  }

  if (
    await handleRagRoutes(
      { req, res, url, pathname },
      {
        send,
        readBody,
        tryDatabase
      }
    )
  ) {
    return;
  }

  const ragService = createRagService({ tryDatabase });

  if (
    await handleOutreachRoutes(
      { req, res, url, pathname },
      {
        send,
        readBody,
        tryDatabase,
        createJob,
        createCampaignFallback,
        getAuditActorUserId,
        createAuditEntry,
        createMemoryEntry,
        resolveAdaptiveRecommendation,
        buildCompanyProfile,
        retrieveRagContext: (companyId, query, topK) => ragService.retrieveContext(companyId, query, topK),
        campaigns,
        messages,
        messageEvents,
        replies
      }
    )
  ) {
    return;
  }

  if (
    await handleMemoryRoutes(
      { req, res, url, pathname },
      {
        send,
        tryDatabase,
        resolveAdaptiveRecommendation,
        buildMlEvaluationBenchmarks,
        memoryEvents
      }
    )
  ) {
    return;
  }

  if (
    await handleProjectRoutes(
      { req, res, url, pathname },
      {
        send,
        readBody,
        tryDatabase,
        getAuditActorUserId,
        createAuditEntry,
        createMemoryEntry,
        retrieveRagContext: (companyId, query, topK) => ragService.retrieveContext(companyId, query, topK),
        agreements,
        briefs
      }
    )
  ) {
    return;
  }

  send(res, notFoundResponse(pathname));
}
