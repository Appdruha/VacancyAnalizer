import type { BackgroundJob } from "@edagent/domain";
import { handleHhSyncVacanciesJob } from "./jobs/hh-sync-vacancies.js";
import { handlePositiveReplyEscalationJob } from "./jobs/positive-reply-escalation.js";
import { handleProcessSimulatedReplyJob } from "./jobs/process-simulated-reply.js";
import { handleRefreshCompanyPoolJob } from "./jobs/refresh-company-pool.js";
import { handleRunFollowUpSchedulerJob } from "./jobs/run-follow-up-scheduler.js";
import { handleSendOutreachCampaignJob } from "./jobs/send-outreach-campaign.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function dispatchJob(job: BackgroundJob): Promise<void> {
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
    await handleHhSyncVacanciesJob(job);
    return;
  }

  if (job.type === "refresh-company-pool") {
    await handleRefreshCompanyPoolJob(job);
    return;
  }

  if (job.type === "send-outreach-campaign") {
    await handleSendOutreachCampaignJob(job);
    return;
  }

  if (job.type === "run-follow-up-scheduler") {
    await handleRunFollowUpSchedulerJob(job);
    return;
  }

  if (job.type === "process-simulated-reply") {
    await handleProcessSimulatedReplyJob(job);
    return;
  }

  if (job.type === "positive-reply-escalation") {
    await handlePositiveReplyEscalationJob(job);
    return;
  }

  await sleep(300);
}
