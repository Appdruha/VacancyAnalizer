import { createServer } from "node:http";
import { generateFollowUpDraft } from "@edagent/ai";
import { env } from "@edagent/config";
import { database } from "@edagent/database";
import type { BackgroundJob } from "@edagent/domain";
import {
  HhApiError,
  classifyReplyCategory,
  extractCompetencyCandidates,
  getEmailProvider,
  getSourceAdapter,
  requestRemoteAdaptiveRecommendation
} from "@edagent/integrations";
import { calculateDiscoveryScore, deriveStageFromScore, estimateCompanySize } from "@edagent/scoring";
import { jsonResponse, readinessProbe } from "@edagent/shared";

const runtimeState = {
  processedCount: 0,
  lastProcessedAt: null as string | null,
  lastError: null as string | null,
  mode: "database" as "database" | "idle"
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toPartnershipContactName(companyName: string): string {
  return `${companyName} Partnerships`;
}

function toMostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let winner: string | null = null;
  let max = -1;
  for (const [value, count] of counts.entries()) {
    if (count > max) {
      winner = value;
      max = count;
    }
  }

  return winner;
}

async function buildCompanyProfile(companyId: string) {
  const [company, industries, competencies, vacancies] = await Promise.all([
    database.getCompanyById(companyId),
    database.getIndustries(),
    database.getCompetencies(),
    database.getVacancies()
  ]);

  if (!company) {
    return null;
  }

  const industry = industries.find((item) => item.id === company.industryId);
  const topCompetencyIds = vacancies
    .filter((vacancy) => vacancy.companyName === company.name)
    .flatMap((vacancy) => vacancy.competencyIds);
  const topCompetencies = Array.from(new Set(topCompetencyIds))
    .map((id) => competencies.find((item) => item.id === id)?.name)
    .filter((value): value is string => Boolean(value))
    .slice(0, 5);
  const primaryContact = company.contacts[0];

  return {
    company,
    primaryContact,
    profile: {
      companyName: company.name,
      industryName: industry?.name ?? "Unknown industry",
      region: company.region,
      stage: company.stage,
      score: company.score,
      topCompetencies,
      ...(company.website ? { website: company.website } : {}),
      ...(primaryContact?.fullName ? { contactName: primaryContact.fullName } : {}),
      ...(primaryContact?.title ? { contactTitle: primaryContact.title } : {})
    }
  };
}

async function createSystemAuditEntry(action: string, entityType: string, entityId: string): Promise<void> {
  const adminUser = await database.findUserByEmail(env.ADMIN_EMAIL).catch(() => null);
  if (!adminUser) {
    return;
  }

  await database
    .createAuditLog({
      actorUserId: adminUser.id,
      action,
      entityType,
      entityId
    })
    .catch(() => undefined);
}

async function resolveAdaptiveRecommendation(companyId?: string) {
  const localRecommendation = await database.getAdaptiveRecommendation(companyId);
  if (!env.ML_USE_REMOTE_RECOMMENDER) {
    return localRecommendation;
  }

  try {
    const stats = await database.getAdaptiveRecommendationStats(companyId);
    return await requestRemoteAdaptiveRecommendation({
      scope: companyId ? "company" : "global",
      stats
    });
  } catch {
    return localRecommendation;
  }
}

