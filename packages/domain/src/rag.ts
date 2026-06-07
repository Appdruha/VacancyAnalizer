import type { EntityId, ISODateTime } from "./common.js";

export type KnowledgeDocumentKind =
  | "company_profile"
  | "vacancy"
  | "communication_package"
  | "project_brief"
  | "memory_event"
  | "reply";

export type KnowledgeDocument = {
  id: EntityId;
  companyId?: EntityId;
  kind: KnowledgeDocumentKind;
  title: string;
  sourceRef: string;
  content: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type KnowledgeChunk = {
  id: EntityId;
  documentId: EntityId;
  companyId?: EntityId;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding: number[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type RagSearchHit = {
  chunkId: EntityId;
  documentId: EntityId;
  companyId?: EntityId;
  documentKind: KnowledgeDocumentKind;
  title: string;
  sourceRef: string;
  content: string;
  similarity: number;
  metadata: Record<string, string | number | boolean | null>;
};
