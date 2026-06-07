import type {
  AgentMemoryEvent,
  AuditLog,
  BackgroundJob,
  CommunicationPackage,
  Message,
  MessageDraft,
  MessageEvent,
  OutreachCampaign,
  PartnerAgreement,
  ProjectBrief,
  Reply,
  SystemSetting
} from "@edagent/domain";
import { database } from "@edagent/database";
import { jsonResponse, parseJson } from "@edagent/shared";
import type { RouteContext } from "./types.js";

type CreateJobPayload = {
  queue: string;
  type: string;
  payload?: Record<string, string | number | boolean | null>;
};

type UpdateSettingPayload = {
  value: string;
};

export async function handleSystemRoutes(
  context: RouteContext,
  deps: {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
    tryDatabase: <T>(action: () => Promise<T>) => Promise<T | null>;
    emptyBootstrapSnapshot: () => {
      industries: Array<{ id: string; name: string; priority: number; approvedByUserId?: string }>;
      competencies: Array<{ id: string; name: string; category: string }>;
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
        source: string;
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
      settings: SystemSetting[];
      jobs: BackgroundJob[];
      contacts: Array<{
        id: string;
        companyId: string;
        fullName: string;
        title: string;
        email?: string;
      }>;
    };
    settings: SystemSetting[];
    auditLogs: AuditLog[];
    jobs: BackgroundJob[];
    upsertSetting: (key: string, value: string) => SystemSetting;
    createJob: (input: CreateJobPayload) => BackgroundJob;
    getAuditActorUserId: () => Promise<string | null>;
    createAuditEntry: (entry: {
      actorUserId: string;
      action: string;
      entityType: string;
      entityId: string;
    }) => Promise<void>;
  }
): Promise<boolean> {
  const { req, res, pathname } = context;

  if (req.method === "GET" && pathname === "/platform/bootstrap") {
    const dbSnapshot = await deps.tryDatabase(() => database.getSnapshot());
    const bootstrap = dbSnapshot ?? deps.emptyBootstrapSnapshot();

    deps.send(
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
          communicationPackages: bootstrap.communicationPackages,
          memoryEvents: bootstrap.memoryEvents,
          settings: bootstrap.settings,
          jobs: bootstrap.jobs
        }
      })
    );
    return true;
  }

  if (req.method === "GET" && pathname === "/settings") {
    const items = (await deps.tryDatabase(() => database.getSettings())) ?? deps.settings;
    deps.send(res, jsonResponse({ items }));
    return true;
  }

  if (req.method === "PUT" && pathname.startsWith("/settings/")) {
    const key = pathname.replace("/settings/", "");
    const payload = parseJson<UpdateSettingPayload>(await deps.readBody(req));

    if (!payload?.value) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected JSON body with non-empty value."
          },
          400
        )
      );
      return true;
    }

    const updated =
      (await deps.tryDatabase(() => database.upsertSetting(key, payload.value))) ?? deps.upsertSetting(key, payload.value);
    const actorUserId = await deps.getAuditActorUserId();
    if (actorUserId) {
      await deps.createAuditEntry({
        actorUserId,
        action: "settings.updated",
        entityType: "system_setting",
        entityId: key
      });
    }
    deps.send(res, jsonResponse(updated));
    return true;
  }

  if (req.method === "GET" && pathname === "/audit-logs") {
    const items = (await deps.tryDatabase(() => database.getAuditLogs())) ?? deps.auditLogs;
    deps.send(res, jsonResponse({ items }));
    return true;
  }

  if (req.method === "GET" && pathname === "/jobs") {
    const items = (await deps.tryDatabase(() => database.getJobs())) ?? deps.jobs;
    deps.send(res, jsonResponse({ items }));
    return true;
  }

  if (req.method === "POST" && pathname === "/jobs") {
    const payload = parseJson<CreateJobPayload>(await deps.readBody(req));

    if (!payload?.queue || !payload.type) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected queue and type in the request body."
          },
          400
        )
      );
      return true;
    }

    const job =
      (await deps.tryDatabase(() =>
        database.createJob({
          queue: payload.queue,
          type: payload.type,
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          payload: payload.payload ?? {}
        })
      )) ?? deps.createJob(payload);
    const actorUserId = await deps.getAuditActorUserId();
    if (actorUserId) {
      await deps.createAuditEntry({
        actorUserId,
        action: "job.created",
        entityType: "background_job",
        entityId: job.id
      });
    }

    deps.send(res, jsonResponse(job, 201));
    return true;
  }

  return false;
}
