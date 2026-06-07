import { database } from "@edagent/database";
import type { BackgroundJob } from "@edagent/domain";

export async function handlePositiveReplyEscalationJob(job: BackgroundJob): Promise<void> {
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
}
