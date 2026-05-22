import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  generateCompanySummary,
  generateFollowUpDraft,
  generateOutreachDraft,
  generateProjectBrief,
  type DraftTone
} from "@edagent/ai";
import { env } from "@edagent/config";
import { database } from "@edagent/database";
import {
  getMlServiceHealth,
  requestRemoteAdaptiveRecommendation,
  runRemoteAdaptiveEvaluation
} from "@edagent/integrations";
import {
  demoSnapshot,
  type AuditLog,
  type AdaptiveRecommendation,
  type BackgroundJob,
  type CompanyStage,
  type Message,
  type MessageDraft,
  type MessageEvent,
  type MessageKind,
  type MessageStatus,
  type AgentMemoryEvent,
  type OutreachCampaign,
  type PartnerAgreement,
  type ProjectBrief,
  type Reply,
  type SourceKind,
  type SystemSetting
} from "@edagent/domain";
import {
  createId,
  jsonResponse,
  notFoundResponse,
  parseJson,
  readinessProbe
} from "@edagent/shared";

type LoginPayload = {
  email: string;
  password: string;
};

type UpdateSettingPayload = {
  value: string;
};

type CreateJobPayload = {
  queue: string;
  type: string;
  payload?: Record<string, string | number | boolean | null>;
};

type UpsertSourcePayload = {
  industryId: string;
  source: SourceKind;
  status: "active" | "disabled";
  config?: Record<string, string | number | boolean | null>;
};

type TriggerHhIngestionPayload = {
  industryId: string;
  query: string;
  page?: number;
  perPage?: number;
  area?: string;
};

type TriggerCompanyDiscoveryPayload = {
  industryId: string;
  limit?: number;
};

type UpdateCompanyStagePayload = {
  stage: CompanyStage;
};

type GenerateDraftPayload = {
  companyId: string;
  contactId?: string;
  tone?: DraftTone;
  kind?: "outreach-email" | "follow-up-email";
};

type UpdateDraftApprovalPayload = {
  approved: boolean;
};

type SendCampaignPayload = {
  name?: string;
  draftIds: string[];
};

type SimulateReplyPayload = {
  messageId: string;
  body: string;
  incomingFrom?: string;
};

type CreateAgreementPayload = {
  companyId: string;
  status?: PartnerAgreement["status"];
};

type UpdateAgreementStatusPayload = {
  status: PartnerAgreement["status"];
};

type GenerateProjectBriefPayload = {
  partnerAgreementId: string;
  title?: string;
};

const settings = [...demoSnapshot.settings];
const auditLogs = [...demoSnapshot.auditLogs];
const jobs = [...demoSnapshot.jobs];
const campaigns = [...demoSnapshot.campaigns];
const messages = [...demoSnapshot.messages];
const messageEvents = [...demoSnapshot.messageEvents];
const replies = [...demoSnapshot.replies];
const agreements = [...demoSnapshot.agreements];
const briefs = [...demoSnapshot.briefs];
const memoryEvents = [...demoSnapshot.memoryEvents];

async function tryDatabase<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch {
    return null;
  }
}

async function getAuditActorUserId(): Promise<string | null> {
  const adminUser = await tryDatabase(() => database.findUserByEmail(env.ADMIN_EMAIL));
  return adminUser?.id ?? null;
}

async function createAuditEntry(entry: Omit<AuditLog, "id" | "createdAt">): Promise<void> {
  await tryDatabase(() => database.createAuditLog(entry));
  appendAuditLog(entry);
}

async function createMemoryEntry(entry: Omit<AgentMemoryEvent, "id" | "createdAt">): Promise<void> {
  await tryDatabase(() => database.createMemoryEvent(entry));
  memoryEvents.unshift({
    id: createId("mem"),
    createdAt: new Date().toISOString(),
    ...entry
  });
}

async function resolveAdaptiveRecommendation(companyId?: string): Promise<AdaptiveRecommendation | null> {
  const localRecommendation = await tryDatabase(() => database.getAdaptiveRecommendation(companyId));
  if (!env.ML_USE_REMOTE_RECOMMENDER) {
    return localRecommendation;
  }

  const stats = await tryDatabase(() => database.getAdaptiveRecommendationStats(companyId));
  if (!stats) {
    return localRecommendation;
  }

  try {
    return await requestRemoteAdaptiveRecommendation({
      scope: companyId ? "company" : "global",
      stats
    });
  } catch {
    return localRecommendation;
  }
}

