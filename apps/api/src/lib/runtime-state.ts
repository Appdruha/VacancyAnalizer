import type {
  AgentMemoryEvent,
  AuditLog,
  BackgroundJob,
  Message,
  MessageEvent,
  OutreachCampaign,
  PartnerAgreement,
  ProjectBrief,
  Reply,
  SystemSetting
} from "@edagent/domain";
import { createId } from "@edagent/shared";

type CreateJobPayload = {
  queue: string;
  type: string;
  payload?: Record<string, string | number | boolean | null>;
};

export const settings: SystemSetting[] = [];
export const auditLogs: AuditLog[] = [];
export const jobs: BackgroundJob[] = [];
export const campaigns: OutreachCampaign[] = [];
export const messages: Message[] = [];
export const messageEvents: MessageEvent[] = [];
export const replies: Reply[] = [];
export const agreements: PartnerAgreement[] = [];
export const briefs: ProjectBrief[] = [];
export const memoryEvents: AgentMemoryEvent[] = [];

export function appendAuditLog(entry: Omit<AuditLog, "id" | "createdAt">): AuditLog {
  const log: AuditLog = {
    id: createId("aud"),
    createdAt: new Date().toISOString(),
    ...entry
  };
  auditLogs.unshift(log);
  return log;
}

export function upsertSetting(key: string, value: string): SystemSetting {
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

export function createJob(input: CreateJobPayload): BackgroundJob {
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

export function createCampaignFallback(name: string): OutreachCampaign {
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
