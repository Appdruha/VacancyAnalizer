import { database } from "@edagent/database";
import type { BackgroundJob } from "@edagent/domain";
import { classifyReplyCategory } from "@edagent/integrations";

export async function handleProcessSimulatedReplyJob(job: BackgroundJob): Promise<void> {
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
}
