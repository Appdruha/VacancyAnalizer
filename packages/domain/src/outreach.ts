import type { EntityId, ISODateTime } from "./common.js";

export type ReplyCategory = "interest" | "decline" | "question" | "meeting";
export type MessageStatus = "queued" | "sent" | "delivered" | "replied" | "failed";
export type MessageKind = "outreach-email" | "follow-up-email";
export type MessageEventType =
  | "queued"
  | "sent"
  | "delivered"
  | "replied"
  | "failed"
  | "follow-up-scheduled"
  | "escalated";

export type OutreachChannel = "email" | "linkedin";

export type OutreachCampaign = {
  id: EntityId;
  name: string;
  channel: OutreachChannel;
  status: "draft" | "approved" | "sent";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type MessageDraft = {
  id: EntityId;
  companyId: EntityId;
  contactId: EntityId;
  subject: string;
  body: string;
  tone: "formal" | "neutral" | "friendly";
  approved: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type Message = {
  id: EntityId;
  companyId: EntityId;
  contactId: EntityId;
  draftId?: EntityId;
  campaignId?: EntityId;
  parentMessageId?: EntityId;
  channel: OutreachChannel;
  kind: MessageKind;
  provider: string;
  providerMessageId?: string;
  status: MessageStatus;
  subject: string;
  body: string;
  lastError?: string;
  followUpDueAt?: ISODateTime;
  sentAt?: ISODateTime;
  deliveredAt?: ISODateTime;
  repliedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type MessageEvent = {
  id: EntityId;
  messageId: EntityId;
  type: MessageEventType;
  payload: Record<string, string | number | boolean | null>;
  createdAt: ISODateTime;
};

export type Reply = {
  id: EntityId;
  messageId?: EntityId;
  companyId: EntityId;
  category: ReplyCategory;
  summary: string;
  incomingFrom?: string;
  rawBody?: string;
  positive: boolean;
  escalated: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};