async function handleJob(job: BackgroundJob): Promise<void> {
  console.log(
    JSON.stringify({
      scope: "worker.job",
      status: "started",
      jobId: job.id,
      queue: job.queue,
      type: job.type
    })
  );

  if (job.type === "hh-sync-vacancies") {
    const industryId = String(job.payload.industryId ?? "");
    const query = String(job.payload.query ?? "");
    const page = Number(job.payload.page ?? 0);
    const perPage = Number(job.payload.perPage ?? 20);
    const area = String(job.payload.area ?? "");

    if (!industryId || !query) {
      throw new Error("HH ingestion job payload is incomplete.");
    }

    const source =
      (await database.getIndustrySourceByKind(industryId, "hh")) ??
      (await database.upsertIndustrySource({
        industryId,
        source: "hh",
        status: "active",
        config: {
          query,
          page,
          perPage,
          area
        }
      }));

    const run = await database.createIngestionRun({
      industryId,
      sourceId: source.id,
      status: "running",
      query,
      page,
      perPage
    });

    await database.updateIngestionRun(run.id, {
      startedAt: new Date().toISOString(),
      status: "running"
    });

    try {
      const adapter = getSourceAdapter("hh");
      const searchInput: {
        query: string;
        page: number;
        perPage: number;
        area?: string;
        searchField: "name";
      } = {
        query,
        page,
        perPage,
        searchField: "name"
      };
      if (area) {
        searchInput.area = area;
      }

      const result = await adapter.searchVacancies(searchInput);
      console.log(
        JSON.stringify({
          scope: "worker.hh_ingestion",
          status: "fetched",
          jobId: job.id,
          industryId,
          query,
          page,
          perPage,
          found: result.found,
          returned: result.items.length
        })
      );

      let competencyCount = 0;

      for (const item of result.items) {
        const competencyNames = extractCompetencyCandidates(item);
        const competencyIds: string[] = [];

        for (const competencyName of competencyNames) {
          const competency = await database.upsertCompetencyByName(competencyName, "market");
          competencyIds.push(competency.id);
        }

        competencyCount += competencyIds.length;

        const vacancyInput: {
          externalId: string;
          source: "hh";
          title: string;
          companyName: string;
          industryId: string;
          competencyIds: string[];
          collectedAt: string;
          areaName?: string;
          employmentName?: string;
          experienceName?: string;
          scheduleName?: string;
          url?: string;
          alternateUrl?: string;
          requirement?: string;
          responsibility?: string;
          description?: string;
          salaryFrom?: number;
          salaryTo?: number;
          salaryCurrency?: string;
          publishedAt?: string;
        } = {
          externalId: item.externalId,
          source: "hh",
          title: item.title,
          companyName: item.companyName,
          industryId,
          competencyIds,
          collectedAt: new Date().toISOString()
        };

        const optionalFields = {
          areaName: item.areaName,
          employmentName: item.employmentName,
          experienceName: item.experienceName,
          scheduleName: item.scheduleName,
          url: item.url,
          alternateUrl: item.alternateUrl,
          requirement: item.requirement,
          responsibility: item.responsibility,
          description: item.description,
          salaryFrom: item.salaryFrom,
          salaryTo: item.salaryTo,
          salaryCurrency: item.salaryCurrency,
          publishedAt: item.publishedAt
        };

        for (const [key, value] of Object.entries(optionalFields)) {
          if (value !== undefined) {
            (vacancyInput as Record<string, string | number | string[] | undefined>)[key] = value as
              | string
              | number;
          }
        }

        await database.createOrUpdateVacancy(vacancyInput);
      }

      await database.updateIngestionRun(run.id, {
        status: "completed",
        totalFound: result.found,
        processedCount: result.items.length,
        competencyCount,
        finishedAt: new Date().toISOString(),
        errorMessage: null
      });

      console.log(
        JSON.stringify({
          scope: "worker.hh_ingestion",
          status: "completed",
          jobId: job.id,
          runId: run.id,
          industryId,
          query,
          processedCount: result.items.length,
          competencyCount
        })
      );
    } catch (error: unknown) {
      const message =
        error instanceof HhApiError
          ? `[${error.code}] ${error.message}${error.status ? ` status=${error.status}` : ""}${error.details ? ` details=${error.details}` : ""}`
          : error instanceof Error
            ? error.message
            : "Unknown HH ingestion error";

      console.error(
        JSON.stringify({
          scope: "worker.hh_ingestion",
          status: "failed",
          jobId: job.id,
          industryId,
          query,
          errorCode: error instanceof HhApiError ? error.code : "unknown",
          retryable: error instanceof HhApiError ? error.retryable : false,
          httpStatus: error instanceof HhApiError ? error.status : null,
          message
        })
      );

      await database.updateIngestionRun(run.id, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        errorMessage: message
      });
      throw error;
    }
  } else if (job.type === "refresh-company-pool") {
    const industryId = String(job.payload.industryId ?? "");
    const limit = Number(job.payload.limit ?? 50);

    if (!industryId) {
      throw new Error("Company discovery job payload is incomplete.");
    }

    const [vacancies, programCompetencies, industries, settings] = await Promise.all([
      database.getVacanciesByIndustry(industryId),
      database.getProgramCompetencies(),
      database.getIndustries(),
      database.getSettings()
    ]);
    const existingCompanies = await database.getCompanies({ industryId });

    const industry = industries.find((item) => item.id === industryId);
    const minimumApprovalScore = Number(
      settings.find((item) => item.key === "scoring.minimumApprovalScore")?.value ?? "75"
    );

    const vacancyGroups = new Map<
      string,
      Array<{
        title: string;
        areaName?: string;
        competencyIds: string[];
      }>
    >();

    for (const vacancy of vacancies) {
      const bucket = vacancyGroups.get(vacancy.companyName) ?? [];
      const nextItem: {
        title: string;
        areaName?: string;
        competencyIds: string[];
      } = {
        title: vacancy.title,
        competencyIds: vacancy.competencyIds
      };
      if (vacancy.areaName !== undefined) {
        nextItem.areaName = vacancy.areaName;
      }
      bucket.push(nextItem);
      vacancyGroups.set(vacancy.companyName, bucket);
    }

    let processedCompanies = 0;
    const programCompetencyIds = new Set(programCompetencies.map((item) => item.competencyId));

    for (const [companyName, companyVacancies] of Array.from(vacancyGroups.entries()).slice(0, limit)) {
      const competencyIds = new Set(companyVacancies.flatMap((item) => item.competencyIds));
      const matchedProgramCompetencies = Array.from(competencyIds).filter((id) => programCompetencyIds.has(id)).length;
      const region =
        toMostCommon(
          companyVacancies
            .map((item) => item.areaName)
            .filter((value): value is string => Boolean(value))
        ) ?? "Remote";
      const size = estimateCompanySize(companyVacancies.length);

      const provisionalScore = calculateDiscoveryScore({
        companyName,
        industryName: industry?.name ?? "Unknown industry",
        size,
        vacancyCount: companyVacancies.length,
        matchedProgramCompetencies,
        totalCompanyCompetencies: competencyIds.size,
        contactCount: 1,
        hasWebsite: false,
        region
      });
      const currentCompany = existingCompanies.find((item) => item.name === companyName);
      const stage =
        currentCompany &&
        ["shortlisted", "approved", "contacted", "replied", "partnered"].includes(currentCompany.stage)
          ? currentCompany.stage
          : deriveStageFromScore(provisionalScore.total, minimumApprovalScore);

      const company = await database.upsertCompany({
        name: companyName,
        industryId,
        region,
        size,
        stage
      });

      await database.upsertCompanyContact({
        companyId: company.id,
        fullName: toPartnershipContactName(companyName),
        title: "Partnership Lead"
      });

      await database.createCompanyScore({
        ...provisionalScore,
        companyId: company.id
      });

      await createSystemAuditEntry("company.discovered", "company", company.id);

      processedCompanies += 1;
    }

    console.log(
      JSON.stringify({
        scope: "worker.company_discovery",
        status: "completed",
        jobId: job.id,
        industryId,
        processedCompanies,
        discoveredFromVacancies: vacancies.length,
        minimumApprovalScore
      })
    );
  } else if (job.type === "send-outreach-campaign") {
    const campaignId = String(job.payload.campaignId ?? "");
    const draftIds = String(job.payload.draftIds ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!campaignId || draftIds.length === 0) {
      throw new Error("Outreach campaign payload is incomplete.");
    }

    const emailProvider = getEmailProvider();
    const followUpDays = Number(
      (await database.getSettings()).find((item) => item.key === "outreach.followUpDays")?.value ?? "10"
    );

    await database.updateOutreachCampaignStatus(campaignId, "approved");

    let sentCount = 0;

    for (const draftId of draftIds) {
      const draft = await database.getMessageDraftById(draftId);
      if (!draft?.approved) {
        continue;
      }

      const company = await database.getCompanyById(draft.companyId);
      const contact = company?.contacts.find((item) => item.id === draft.contactId);
      if (!company || !contact?.email) {
        continue;
      }

      const adaptiveRecommendation = await resolveAdaptiveRecommendation(company.id);
      const companyFollowUpDays = adaptiveRecommendation.recommendedFollowUpDays || followUpDays;

      const queuedMessage = await database.createMessage({
        companyId: company.id,
        contactId: contact.id,
        draftId: draft.id,
        campaignId,
        channel: "email",
        kind: "outreach-email",
        provider: emailProvider.name,
        status: "queued",
        subject: draft.subject,
        body: draft.body,
        followUpDueAt: new Date(Date.now() + companyFollowUpDays * 24 * 60 * 60 * 1000).toISOString()
      });

      await database.createMessageEvent({
        messageId: queuedMessage.id,
        type: "queued",
        payload: {
          campaignId,
          draftId: draft.id
        }
      });

      try {
        const delivery = await emailProvider.sendMessage({
          to: contact.email,
          subject: draft.subject,
          body: draft.body,
          replyTo: env.EMAIL_FROM
        });

        const sentAt = new Date().toISOString();
        const deliveredMessage = await database.updateMessage(queuedMessage.id, {
          provider: delivery.provider,
          providerMessageId: delivery.providerMessageId,
          status: "delivered",
          sentAt,
          deliveredAt: delivery.deliveredAt,
          lastError: null
        });

        await database.createMessageEvent({
          messageId: deliveredMessage.id,
          type: "sent",
          payload: {
            provider: delivery.provider,
            providerMessageId: delivery.providerMessageId
          }
        });
        await database.createMessageEvent({
          messageId: deliveredMessage.id,
          type: "delivered",
          payload: {
            deliveredAt: delivery.deliveredAt
          }
        });
        await database.createMemoryEvent({
          companyId: company.id,
          eventType: "outreach_delivered",
          payload: {
            messageId: deliveredMessage.id,
            draftId: draft.id,
            tone: draft.tone,
            followUpDays: companyFollowUpDays,
            adaptiveScope: adaptiveRecommendation.scope
          }
        });

        await database.updateCompanyStage(company.id, company.stage === "replied" ? "replied" : "contacted");
        sentCount += 1;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown email provider error";
        await database.updateMessage(queuedMessage.id, {
          status: "failed",
          lastError: message
        });
        await database.createMessageEvent({
          messageId: queuedMessage.id,
          type: "failed",
          payload: {
            error: message
          }
        });
        await database.createMemoryEvent({
          companyId: company.id,
          eventType: "outreach_failed",
          payload: {
            messageId: queuedMessage.id,
            draftId: draft.id,
            tone: draft.tone,
            error: message
          }
        });
      }
    }

    await database.updateOutreachCampaignStatus(campaignId, sentCount > 0 ? "sent" : "draft");
    console.log(
      JSON.stringify({
        scope: "worker.outreach_campaign",
        status: "completed",
        jobId: job.id,
        campaignId,
        sentCount
      })
    );
  } else if (job.type === "run-follow-up-scheduler") {
    const dueBefore = String(job.payload.dueBefore ?? new Date().toISOString());
    const pendingMessages = await database.getPendingFollowUpMessages(dueBefore);
    let createdCount = 0;

    for (const message of pendingMessages) {
      const draft = message.draftId ? await database.getMessageDraftById(message.draftId) : null;
      const profileBundle = await buildCompanyProfile(message.companyId);
      if (!profileBundle?.primaryContact) {
        continue;
      }

      const tone = draft?.tone ?? "neutral";
      const followUpDraft = generateFollowUpDraft({
        ...profileBundle.profile,
        tone,
        contactName: profileBundle.primaryContact.fullName,
        contactTitle: profileBundle.primaryContact.title
      });

      const followUpInput: {
        companyId: string;
        contactId: string;
        parentMessageId: string;
        channel: "email";
        kind: "follow-up-email";
        provider: string;
        status: "delivered";
        subject: string;
        body: string;
        sentAt: string;
        deliveredAt: string;
        draftId?: string;
        campaignId?: string;
      } = {
        companyId: message.companyId,
        contactId: message.contactId,
        parentMessageId: message.id,
        channel: "email",
        kind: "follow-up-email",
        provider: getEmailProvider().name,
        status: "delivered",
        subject: followUpDraft.subject,
        body: followUpDraft.body,
        sentAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString()
      };
      if (message.draftId) {
        followUpInput.draftId = message.draftId;
      }
      if (message.campaignId) {
        followUpInput.campaignId = message.campaignId;
      }

      const followUpMessage = await database.createMessage(followUpInput);

      await database.createMessageEvent({
        messageId: message.id,
        type: "follow-up-scheduled",
        payload: {
          followUpMessageId: followUpMessage.id
        }
      });
      await database.createMessageEvent({
        messageId: followUpMessage.id,
        type: "sent",
        payload: {
          parentMessageId: message.id,
          autoGenerated: true
        }
      });
      await database.createMemoryEvent({
        companyId: message.companyId,
        eventType: "follow_up_sent",
        payload: {
          messageId: followUpMessage.id,
          parentMessageId: message.id,
          tone
        }
      });
      createdCount += 1;
    }

    console.log(
      JSON.stringify({
        scope: "worker.follow_up",
        status: "completed",
        jobId: job.id,
        dueBefore,
        createdCount
      })
    );
  } else if (job.type === "process-simulated-reply") {
    const messageId = String(job.payload.messageId ?? "");
    const body = String(job.payload.body ?? "");
    const incomingFrom = String(job.payload.incomingFrom ?? "");

    if (!messageId || !body) {
      throw new Error("Reply processing payload is incomplete.");
    }

    const message = await database.getMessageById(messageId);
    if (!message) {
      throw new Error("Reply target message not found.");
    }
    const sourceDraft = message.draftId ? await database.getMessageDraftById(message.draftId) : null;

    const classification = classifyReplyCategory(body);
    const replyInput: {
      messageId: string;
      companyId: string;
      category: "interest" | "decline" | "question" | "meeting";
      summary: string;
      rawBody: string;
      positive: boolean;
      escalated: boolean;
      incomingFrom?: string;
    } = {
      messageId: message.id,
      companyId: message.companyId,
      category: classification.category,
      summary: classification.summary,
      rawBody: body,
      positive: classification.positive,
      escalated: classification.positive
    };
    if (incomingFrom) {
      replyInput.incomingFrom = incomingFrom;
    }

    const reply = await database.createReply(replyInput);

    await database.updateMessage(message.id, {
      status: "replied",
      repliedAt: new Date().toISOString()
    });
    await database.updateCompanyStage(message.companyId, "replied");
    await database.createMessageEvent({
      messageId: message.id,
      type: "replied",
      payload: {
        replyId: reply.id,
        category: reply.category,
        positive: reply.positive
      }
    });
    await database.createMemoryEvent({
      companyId: message.companyId,
      eventType: "reply_received",
      payload: {
        messageId: message.id,
        replyId: reply.id,
        category: reply.category,
        positive: reply.positive,
        tone: sourceDraft?.tone ?? "unknown",
        kind: message.kind
      }
    });

    if (classification.positive) {
      await database.createMessageEvent({
        messageId: message.id,
        type: "escalated",
        payload: {
          replyId: reply.id,
          workflow: "positive-reply-escalation"
        }
      });
      await database.createJob({
        queue: "partner-escalation",
        type: "positive-reply-escalation",
        status: "queued",
        attempts: 0,
        maxAttempts: 3,
        payload: {
          messageId: message.id,
          replyId: reply.id,
          companyId: message.companyId
        }
      });
    }

    console.log(
      JSON.stringify({
        scope: "worker.reply_processing",
        status: "completed",
        jobId: job.id,
        messageId,
        category: reply.category,
        positive: reply.positive
      })
    );
  } else if (job.type === "positive-reply-escalation") {
    const companyId = String(job.payload.companyId ?? "");
    const replyId = String(job.payload.replyId ?? "");

    await database.createMemoryEvent({
      companyId,
      eventType: "positive_reply_escalated",
      payload: {
        replyId,
        workflow: "human_follow_up"
      }
    });

    console.log(
      JSON.stringify({
        scope: "worker.escalation",
        status: "completed",
        jobId: job.id,
        companyId,
        replyId
      })
    );
  } else {
    await sleep(300);
  }

  await database.completeJob(job.id);
  runtimeState.processedCount += 1;
  runtimeState.lastProcessedAt = new Date().toISOString();
  runtimeState.lastError = null;
  console.log(
    JSON.stringify({
      scope: "worker.job",
      status: "completed",
      jobId: job.id,
      queue: job.queue,
      type: job.type
    })
  );
}