function send(res: ServerResponse, payload: ReturnType<typeof jsonResponse>): void {
  res.writeHead(payload.statusCode, payload.headers);
  res.end(payload.body);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function appendAuditLog(entry: Omit<AuditLog, "id" | "createdAt">): AuditLog {
  const log: AuditLog = {
    id: createId("aud"),
    createdAt: new Date().toISOString(),
    ...entry
  };
  auditLogs.unshift(log);
  return log;
}

function upsertSetting(key: string, value: string): SystemSetting {
  const existing = settings.find((item) => item.key === key);

  if (existing) {
    existing.value = value;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const created: SystemSetting = {
    key,
    value,
    updatedAt: new Date().toISOString()
  };

  settings.push(created);
  return created;
}

function createJob(input: CreateJobPayload): BackgroundJob {
  const job: BackgroundJob = {
    id: createId("job"),
    queue: input.queue,
    type: input.type,
    status: "queued",
    attempts: 0,
    maxAttempts: 3,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  jobs.unshift(job);
  return job;
}

function createCampaignFallback(name: string): OutreachCampaign {
  const campaign: OutreachCampaign = {
    id: createId("cam"),
    name,
    channel: "email",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  campaigns.unshift(campaign);
  return campaign;
}

function buildCompanyProfile(input: {
  company: Awaited<ReturnType<typeof database.getCompanyById>>;
  industries: typeof demoSnapshot.industries;
  competencies: typeof demoSnapshot.competencies;
  vacancies: typeof demoSnapshot.vacancies;
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

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  if (req.method === "GET" && pathname === "/platform/bootstrap") {
    const dbSnapshot = await tryDatabase(() => database.getSnapshot());
    const bootstrap = dbSnapshot ?? {
      industries: demoSnapshot.industries,
      competencies: demoSnapshot.competencies,
      programCompetencies: demoSnapshot.programCompetencies,
      vacancies: demoSnapshot.vacancies,
      sources: demoSnapshot.sources,
      ingestionRuns: demoSnapshot.ingestionRuns,
      companies: demoSnapshot.companies,
      contacts: demoSnapshot.contacts,
      scores: demoSnapshot.scores,
      campaigns,
      drafts: demoSnapshot.drafts,
      messages,
      messageEvents,
      replies,
      agreements,
      briefs,
      memoryEvents,
      users: demoSnapshot.users,
      settings,
      auditLogs,
      jobs
    };

    send(
      res,
      jsonResponse({
        summary: {
          industries: bootstrap.industries.length,
          companies: bootstrap.companies.length,
          contacts: bootstrap.contacts.length,
          jobs: bootstrap.jobs.length
        },
        data: {
          industries: bootstrap.industries,
          competencies: bootstrap.competencies,
          vacancies: bootstrap.vacancies,
          sources: bootstrap.sources,
          ingestionRuns: bootstrap.ingestionRuns,
          companies: bootstrap.companies,
          scores: bootstrap.scores,
          campaigns: bootstrap.campaigns,
          drafts: bootstrap.drafts,
          messages: bootstrap.messages,
          messageEvents: bootstrap.messageEvents,
          replies: bootstrap.replies,
          agreements: bootstrap.agreements,
          briefs: bootstrap.briefs,
          memoryEvents: bootstrap.memoryEvents,
          settings: bootstrap.settings,
          jobs: bootstrap.jobs
        }
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/auth/login") {
    const rawBody = await readBody(req);
    const payload = parseJson<LoginPayload>(rawBody);
    const adminUser =
      (await tryDatabase(() => database.findUserByEmail(env.ADMIN_EMAIL))) ?? demoSnapshot.users[0] ?? null;

    if (!payload || payload.email !== env.ADMIN_EMAIL || payload.password !== env.ADMIN_PASSWORD) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_credentials",
            message: "Email or password is incorrect."
          },
          401
        )
      );
      return;
    }

    if (!adminUser) {
      send(
        res,
        jsonResponse(
          {
            error: "configuration_error",
            message: "Admin user is not configured in the demo snapshot."
          },
          500
        )
      );
      return;
    }

    await createAuditEntry({
      actorUserId: adminUser.id,
      action: "auth.login",
      entityType: "user",
      entityId: adminUser.id
    });

    send(
      res,
      jsonResponse({
        token: "demo-admin-token",
        user: adminUser
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/settings") {
    const items = (await tryDatabase(() => database.getSettings())) ?? settings;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "PUT" && pathname.startsWith("/settings/")) {
    const key = pathname.replace("/settings/", "");
    const payload = parseJson<UpdateSettingPayload>(await readBody(req));

    if (!payload?.value) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected JSON body with non-empty value."
          },
          400
        )
      );
      return;
    }

    const updated =
      (await tryDatabase(() => database.upsertSetting(key, payload.value))) ?? upsertSetting(key, payload.value);
    const actorUserId = await getAuditActorUserId();
    if (actorUserId) {
      await createAuditEntry({
        actorUserId,
        action: "settings.updated",
        entityType: "system_setting",
        entityId: key
      });
    }
    send(res, jsonResponse(updated));
    return;
  }

  if (req.method === "GET" && pathname === "/audit-logs") {
    const items = (await tryDatabase(() => database.getAuditLogs())) ?? auditLogs;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/jobs") {
    const items = (await tryDatabase(() => database.getJobs())) ?? jobs;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/jobs") {
    const payload = parseJson<CreateJobPayload>(await readBody(req));

    if (!payload?.queue || !payload.type) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected queue and type in the request body."
          },
          400
        )
      );
      return;
    }

    const job =
      (await tryDatabase(() =>
        database.createJob({
          queue: payload.queue,
          type: payload.type,
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          payload: payload.payload ?? {}
        })
      )) ?? createJob(payload);
    const actorUserId = await getAuditActorUserId();
    if (actorUserId) {
      await createAuditEntry({
        actorUserId,
        action: "job.created",
        entityType: "background_job",
        entityId: job.id
      });
    }

    send(res, jsonResponse(job, 201));
    return;
  }

  if (req.method === "GET" && pathname === "/vacancies") {
    const items = (await tryDatabase(() => database.getVacancies())) ?? demoSnapshot.vacancies;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/industry-sources") {
    const items = (await tryDatabase(() => database.getIndustrySources())) ?? demoSnapshot.sources;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/industry-sources") {
    const payload = parseJson<UpsertSourcePayload>(await readBody(req));

    if (!payload?.industryId || !payload.source || !payload.status) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected industryId, source and status."
          },
          400
        )
      );
      return;
    }

    if (payload.source === "linkedin") {
      send(
        res,
        jsonResponse(
          {
            error: "not_implemented",
            message: "LinkedIn integration is intentionally left as a placeholder for now."
          },
          501
        )
      );
      return;
    }

    const source = await tryDatabase(() =>
      database.upsertIndustrySource({
        industryId: payload.industryId,
        source: payload.source,
        status: payload.status,
        config: payload.config ?? {}
      })
    );

    if (!source) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not persist source configuration."
          },
          503
        )
      );
      return;
    }

    send(res, jsonResponse(source, 201));
    return;
  }

  if (req.method === "GET" && pathname === "/ingestion-runs") {
    const items = (await tryDatabase(() => database.getIngestionRuns())) ?? demoSnapshot.ingestionRuns;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/vacancies/ingest/hh") {
    const payload = parseJson<TriggerHhIngestionPayload>(await readBody(req));

    if (!payload?.industryId || !payload.query) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected industryId and query."
          },
          400
        )
      );
      return;
    }

    const job =
      (await tryDatabase(() =>
        database.createJob({
          queue: "industry-analysis",
          type: "hh-sync-vacancies",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          payload: {
            industryId: payload.industryId,
            query: payload.query,
            page: payload.page ?? 0,
            perPage: payload.perPage ?? 20,
            area: payload.area ?? ""
          }
        })
      )) ??
      createJob({
        queue: "industry-analysis",
        type: "hh-sync-vacancies",
        payload: {
          industryId: payload.industryId,
          query: payload.query,
          page: payload.page ?? 0,
          perPage: payload.perPage ?? 20,
          area: payload.area ?? ""
        }
      });

    send(res, jsonResponse(job, 201));
    return;
  }

  if (req.method === "GET" && pathname === "/analytics/competency-gap") {
    const items = (await tryDatabase(() => database.getCompetencyGapMatrix())) ?? [];
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/companies") {
    const industryId = url.searchParams.get("industryId") ?? undefined;
    const stage = (url.searchParams.get("stage") as CompanyStage | null) ?? undefined;
    const dbCompanies = await tryDatabase(() =>
      database.getCompanies({
        ...(industryId ? { industryId } : {}),
        ...(stage ? { stage } : {})
      })
    );

    send(
      res,
      jsonResponse({
        items:
          dbCompanies ??
          demoSnapshot.companies.map((company) => ({
            ...company,
            score: demoSnapshot.scores.find((score) => score.companyId === company.id) ?? null,
            contacts: demoSnapshot.contacts.filter((contact) => contact.companyId === company.id)
          }))
      })
    );
    return;
  }

  if (req.method === "GET" && /^\/companies\/[^/]+\/profile-summary$/.test(pathname)) {
    const companyId = pathname.split("/")[2] ?? "";
    const [company, industries, competencies, vacancies, recommendation] = await Promise.all([
      tryDatabase(() => database.getCompanyById(companyId)),
      tryDatabase(() => database.getIndustries()),
      tryDatabase(() => database.getCompetencies()),
      tryDatabase(() => database.getVacancies()),
      resolveAdaptiveRecommendation(companyId)
    ]);

    if (!company || !industries || !competencies || !vacancies) {
      send(
        res,
        jsonResponse(
          {
            error: "not_found",
            message: "Could not build company summary."
          },
          404
        )
      );
      return;
    }

    const profile = buildCompanyProfile({
      company,
      industries,
      competencies,
      vacancies
    });

    if (!profile) {
      send(res, jsonResponse({ error: "not_found", message: "Company not found." }, 404));
      return;
    }

    send(
      res,
      jsonResponse({
        summary: generateCompanySummary(profile),
        recommendation
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/companies/shortlist") {
    const industryId = url.searchParams.get("industryId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "10");
    const minimumScore = Number(url.searchParams.get("minimumScore") ?? "75");
    const items =
      (await tryDatabase(() =>
        database.getShortlist({
          ...(industryId ? { industryId } : {}),
          limit,
          minimumScore
        })
      )) ??
      demoSnapshot.companies
        .map((company) => ({
          ...company,
          score: demoSnapshot.scores.find((score) => score.companyId === company.id) ?? null,
          contacts: demoSnapshot.contacts.filter((contact) => contact.companyId === company.id)
        }))
        .filter((company) => (company.score?.total ?? 0) >= minimumScore)
        .sort((left, right) => (right.score?.total ?? 0) - (left.score?.total ?? 0))
        .slice(0, limit);

    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/companies/discover") {
    const payload = parseJson<TriggerCompanyDiscoveryPayload>(await readBody(req));

    if (!payload?.industryId) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected industryId."
          },
          400
        )
      );
      return;
    }

    const job =
      (await tryDatabase(() =>
        database.createJob({
          queue: "company-discovery",
          type: "refresh-company-pool",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          payload: {
            industryId: payload.industryId,
            limit: payload.limit ?? 50
          }
        })
      )) ??
      createJob({
        queue: "company-discovery",
        type: "refresh-company-pool",
        payload: {
          industryId: payload.industryId,
          limit: payload.limit ?? 50
        }
      });

    send(res, jsonResponse(job, 201));
    return;
  }

  if (req.method === "PUT" && /^\/companies\/[^/]+\/stage$/.test(pathname)) {
    const companyId = pathname.split("/")[2] ?? "";
    const payload = parseJson<UpdateCompanyStagePayload>(await readBody(req));

    if (!companyId || !payload?.stage) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected company id and stage."
          },
          400
        )
      );
      return;
    }

    const updated = await tryDatabase(() => database.updateCompanyStage(companyId, payload.stage));
    if (!updated) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not update company stage."
          },
          503
        )
      );
      return;
    }

    const actorUserId = await getAuditActorUserId();
    if (actorUserId) {
      await createAuditEntry({
        actorUserId,
        action: "company.stage_updated",
        entityType: "company",
        entityId: companyId
      });
    }

    send(res, jsonResponse(updated));
    return;
  }

  if (req.method === "GET" && pathname === "/drafts") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const contactId = url.searchParams.get("contactId") ?? undefined;
    const approvedRaw = url.searchParams.get("approved");
    const approved =
      approvedRaw === null ? undefined : approvedRaw === "true";
    const items =
      (await tryDatabase(() =>
        database.getMessageDrafts({
          ...(companyId ? { companyId } : {}),
          ...(contactId ? { contactId } : {}),
          ...(approved !== undefined ? { approved } : {})
        })
      )) ?? demoSnapshot.drafts;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/drafts/generate") {
    const payload = parseJson<GenerateDraftPayload>(await readBody(req));
    if (!payload?.companyId) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected companyId."
          },
          400
        )
      );
      return;
    }

    const [company, industries, competencies, vacancies] = await Promise.all([
      tryDatabase(() => database.getCompanyById(payload.companyId)),
      tryDatabase(() => database.getIndustries()),
      tryDatabase(() => database.getCompetencies()),
      tryDatabase(() => database.getVacancies())
    ]);

    if (!company || !industries || !competencies || !vacancies) {
      send(
        res,
        jsonResponse(
          {
            error: "not_found",
            message: "Company profile is unavailable."
          },
          404
        )
      );
      return;
    }

    const profile = buildCompanyProfile({
      company,
      industries,
      competencies,
      vacancies
    });
    const adaptiveRecommendation = payload.tone ? null : await resolveAdaptiveRecommendation(company.id);
    const tone = payload.tone ?? adaptiveRecommendation?.recommendedTone ?? "formal";
    const selectedContact =
      (payload.contactId
        ? company.contacts.find((item) => item.id === payload.contactId)
        : company.contacts[0]) ?? null;

    if (!profile || !selectedContact) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_state",
            message: "Company contact is required to generate a draft."
          },
          400
        )
      );
      return;
    }

    const generation =
      payload.kind === "follow-up-email"
        ? generateFollowUpDraft({
            ...profile,
            tone,
            contactName: selectedContact.fullName,
            contactTitle: selectedContact.title
          })
        : generateOutreachDraft({
            ...profile,
            tone,
            contactName: selectedContact.fullName,
            contactTitle: selectedContact.title
          });

    const draft =
      (await tryDatabase(() =>
        database.createMessageDraft({
          companyId: company.id,
          contactId: selectedContact.id,
          subject: generation.subject,
          body: generation.body,
          tone,
          approved: false
        })
      )) ??
      ({
        id: createId("dr"),
        companyId: company.id,
        contactId: selectedContact.id,
        subject: generation.subject,
        body: generation.body,
        tone,
        approved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } satisfies MessageDraft);

    const actorUserId = await getAuditActorUserId();
    if (actorUserId) {
      await createAuditEntry({
        actorUserId,
        action: "draft.generated",
        entityType: "message_draft",
        entityId: draft.id
      });
    }

    await createMemoryEntry({
      companyId: company.id,
      eventType: "draft_generated",
      payload: {
        tone,
        kind: payload.kind ?? "outreach-email",
        adaptive: adaptiveRecommendation ? true : false
      }
    });

    send(res, jsonResponse(draft, 201));
    return;
  }

  if (req.method === "PUT" && /^\/drafts\/[^/]+\/approval$/.test(pathname)) {
    const draftId = pathname.split("/")[2] ?? "";
    const payload = parseJson<UpdateDraftApprovalPayload>(await readBody(req));
    if (!draftId || payload?.approved === undefined) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected draft id and approved boolean."
          },
          400
        )
      );
      return;
    }

    const updated = await tryDatabase(() => database.updateMessageDraftApproval(draftId, payload.approved));
    if (!updated) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not update draft approval."
          },
          503
        )
      );
      return;
    }

    const actorUserId = await getAuditActorUserId();
    if (actorUserId) {
      await createAuditEntry({
        actorUserId,
        action: payload.approved ? "draft.approved" : "draft.rejected",
        entityType: "message_draft",
        entityId: draftId
      });
    }

    send(res, jsonResponse(updated));
    return;
  }

  if (req.method === "GET" && pathname === "/campaigns") {
    const items = (await tryDatabase(() => database.getOutreachCampaigns())) ?? campaigns;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/campaigns/send") {
    const payload = parseJson<SendCampaignPayload>(await readBody(req));
    const draftIds = payload?.draftIds?.filter(Boolean) ?? [];

    if (draftIds.length === 0) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected non-empty draftIds."
          },
          400
        )
      );
      return;
    }

    const campaignName = payload?.name?.trim() || `Outreach ${new Date().toISOString().slice(0, 10)}`;
    const campaign =
      (await tryDatabase(() =>
        database.createOutreachCampaign({
          name: campaignName,
          channel: "email",
          status: "draft"
        })
      )) ?? createCampaignFallback(campaignName);

    const job =
      (await tryDatabase(() =>
        database.createJob({
          queue: "outreach",
          type: "send-outreach-campaign",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          payload: {
            campaignId: campaign.id,
            draftIds: draftIds.join(",")
          }
        })
      )) ??
      createJob({
        queue: "outreach",
        type: "send-outreach-campaign",
        payload: {
          campaignId: campaign.id,
          draftIds: draftIds.join(",")
        }
      });

    const actorUserId = await getAuditActorUserId();
    if (actorUserId) {
      await createAuditEntry({
        actorUserId,
        action: "campaign.created",
        entityType: "outreach_campaign",
        entityId: campaign.id
      });
    }

    send(
      res,
      jsonResponse(
        {
          campaign,
          job
        },
        201
      )
    );
    return;
  }

  if (req.method === "POST" && pathname === "/follow-ups/run") {
    const job =
      (await tryDatabase(() =>
        database.createJob({
          queue: "outreach",
          type: "run-follow-up-scheduler",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          payload: {
            dueBefore: new Date().toISOString()
          }
        })
      )) ??
      createJob({
        queue: "outreach",
        type: "run-follow-up-scheduler",
        payload: {
          dueBefore: new Date().toISOString()
        }
      });

    send(res, jsonResponse(job, 201));
    return;
  }

  if (req.method === "GET" && pathname === "/messages") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const campaignId = url.searchParams.get("campaignId") ?? undefined;
    const status = (url.searchParams.get("status") as MessageStatus | null) ?? undefined;
    const kind = (url.searchParams.get("kind") as MessageKind | null) ?? undefined;
    const items =
      (await tryDatabase(() =>
        database.getMessages({
          ...(companyId ? { companyId } : {}),
          ...(campaignId ? { campaignId } : {}),
          ...(status ? { status } : {}),
          ...(kind ? { kind } : {})
        })
      )) ?? messages;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/message-events") {
    const messageId = url.searchParams.get("messageId") ?? undefined;
    const items = (await tryDatabase(() => database.getMessageEvents({ ...(messageId ? { messageId } : {}) }))) ?? messageEvents;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/replies") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const items = (await tryDatabase(() => database.getReplies({ ...(companyId ? { companyId } : {}) }))) ?? replies;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/memory-events") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const eventType = url.searchParams.get("eventType") ?? undefined;
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const items =
      (await tryDatabase(() =>
        database.getMemoryEvents({
          ...(companyId ? { companyId } : {}),
          ...(eventType ? { eventType } : {}),
          ...(limit && Number.isFinite(limit) ? { limit } : {})
        })
      )) ??
      memoryEvents
        .filter((item) => (!companyId || item.companyId === companyId) && (!eventType || item.eventType === eventType))
        .slice(0, limit && Number.isFinite(limit) ? limit : memoryEvents.length);
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/memory/recommendations") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const recommendation = await resolveAdaptiveRecommendation(companyId);
    if (!recommendation) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not build adaptive recommendation."
          },
          503
        )
      );
      return;
    }

    send(res, jsonResponse(recommendation));
    return;
  }

  if (req.method === "GET" && pathname === "/memory/overview") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const overview = await tryDatabase(() => database.getMemoryOverview(companyId));
    if (!overview) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not build memory overview."
          },
          503
        )
      );
      return;
    }

    send(res, jsonResponse(overview));
    return;
  }

  if (req.method === "GET" && pathname === "/ml/health") {
    try {
      const health = await getMlServiceHealth();
      send(res, jsonResponse(health));
    } catch (error: unknown) {
      send(
        res,
        jsonResponse(
          {
            status: "degraded",
            service: "edagent-ml-service",
            remoteRecommenderEnabled: env.ML_USE_REMOTE_RECOMMENDER,
            error: error instanceof Error ? error.message : "Unknown ML service error"
          },
          503
        )
      );
    }
    return;
  }

  if (req.method === "POST" && pathname === "/ml/evaluations/run") {
    const companies = await tryDatabase(() => database.getCompanies());
    if (!companies) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not load companies for ML evaluation."
          },
          503
        )
      );
      return;
    }

    const items = await Promise.all(
      companies.map(async (company) => {
        const [stats, localRecommendation] = await Promise.all([
          database.getAdaptiveRecommendationStats(company.id),
          database.getAdaptiveRecommendation(company.id)
        ]);

        return {
          companyId: company.id,
          stats,
          baselineTone: localRecommendation.recommendedTone,
          baselineFollowUpDays: localRecommendation.recommendedFollowUpDays
        };
      })
    );

    try {
      const evaluation = await runRemoteAdaptiveEvaluation({ items });
      send(res, jsonResponse(evaluation, 201));
    } catch (error: unknown) {
      send(
        res,
        jsonResponse(
          {
            error: "ml_service_unavailable",
            message: error instanceof Error ? error.message : "Unknown ML evaluation error"
          },
          503
        )
      );
    }
    return;
  }

  if (req.method === "POST" && pathname === "/replies/simulate") {
    const payload = parseJson<SimulateReplyPayload>(await readBody(req));

    if (!payload?.messageId || !payload.body) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected messageId and body."
          },
          400
        )
      );
      return;
    }

    const job =
      (await tryDatabase(() =>
        database.createJob({
          queue: "outreach",
          type: "process-simulated-reply",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          payload: {
            messageId: payload.messageId,
            body: payload.body,
            incomingFrom: payload.incomingFrom ?? ""
          }
        })
      )) ??
      createJob({
        queue: "outreach",
        type: "process-simulated-reply",
        payload: {
          messageId: payload.messageId,
          body: payload.body,
          incomingFrom: payload.incomingFrom ?? ""
        }
      });

    send(res, jsonResponse(job, 201));
    return;
  }

  if (req.method === "GET" && pathname === "/agreements") {
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const status = (url.searchParams.get("status") as PartnerAgreement["status"] | null) ?? undefined;
    const items =
      (await tryDatabase(() =>
        database.getPartnerAgreements({
          ...(companyId ? { companyId } : {}),
          ...(status ? { status } : {})
        })
      )) ?? agreements;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/agreements") {
    const payload = parseJson<CreateAgreementPayload>(await readBody(req));
    if (!payload?.companyId) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected companyId."
          },
          400
        )
      );
      return;
    }

    const agreement = await tryDatabase(() =>
      database.createPartnerAgreement({
        companyId: payload.companyId,
        status: payload.status ?? "draft"
      })
    );

    if (!agreement) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not create agreement."
          },
          503
        )
      );
      return;
    }

    const actorUserId = await getAuditActorUserId();
    if (actorUserId) {
      await createAuditEntry({
        actorUserId,
        action: "agreement.created",
        entityType: "partner_agreement",
        entityId: agreement.id
      });
    }

    await createMemoryEntry({
      companyId: agreement.companyId,
      eventType: "agreement_created",
      payload: {
        agreementId: agreement.id,
        status: agreement.status
      }
    });

    send(res, jsonResponse(agreement, 201));
    return;
  }

  if (req.method === "PUT" && /^\/agreements\/[^/]+\/status$/.test(pathname)) {
    const agreementId = pathname.split("/")[2] ?? "";
    const payload = parseJson<UpdateAgreementStatusPayload>(await readBody(req));

    if (!agreementId || !payload?.status) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected agreement id and status."
          },
          400
        )
      );
      return;
    }

    const agreement = await tryDatabase(() => database.updatePartnerAgreementStatus(agreementId, payload.status));
    if (!agreement) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not update agreement status."
          },
          503
        )
      );
      return;
    }

    const actorUserId = await getAuditActorUserId();
    if (actorUserId) {
      await createAuditEntry({
        actorUserId,
        action: "agreement.status_updated",
        entityType: "partner_agreement",
        entityId: agreementId
      });
    }

    await createMemoryEntry({
      companyId: agreement.companyId,
      eventType: "agreement_status_updated",
      payload: {
        agreementId,
        status: agreement.status,
        signed: agreement.status === "signed"
      }
    });

    send(res, jsonResponse(agreement));
    return;
  }

  if (req.method === "GET" && pathname === "/project-briefs") {
    const partnerAgreementId = url.searchParams.get("partnerAgreementId") ?? undefined;
    const items =
      (await tryDatabase(() =>
        database.getProjectBriefs({
          ...(partnerAgreementId ? { partnerAgreementId } : {})
        })
      )) ?? briefs;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/project-briefs/generate") {
    const payload = parseJson<GenerateProjectBriefPayload>(await readBody(req));
    if (!payload?.partnerAgreementId) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected partnerAgreementId."
          },
          400
        )
      );
      return;
    }

    const agreement = await tryDatabase(() => database.getPartnerAgreementById(payload.partnerAgreementId));
    if (!agreement) {
      send(
        res,
        jsonResponse(
          {
            error: "not_found",
            message: "Partner agreement not found."
          },
          404
        )
      );
      return;
    }

    const [company, industries, competencies, vacancies] = await Promise.all([
      tryDatabase(() => database.getCompanyById(agreement.companyId)),
      tryDatabase(() => database.getIndustries()),
      tryDatabase(() => database.getCompetencies()),
      tryDatabase(() => database.getVacancies())
    ]);

    if (!company || !industries || !competencies || !vacancies) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_state",
            message: "Could not build project brief context."
          },
          400
        )
      );
      return;
    }

    const industry = industries.find((item) => item.id === company.industryId);
    const topCompetencyIds = vacancies
      .filter((vacancy) => vacancy.companyName === company.name)
      .flatMap((vacancy) => vacancy.competencyIds);
    const competencyIds = Array.from(new Set(topCompetencyIds)).slice(0, 5);
    const competencyNames = competencyIds
      .map((id) => competencies.find((item) => item.id === id)?.name)
      .filter((value): value is string => Boolean(value));

    const generated = generateProjectBrief({
      companyName: company.name,
      industryName: industry?.name ?? "Unknown industry",
      competencies: competencyNames,
      region: company.region
    });

    const brief = await tryDatabase(() =>
      database.createProjectBrief({
        partnerAgreementId: agreement.id,
        title: payload.title?.trim() || generated.title,
        summary: generated.summary,
        roles: generated.roles,
        competencyIds
      })
    );

    if (!brief) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not create project brief."
          },
          503
        )
      );
      return;
    }

    const actorUserId = await getAuditActorUserId();
    if (actorUserId) {
      await createAuditEntry({
        actorUserId,
        action: "project_brief.generated",
        entityType: "project_brief",
        entityId: brief.id
      });
    }

    await createMemoryEntry({
      companyId: company.id,
      eventType: "project_brief_generated",
      payload: {
        briefId: brief.id,
        agreementId: agreement.id,
        competencyCount: brief.competencyIds.length,
        roleCount: brief.roles.length
      }
    });

    send(res, jsonResponse(brief, 201));
    return;
  }

  if (req.method === "GET" && pathname === "/projects/catalog") {
    const items = (await tryDatabase(() => database.getProjectCatalog())) ?? [];
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/users") {
    const items = (await tryDatabase(() => database.getUsers())) ?? demoSnapshot.users;
    send(res, jsonResponse({ items }));
    return;
  }

  send(res, notFoundResponse(pathname));
}

function main(): void {
  const server = createServer((req, res) => {
    route(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      send(
        res,
        jsonResponse(
          {
            error: "internal_error",
            message
          },
          500
        )
      );
    });
  });

  server.listen(env.API_PORT, () => {
    const status = readinessProbe("api");
    console.log(`[api] ${status.service} is listening on port ${env.API_PORT}`);
  });
}

main();
