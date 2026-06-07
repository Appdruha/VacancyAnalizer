import {
  generateFollowUpDraft,
  generateOutreachDraft,
  type CompanyProfileInput,
  type DraftTone
} from "@edagent/ai";
import { database } from "@edagent/database";
import type {
  AgentMemoryEvent,
  AuditLog,
  BackgroundJob,
  Competency,
  Industry,
  Message,
  MessageDraft,
  MessageEvent,
  MessageKind,
  MessageStatus,
  OutreachCampaign,
  Reply,
  Vacancy
} from "@edagent/domain";
import { createId } from "@edagent/shared";

type ServiceSuccess<T> = {
  ok: true;
  status?: number;
  data: T;
};

type ServiceFailure = {
  ok: false;
  status: number;
  error: string;
  message: string;
};

type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

type CreateJobInput = {
  queue: string;
  type: string;
  payload?: Record<string, string | number | boolean | null>;
};

type GenerateDraftPayload = {
  companyId: string;
  contactId?: string;
  tone?: DraftTone;
  kind?: "outreach-email" | "follow-up-email";
};

type LogNegotiationOutcomePayload = {
  outcome: "meeting_scheduled" | "pilot_agreed" | "follow_up_needed" | "declined_after_call";
  notes?: string;
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

type CompanyProfileDeps = {
  company: Awaited<ReturnType<typeof database.getCompanyById>>;
  industries: Industry[];
  competencies: Competency[];
  vacancies: Vacancy[];
};

export type OutreachServiceDeps = {
  tryDatabase: <T>(action: () => Promise<T>) => Promise<T | null>;
  createJob: (input: CreateJobInput) => BackgroundJob;
  createCampaignFallback: (name: string) => OutreachCampaign;
  getAuditActorUserId: () => Promise<string | null>;
  createAuditEntry: (entry: Omit<AuditLog, "id" | "createdAt">) => Promise<void>;
  createMemoryEntry: (entry: Omit<AgentMemoryEvent, "id" | "createdAt">) => Promise<void>;
  resolveAdaptiveRecommendation: (companyId?: string) => Promise<{ recommendedTone: DraftTone } | null>;
  buildCompanyProfile: (input: CompanyProfileDeps) => CompanyProfileInput | null;
  retrieveRagContext: (
    companyId: string,
    query: string,
    topK?: number
  ) => Promise<NonNullable<CompanyProfileInput["retrievedContext"]>>;
  campaigns: OutreachCampaign[];
  messages: Message[];
  messageEvents: MessageEvent[];
  replies: Reply[];
};

export function createOutreachService(deps: OutreachServiceDeps) {
  return {
    async listDrafts(input: { companyId?: string; contactId?: string; approved?: boolean }): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getMessageDrafts>> }>> {
      const items =
        (await deps.tryDatabase(() =>
          database.getMessageDrafts({
            ...(input.companyId ? { companyId: input.companyId } : {}),
            ...(input.contactId ? { contactId: input.contactId } : {}),
            ...(input.approved !== undefined ? { approved: input.approved } : {})
          })
        )) ?? [];
      return { ok: true, data: { items } };
    },

    async generateDraft(payload: GenerateDraftPayload): Promise<ServiceResult<MessageDraft>> {
      if (!payload.companyId) {
        return { ok: false, status: 400, error: "invalid_payload", message: "Expected companyId." };
      }

      const [company, industries, competencies, vacancies] = await Promise.all([
        deps.tryDatabase(() => database.getCompanyById(payload.companyId)),
        deps.tryDatabase(() => database.getIndustries()),
        deps.tryDatabase(() => database.getCompetencies()),
        deps.tryDatabase(() => database.getVacancies())
      ]);

      if (!company || !industries || !competencies || !vacancies) {
        return { ok: false, status: 404, error: "not_found", message: "Company profile is unavailable." };
      }

      const profile = deps.buildCompanyProfile({ company, industries, competencies, vacancies });
      const adaptiveRecommendation = payload.tone ? null : await deps.resolveAdaptiveRecommendation(company.id);
      const tone = payload.tone ?? adaptiveRecommendation?.recommendedTone ?? "formal";
      const selectedContact =
        (payload.contactId ? company.contacts.find((item) => item.id === payload.contactId) : company.contacts[0]) ?? null;

      if (!profile || !selectedContact) {
        return {
          ok: false,
          status: 400,
          error: "invalid_state",
          message: "Company contact is required to generate a draft."
        };
      }

      const ragQuery =
        payload.kind === "follow-up-email"
          ? `Follow up with ${company.name} about partnership progress, current objections, and next steps.`
          : `Generate a first outreach email for ${company.name} in ${profile.industryName} focusing on ${profile.topCompetencies.join(", ") || "practical digital competencies"}.`;
      const retrievedContext = await deps.retrieveRagContext(company.id, ragQuery, 4);

      const generation =
        payload.kind === "follow-up-email"
          ? generateFollowUpDraft({
              ...profile,
              tone,
              contactName: selectedContact.fullName,
              contactTitle: selectedContact.title,
              ...(retrievedContext.length > 0 ? { retrievedContext } : {})
            })
          : generateOutreachDraft({
              ...profile,
              tone,
              contactName: selectedContact.fullName,
              contactTitle: selectedContact.title,
              ...(retrievedContext.length > 0 ? { retrievedContext } : {})
            });

      const draft =
        (await deps.tryDatabase(() =>
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

      const actorUserId = await deps.getAuditActorUserId();
      if (actorUserId) {
        await deps.createAuditEntry({
          actorUserId,
          action: "draft.generated",
          entityType: "message_draft",
          entityId: draft.id
        });
      }

      await deps.createMemoryEntry({
        companyId: company.id,
        eventType: "draft_generated",
        payload: {
          tone,
          kind: payload.kind ?? "outreach-email",
          adaptive: Boolean(adaptiveRecommendation),
          ragContextUsed: retrievedContext.length > 0,
          ragContextItems: retrievedContext.length
        }
      });

      return { ok: true, status: 201, data: draft };
    },

    async updateDraftApproval(draftId: string, approved?: boolean): Promise<ServiceResult<Awaited<ReturnType<typeof database.updateMessageDraftApproval>>>> {
      if (!draftId || approved === undefined) {
        return {
          ok: false,
          status: 400,
          error: "invalid_payload",
          message: "Expected draft id and approved boolean."
        };
      }

      const updated = await deps.tryDatabase(() => database.updateMessageDraftApproval(draftId, approved));
      if (!updated) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not update draft approval."
        };
      }

      const actorUserId = await deps.getAuditActorUserId();
      if (actorUserId) {
        await deps.createAuditEntry({
          actorUserId,
          action: approved ? "draft.approved" : "draft.rejected",
          entityType: "message_draft",
          entityId: draftId
        });
      }

      return { ok: true, data: updated };
    },

    async listCampaigns(): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getOutreachCampaigns>> | OutreachCampaign[] }>> {
      const items = (await deps.tryDatabase(() => database.getOutreachCampaigns())) ?? deps.campaigns;
      return { ok: true, data: { items } };
    },

    async sendCampaign(payload: SendCampaignPayload | null | undefined): Promise<ServiceResult<{ campaign: OutreachCampaign; job: BackgroundJob }>> {
      const draftIds = payload?.draftIds?.filter(Boolean) ?? [];
      if (draftIds.length === 0) {
        return { ok: false, status: 400, error: "invalid_payload", message: "Expected non-empty draftIds." };
      }

      const campaignName = payload?.name?.trim() || `Outreach ${new Date().toISOString().slice(0, 10)}`;
      const campaign =
        (await deps.tryDatabase(() =>
          database.createOutreachCampaign({
            name: campaignName,
            channel: "email",
            status: "draft"
          })
        )) ?? deps.createCampaignFallback(campaignName);

      const job =
        (await deps.tryDatabase(() =>
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
        deps.createJob({
          queue: "outreach",
          type: "send-outreach-campaign",
          payload: {
            campaignId: campaign.id,
            draftIds: draftIds.join(",")
          }
        });

      const actorUserId = await deps.getAuditActorUserId();
      if (actorUserId) {
        await deps.createAuditEntry({
          actorUserId,
          action: "campaign.created",
          entityType: "outreach_campaign",
          entityId: campaign.id
        });
      }

      return { ok: true, status: 201, data: { campaign, job } };
    },

    async enqueueFollowUps(): Promise<ServiceSuccess<BackgroundJob>> {
      const job =
        (await deps.tryDatabase(() =>
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
        deps.createJob({
          queue: "outreach",
          type: "run-follow-up-scheduler",
          payload: {
            dueBefore: new Date().toISOString()
          }
        });

      return { ok: true, status: 201, data: job };
    },

    async listMessages(input: { companyId?: string; campaignId?: string; status?: MessageStatus; kind?: MessageKind }): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getMessages>> | Message[] }>> {
      const items =
        (await deps.tryDatabase(() =>
          database.getMessages({
            ...(input.companyId ? { companyId: input.companyId } : {}),
            ...(input.campaignId ? { campaignId: input.campaignId } : {}),
            ...(input.status ? { status: input.status } : {}),
            ...(input.kind ? { kind: input.kind } : {})
          })
        )) ?? deps.messages;
      return { ok: true, data: { items } };
    },

    async listMessageEvents(messageId?: string): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getMessageEvents>> | MessageEvent[] }>> {
      const items =
        (await deps.tryDatabase(() => database.getMessageEvents({ ...(messageId ? { messageId } : {}) }))) ??
        deps.messageEvents;
      return { ok: true, data: { items } };
    },

    async listReplies(companyId?: string): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getReplies>> | Reply[] }>> {
      const items = (await deps.tryDatabase(() => database.getReplies({ ...(companyId ? { companyId } : {}) }))) ?? deps.replies;
      return { ok: true, data: { items } };
    },

    async logReplyOutcome(replyId: string, payload?: LogNegotiationOutcomePayload): Promise<ServiceResult<{
      replyId: string;
      companyId: string;
      outcome: LogNegotiationOutcomePayload["outcome"];
      notes: string | null;
      partnered: boolean;
    }>> {
      if (!replyId || !payload?.outcome) {
        return { ok: false, status: 400, error: "invalid_payload", message: "Expected reply id and outcome." };
      }

      const repliesList = await deps.tryDatabase(() => database.getReplies());
      const reply = repliesList?.find((item) => item.id === replyId);
      if (!reply) {
        return { ok: false, status: 404, error: "not_found", message: "Reply not found." };
      }

      const actorUserId = await deps.getAuditActorUserId();
      if (actorUserId) {
        await deps.createAuditEntry({
          actorUserId,
          action: "reply.outcome_logged",
          entityType: "reply",
          entityId: replyId
        });
      }

      await deps.createMemoryEntry({
        companyId: reply.companyId,
        eventType: "negotiation_outcome_logged",
        payload: {
          replyId,
          outcome: payload.outcome,
          notes: payload.notes?.trim() || null,
          positive: reply.positive
        }
      });

      if (reply.messageId) {
        const eventType =
          payload.outcome === "declined_after_call"
            ? "failed"
            : payload.outcome === "follow_up_needed"
              ? "queued"
              : "delivered";

        await deps.tryDatabase(() =>
          database.createMessageEvent({
            messageId: reply.messageId!,
            type: eventType,
            payload: {
              reconciliation: true,
              outcome: payload.outcome,
              notes: payload.notes?.trim() || null
            }
          })
        );
      }

      if (payload.outcome === "pilot_agreed") {
        await deps.tryDatabase(() => database.updateCompanyStage(reply.companyId, "partnered"));
      }

      return {
        ok: true,
        data: {
          replyId,
          companyId: reply.companyId,
          outcome: payload.outcome,
          notes: payload.notes?.trim() || null,
          partnered: payload.outcome === "pilot_agreed"
        }
      };
    },

    async simulateReply(payload?: SimulateReplyPayload): Promise<ServiceResult<BackgroundJob>> {
      if (!payload?.messageId || !payload.body) {
        return { ok: false, status: 400, error: "invalid_payload", message: "Expected messageId and body." };
      }

      const job =
        (await deps.tryDatabase(() =>
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
        deps.createJob({
          queue: "outreach",
          type: "process-simulated-reply",
          payload: {
            messageId: payload.messageId,
            body: payload.body,
            incomingFrom: payload.incomingFrom ?? ""
          }
        });

      return { ok: true, status: 201, data: job };
    }
  };
}
