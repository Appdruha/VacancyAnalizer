import { database } from "@edagent/database";
import type { BackgroundJob } from "@edagent/domain";
import { getEmailProvider } from "@edagent/integrations";
import { resolveAdaptiveRecommendation } from "../services/adaptive-recommendation.js";
import { deliverQueuedEmailMessage } from "../services/email-delivery.js";

export async function handleSendOutreachCampaignJob(job: BackgroundJob): Promise<void> {
  const campaignId = String(job.payload.campaignId ?? "");
  const draftIds = String(job.payload.draftIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!campaignId || draftIds.length === 0) {
    throw new Error("Outreach campaign payload is incomplete.");
  }

  const followUpDays = Number(
    (await database.getSettings()).find((item) => item.key === "outreach.followUpDays")?.value ?? "10"
  );
  const emailProviderName = getEmailProvider().name;

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
      provider: emailProviderName,
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

    const delivery = await deliverQueuedEmailMessage({
      queuedMessageId: queuedMessage.id,
      to: contact.email,
      subject: draft.subject,
      body: draft.body,
      companyId: company.id,
      memoryEventTypeOnSuccess: "outreach_delivered",
      memoryPayloadOnSuccess: {
        draftId: draft.id,
        tone: draft.tone,
        followUpDays: companyFollowUpDays,
        adaptiveScope: adaptiveRecommendation.scope
      },
      memoryEventTypeOnFailure: "outreach_failed",
      memoryPayloadOnFailure: {
        draftId: draft.id,
        tone: draft.tone
      }
    });

    if (delivery.status === "delivered") {
      await database.updateCompanyStage(company.id, company.stage === "replied" ? "replied" : "contacted");
      sentCount += 1;
    } else {
      console.error(
        JSON.stringify({
          scope: "worker.outreach_campaign",
          status: "failed",
          jobId: job.id,
          campaignId,
          messageId: queuedMessage.id,
          message: delivery.message
        })
      );
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
}