async function processNextJob(): Promise<void> {
  try {
    const reachable = await database.canReachDatabase();
    if (!reachable) {
      runtimeState.mode = "idle";
      runtimeState.lastError = "Database is not reachable.";
      return;
    }

    runtimeState.mode = "database";
    const job = await database.claimNextJob();
    if (!job) {
      return;
    }

    await handleJob(job);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    runtimeState.lastError = message;
    console.error(
      JSON.stringify({
        scope: "worker.runtime",
        status: "failed",
        message
      })
    );

    const jobs = await database.getJobs().catch(() => []);
    const activeJob = jobs.find((job) => job.status === "running");
    if (activeJob) {
      await database.failJob(activeJob.id, message).catch(() => undefined);
    }
  }
}

function main(): void {
  const server = createServer((_, res) => {
    void (async () => {
      const jobStats = await database.getJobStats().catch(() => ({
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0
      }));

      const payload = jsonResponse({
        ...readinessProbe("worker"),
        mode: runtimeState.mode,
        processedCount: runtimeState.processedCount,
        lastProcessedAt: runtimeState.lastProcessedAt,
        lastError: runtimeState.lastError,
        pollMs: env.WORKER_POLL_MS,
        jobs: jobStats
      });

      res.writeHead(payload.statusCode, payload.headers);
      res.end(payload.body);
    })();
  });

  server.listen(env.WORKER_PORT, () => {
    const status = readinessProbe("worker");
    console.log(`[worker] ${status.service} is listening on port ${env.WORKER_PORT}`);
  });

  void processNextJob();
  setInterval(() => {
    void processNextJob();
  }, env.WORKER_POLL_MS);
}

main();
