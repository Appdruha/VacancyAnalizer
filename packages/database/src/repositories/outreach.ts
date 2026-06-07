import type {
  Message,
  MessageDraft,
  MessageEvent,
  MessageEventType,
  MessageKind,
  MessageStatus,
  OutreachCampaign,
  Reply
} from "@edagent/domain";
import { getPrismaClient } from "../client.js";
import { toMessage, toMessageEvent, toOutreachCampaign, toReply } from "../mappers.js";
import { fromMessageEventType, fromMessageKind } from "../shared.js";

export async function getMessageDrafts(input?: {
  companyId?: string;
  contactId?: string;
  approved?: boolean;
}): Promise<MessageDraft[]> {
  const rows = await getPrismaClient().messageDraft.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.contactId ? { contactId: input.contactId } : {}),
      ...(input?.approved !== undefined ? { approved: input.approved } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => ({
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    subject: row.subject,
    body: row.body,
    tone: row.tone,
    approved: row.approved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
}

export async function createMessageDraft(input: Omit<MessageDraft, "id" | "createdAt" | "updatedAt">): Promise<MessageDraft> {
  const row = await getPrismaClient().messageDraft.create({
    data: {
      companyId: input.companyId,
      contactId: input.contactId,
      subject: input.subject,
      body: input.body,
      tone: input.tone,
      approved: input.approved
    }
  });

  return {
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    subject: row.subject,
    body: row.body,
    tone: row.tone,
    approved: row.approved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function updateMessageDraftApproval(id: string, approved: boolean): Promise<MessageDraft | null> {
  const row = await getPrismaClient().messageDraft.update({
    where: { id },
    data: { approved }
  });

  return {
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    subject: row.subject,
    body: row.body,
    tone: row.tone,
    approved: row.approved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function getOutreachCampaigns(): Promise<OutreachCampaign[]> {
  const rows = await getPrismaClient().outreachCampaign.findMany({
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toOutreachCampaign(row));
}

export async function createOutreachCampaign(input: Omit<OutreachCampaign, "id" | "createdAt" | "updatedAt">): Promise<OutreachCampaign> {
  const row = await getPrismaClient().outreachCampaign.create({
    data: {
      name: input.name,
      channel: input.channel,
      status: input.status
    }
  });

  return toOutreachCampaign(row);
}

export async function updateOutreachCampaignStatus(id: string, status: OutreachCampaign["status"]): Promise<OutreachCampaign> {
  const row = await getPrismaClient().outreachCampaign.update({
    where: { id },
    data: { status }
  });

  return toOutreachCampaign(row);
}

export async function getMessageDraftById(id: string): Promise<MessageDraft | null> {
  const row = await getPrismaClient().messageDraft.findUnique({
    where: { id }
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    subject: row.subject,
    body: row.body,
    tone: row.tone,
    approved: row.approved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function getMessages(input?: {
  companyId?: string;
  campaignId?: string;
  status?: MessageStatus;
  kind?: MessageKind;
}): Promise<Message[]> {
  const rows = await getPrismaClient().message.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input?.status ? { status: input.status } : {}),
      ...(input?.kind ? { kind: fromMessageKind(input.kind) } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toMessage(row));
}

export async function getMessageById(id: string): Promise<Message | null> {
  const row = await getPrismaClient().message.findUnique({
    where: { id }
  });

  return row ? toMessage(row) : null;
}

export async function createMessage(input: Omit<Message, "id" | "createdAt" | "updatedAt">): Promise<Message> {
  const row = await getPrismaClient().message.create({
    data: {
      companyId: input.companyId,
      contactId: input.contactId,
      draftId: input.draftId ?? null,
      campaignId: input.campaignId ?? null,
      parentMessageId: input.parentMessageId ?? null,
      channel: input.channel,
      kind: fromMessageKind(input.kind),
      provider: input.provider,
      providerMessageId: input.providerMessageId ?? null,
      status: input.status,
      subject: input.subject,
      body: input.body,
      lastError: input.lastError ?? null,
      followUpDueAt: input.followUpDueAt ? new Date(input.followUpDueAt) : null,
      sentAt: input.sentAt ? new Date(input.sentAt) : null,
      deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
      repliedAt: input.repliedAt ? new Date(input.repliedAt) : null
    }
  });

  return toMessage(row);
}

export async function updateMessage(id: string, input: Partial<{
  status: MessageStatus;
  provider: string;
  providerMessageId: string | null;
  lastError: string | null;
  followUpDueAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  repliedAt: string | null;
}>): Promise<Message> {
  const data: Record<string, unknown> = {};
  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.provider !== undefined) {
    data.provider = input.provider;
  }
  if (input.providerMessageId !== undefined) {
    data.providerMessageId = input.providerMessageId;
  }
  if (input.lastError !== undefined) {
    data.lastError = input.lastError;
  }
  if (input.followUpDueAt !== undefined) {
    data.followUpDueAt = input.followUpDueAt ? new Date(input.followUpDueAt) : null;
  }
  if (input.sentAt !== undefined) {
    data.sentAt = input.sentAt ? new Date(input.sentAt) : null;
  }
  if (input.deliveredAt !== undefined) {
    data.deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : null;
  }
  if (input.repliedAt !== undefined) {
    data.repliedAt = input.repliedAt ? new Date(input.repliedAt) : null;
  }

  const row = await getPrismaClient().message.update({
    where: { id },
    data: data as never
  });

  return toMessage(row);
}

export async function getMessageEvents(input?: { messageId?: string; type?: MessageEventType }): Promise<MessageEvent[]> {
  const rows = await getPrismaClient().messageEvent.findMany({
    where: {
      ...(input?.messageId ? { messageId: input.messageId } : {}),
      ...(input?.type ? { type: fromMessageEventType(input.type) } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toMessageEvent(row));
}

export async function createMessageEvent(input: {
  messageId: string;
  type: MessageEventType;
  payload: Record<string, string | number | boolean | null>;
}): Promise<MessageEvent> {
  const row = await getPrismaClient().messageEvent.create({
    data: {
      messageId: input.messageId,
      type: fromMessageEventType(input.type),
      payload: input.payload as never
    }
  });

  return toMessageEvent(row);
}

export async function getReplies(input?: { companyId?: string; category?: Reply["category"] }): Promise<Reply[]> {
  const rows = await getPrismaClient().reply.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.category ? { category: input.category } : {})
    },
    orderBy: { createdAt: "desc" }
  });

  return rows.map((row: any) => toReply(row));
}

export async function createReply(input: Omit<Reply, "id" | "createdAt" | "updatedAt">): Promise<Reply> {
  const row = await getPrismaClient().reply.create({
    data: {
      messageId: input.messageId ?? null,
      companyId: input.companyId,
      category: input.category,
      summary: input.summary,
      incomingFrom: input.incomingFrom ?? null,
      rawBody: input.rawBody ?? null,
      positive: input.positive,
      escalated: input.escalated
    }
  });

  return toReply(row);
}

export async function getPendingFollowUpMessages(dueBefore: string): Promise<Message[]> {
  const rows = await getPrismaClient().message.findMany({
    where: {
      kind: "outreach_email",
      status: {
        in: ["sent", "delivered"]
      },
      followUpDueAt: {
        lte: new Date(dueBefore)
      },
      reply: null,
      followUps: {
        none: {}
      }
    },
    orderBy: { followUpDueAt: "asc" }
  });

  return rows.map((row: any) => toMessage(row));
}
