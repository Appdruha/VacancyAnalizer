import { env } from "@edagent/config";
import { database } from "@edagent/database";
import { EmailProviderError, getEmailProvider } from "@edagent/integrations";

export async function deliverQueuedEmailMessage(input: {
  queuedMessageId: string;
  to: string;
  subject: string;
  body: string;
  companyId: string;
  memoryEventTypeOnSuccess: "outreach_delivered" | "follow_up_sent";
  memoryPayloadOnSuccess: Record<string, string | number | boolean | null>;
  memoryEventTypeOnFailure: "outreach_failed" | "follow_up_failed";
  memoryPayloadOnFailure: Record<string, string | number | boolean | null>;
  eventPayloadOnSent?: Record<string, string | number | boolean | null>;
  eventPayloadOnDelivered?: Record<string, string | number | boolean | null>;
}): Promise<{ status: "delivered" } | { status: "failed"; message: string }> {
  const emailProvider = getEmailProvider();

  try {
    const delivery = await emailProvider.sendMessage({
      to: input.to,
      subject: input.subject,
      body: input.body,
      replyTo: env.EMAIL_FROM
    });

    const sentAt = new Date().toISOString();
    const deliveredMessage = await database.updateMessage(input.queuedMessageId, {
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
        providerMessageId: delivery.providerMessageId,
        ...(input.eventPayloadOnSent ?? {})
      }
    });
    await database.createMessageEvent({
      messageId: deliveredMessage.id,
      type: "delivered",
      payload: {
        deliveredAt: delivery.deliveredAt,
        ...(input.eventPayloadOnDelivered ?? {})
      }
    });
    await database.createMemoryEvent({
      companyId: input.companyId,
      eventType: input.memoryEventTypeOnSuccess,
      payload: {
        messageId: deliveredMessage.id,
        ...input.memoryPayloadOnSuccess
      }
    });

    return { status: "delivered" };
  } catch (error: unknown) {
    const message =
      error instanceof EmailProviderError
        ? `[${error.code}] ${error.message}${error.status ? ` status=${error.status}` : ""}${error.details ? ` details=${error.details}` : ""}`
        : error instanceof Error
          ? error.message
          : "Unknown email provider error";

    await database.updateMessage(input.queuedMessageId, {
      status: "failed",
      lastError: message
    });
    await database.createMessageEvent({
      messageId: input.queuedMessageId,
      type: "failed",
      payload: {
        error: message
      }
    });
    await database.createMemoryEvent({
      companyId: input.companyId,
      eventType: input.memoryEventTypeOnFailure,
      payload: {
        messageId: input.queuedMessageId,
        error: message,
        ...input.memoryPayloadOnFailure
      }
    });

    return {
      status: "failed",
      message
    };
  }
}
