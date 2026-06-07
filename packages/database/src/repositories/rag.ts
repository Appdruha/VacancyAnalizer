import type { KnowledgeChunk, KnowledgeDocument, RagSearchHit } from "@edagent/domain";
import { cosineSimilarity } from "@edagent/ai";
import { getPrismaClient } from "../client.js";
import { toKnowledgeChunk, toKnowledgeDocument } from "../mappers.js";
import { fromKnowledgeDocumentKind, jsonRecord } from "../shared.js";

export async function getKnowledgeDocuments(input?: {
  companyId?: string;
  kind?: KnowledgeDocument["kind"];
}): Promise<KnowledgeDocument[]> {
  const rows = await (getPrismaClient() as any).knowledgeDocument.findMany({
    where: {
      ...(input?.companyId ? { companyId: input.companyId } : {}),
      ...(input?.kind ? { kind: fromKnowledgeDocumentKind(input.kind) } : {})
    },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }]
  });

  return rows.map((row: any) => toKnowledgeDocument(row));
}

export async function upsertKnowledgeDocument(input: Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">): Promise<KnowledgeDocument> {
  const row = await (getPrismaClient() as any).knowledgeDocument.upsert({
    where: {
      kind_sourceRef: {
        kind: fromKnowledgeDocumentKind(input.kind),
        sourceRef: input.sourceRef
      }
    },
    update: {
      companyId: input.companyId ?? null,
      title: input.title,
      content: input.content,
      metadata: input.metadata as never
    },
    create: {
      companyId: input.companyId ?? null,
      kind: fromKnowledgeDocumentKind(input.kind),
      title: input.title,
      sourceRef: input.sourceRef,
      content: input.content,
      metadata: input.metadata as never
    }
  });

  return toKnowledgeDocument(row);
}

export async function replaceKnowledgeChunks(input: {
  documentId: string;
  companyId?: string;
  items: Array<Pick<KnowledgeChunk, "chunkIndex" | "content" | "tokenCount" | "embedding">>;
}): Promise<KnowledgeChunk[]> {
  const prisma = getPrismaClient() as any;
  await prisma.knowledgeChunk.deleteMany({
    where: { documentId: input.documentId }
  });

  if (input.items.length === 0) {
    return [];
  }

  await prisma.knowledgeChunk.createMany({
    data: input.items.map((item) => ({
      documentId: input.documentId,
      companyId: input.companyId ?? null,
      chunkIndex: item.chunkIndex,
      content: item.content,
      tokenCount: item.tokenCount,
      embedding: item.embedding
    }))
  });

  const rows = await prisma.knowledgeChunk.findMany({
    where: { documentId: input.documentId },
    orderBy: { chunkIndex: "asc" }
  });

  return rows.map((row: any) => toKnowledgeChunk(row));
}

export async function searchKnowledgeChunks(input: {
  queryEmbedding: number[];
  companyId?: string;
  limit?: number;
}): Promise<RagSearchHit[]> {
  const rows = await (getPrismaClient() as any).knowledgeChunk.findMany({
    where: {
      ...(input.companyId ? { companyId: input.companyId } : {})
    },
    include: {
      document: true
    }
  });

  return rows
    .map((row: any): RagSearchHit => {
      const similarity = cosineSimilarity(input.queryEmbedding, Array.isArray(row.embedding) ? row.embedding : []);
      return {
        chunkId: row.id,
        documentId: row.documentId,
        ...(row.companyId ? { companyId: row.companyId } : {}),
        documentKind: row.document.kind,
        title: row.document.title,
        sourceRef: row.document.sourceRef,
        content: row.content,
        similarity,
        metadata: jsonRecord(row.document.metadata)
      };
    })
    .filter((item: RagSearchHit) => item.similarity > 0)
    .sort((left: RagSearchHit, right: RagSearchHit) => right.similarity - left.similarity)
    .slice(0, input.limit ?? 5);
}
