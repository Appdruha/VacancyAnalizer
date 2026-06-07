import type {
  AgentMemoryEvent,
  BackgroundJob,
  CommunicationPackage,
  KnowledgeChunk,
  KnowledgeDocument,
  IndustrySource,
  IngestionRun,
  Message,
  MessageEvent,
  MessageStatus,
  OutreachCampaign,
  PartnerAgreement,
  ProjectBrief,
  Reply,
  Vacancy
} from "@edagent/domain";
import {
  jsonRecord,
  jsonNumberArray,
  jsonRoles,
  jsonStringArray,
  toKnowledgeDocumentKind,
  toCommunicationPackageKind,
  toMessageEventType,
  toMessageKind,
  withOptional
} from "./shared.js";

export function toMessage(row: any): Message {
  let message: Message = {
    id: row.id,
    companyId: row.companyId,
    contactId: row.contactId,
    channel: row.channel,
    kind: toMessageKind(row.kind),
    provider: row.provider,
    status: row.status as MessageStatus,
    subject: row.subject,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  message = withOptional(message, "draftId", row.draftId ?? undefined);
  message = withOptional(message, "campaignId", row.campaignId ?? undefined);
  message = withOptional(message, "parentMessageId", row.parentMessageId ?? undefined);
  message = withOptional(message, "providerMessageId", row.providerMessageId ?? undefined);
  message = withOptional(message, "lastError", row.lastError ?? undefined);
  message = withOptional(message, "followUpDueAt", row.followUpDueAt ? row.followUpDueAt.toISOString() : undefined);
  message = withOptional(message, "sentAt", row.sentAt ? row.sentAt.toISOString() : undefined);
  message = withOptional(message, "deliveredAt", row.deliveredAt ? row.deliveredAt.toISOString() : undefined);
  message = withOptional(message, "repliedAt", row.repliedAt ? row.repliedAt.toISOString() : undefined);
  return message;
}

export function toMessageEvent(row: any): MessageEvent {
  return {
    id: row.id,
    messageId: row.messageId,
    type: toMessageEventType(row.type),
    payload: jsonRecord(row.payload),
    createdAt: row.createdAt.toISOString()
  };
}

export function toOutreachCampaign(row: any): OutreachCampaign {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toPartnerAgreement(row: any): PartnerAgreement {
  let agreement: PartnerAgreement = {
    id: row.id,
    companyId: row.companyId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  agreement = withOptional(agreement, "signedAt", row.signedAt ? row.signedAt.toISOString() : undefined);
  return agreement;
}

export function toProjectBrief(row: any): ProjectBrief {
  return {
    id: row.id,
    partnerAgreementId: row.partnerAgreementId,
    title: row.title,
    summary: row.summary,
    roles: jsonRoles(row.roles),
    competencyIds: Array.isArray(row.competencies) ? row.competencies.map((item: any) => item.competencyId) : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function toCommunicationPackage(row: any): CommunicationPackage {
  let communicationPackage: CommunicationPackage = {
    id: row.id,
    companyId: row.companyId,
    kind: toCommunicationPackageKind(row.kind),
    title: row.title,
    summary: row.summary,
    body: row.body,
    bullets: jsonStringArray(row.bullets),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  communicationPackage = withOptional(
    communicationPackage,
    "partnerAgreementId",
    row.partnerAgreementId ?? undefined
  );
  return communicationPackage;
}

export function toReply(row: any): Reply {
  let reply: Reply = {
    id: row.id,
    companyId: row.companyId,
    category: row.category,
    summary: row.summary,
    positive: row.positive,
    escalated: row.escalated,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  reply = withOptional(reply, "messageId", row.messageId ?? undefined);
  reply = withOptional(reply, "incomingFrom", row.incomingFrom ?? undefined);
  reply = withOptional(reply, "rawBody", row.rawBody ?? undefined);
  return reply;
}

export function toMemoryEvent(row: any): AgentMemoryEvent {
  let event: AgentMemoryEvent = {
    id: row.id,
    eventType: row.eventType,
    payload: jsonRecord(row.payload),
    createdAt: row.createdAt.toISOString()
  };

  event = withOptional(event, "companyId", row.companyId ?? undefined);
  return event;
}

export function toKnowledgeDocument(row: any): KnowledgeDocument {
  let document: KnowledgeDocument = {
    id: row.id,
    kind: toKnowledgeDocumentKind(row.kind),
    title: row.title,
    sourceRef: row.sourceRef,
    content: row.content,
    metadata: jsonRecord(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  document = withOptional(document, "companyId", row.companyId ?? undefined);
  return document;
}

export function toKnowledgeChunk(row: any): KnowledgeChunk {
  let chunk: KnowledgeChunk = {
    id: row.id,
    documentId: row.documentId,
    chunkIndex: row.chunkIndex,
    content: row.content,
    tokenCount: row.tokenCount,
    embedding: jsonNumberArray(row.embedding),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  chunk = withOptional(chunk, "companyId", row.companyId ?? undefined);
  return chunk;
}

export function toBackgroundJob(row: any): BackgroundJob {
  return withOptional(
    {
      id: row.id,
      queue: row.queue,
      type: row.type,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      payload: jsonRecord(row.payload),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    },
    "lastError",
    row.lastError ?? undefined
  );
}

export function toIndustrySource(row: any): IndustrySource {
  return {
    id: row.id,
    industryId: row.industryId,
    source: row.source,
    status: row.status,
    config: jsonRecord(row.config)
  };
}

export function toIngestionRun(row: any): IngestionRun {
  let run: IngestionRun = {
    id: row.id,
    industryId: row.industryId,
    sourceId: row.sourceId,
    status: row.status,
    query: row.query,
    processedCount: row.processedCount,
    competencyCount: row.competencyCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  run = withOptional(run, "page", row.page ?? undefined);
  run = withOptional(run, "perPage", row.perPage ?? undefined);
  run = withOptional(run, "totalFound", row.totalFound ?? undefined);
  run = withOptional(run, "startedAt", row.startedAt ? row.startedAt.toISOString() : undefined);
  run = withOptional(run, "finishedAt", row.finishedAt ? row.finishedAt.toISOString() : undefined);
  run = withOptional(run, "errorMessage", row.errorMessage ?? undefined);
  return run;
}

export function toVacancy(row: any): Vacancy {
  let vacancy: Vacancy = {
    id: row.id,
    source: row.source,
    title: row.title,
    companyName: row.companyName,
    industryId: row.industryId,
    competencyIds: Array.isArray(row.competencies) ? row.competencies.map((item: any) => item.competencyId) : [],
    collectedAt: row.collectedAt.toISOString()
  };

  vacancy = withOptional(vacancy, "externalId", row.externalId ?? undefined);
  vacancy = withOptional(vacancy, "areaName", row.areaName ?? undefined);
  vacancy = withOptional(vacancy, "employmentName", row.employmentName ?? undefined);
  vacancy = withOptional(vacancy, "experienceName", row.experienceName ?? undefined);
  vacancy = withOptional(vacancy, "scheduleName", row.scheduleName ?? undefined);
  vacancy = withOptional(vacancy, "url", row.url ?? undefined);
  vacancy = withOptional(vacancy, "alternateUrl", row.alternateUrl ?? undefined);
  vacancy = withOptional(vacancy, "requirement", row.requirement ?? undefined);
  vacancy = withOptional(vacancy, "responsibility", row.responsibility ?? undefined);
  vacancy = withOptional(vacancy, "description", row.description ?? undefined);
  vacancy = withOptional(vacancy, "salaryFrom", row.salaryFrom ?? undefined);
  vacancy = withOptional(vacancy, "salaryTo", row.salaryTo ?? undefined);
  vacancy = withOptional(vacancy, "salaryCurrency", row.salaryCurrency ?? undefined);
  vacancy = withOptional(vacancy, "publishedAt", row.publishedAt ? row.publishedAt.toISOString() : undefined);
  return vacancy;
}
