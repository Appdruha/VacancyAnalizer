DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'KnowledgeDocumentKind'
  ) THEN
    CREATE TYPE "KnowledgeDocumentKind" AS ENUM (
      'company_profile',
      'vacancy',
      'communication_package',
      'project_brief',
      'memory_event',
      'reply'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "KnowledgeDocument" (
  "id" TEXT NOT NULL,
  "companyId" TEXT,
  "kind" "KnowledgeDocumentKind" NOT NULL,
  "title" TEXT NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "companyId" TEXT,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "tokenCount" INTEGER NOT NULL,
  "embedding" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeDocument_kind_sourceRef_key"
  ON "KnowledgeDocument"("kind", "sourceRef");

CREATE INDEX IF NOT EXISTS "KnowledgeDocument_companyId_kind_idx"
  ON "KnowledgeDocument"("companyId", "kind");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeChunk_documentId_chunkIndex_key"
  ON "KnowledgeChunk"("documentId", "chunkIndex");

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_companyId_idx"
  ON "KnowledgeChunk"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'KnowledgeDocument_companyId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeDocument"
      ADD CONSTRAINT "KnowledgeDocument_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'KnowledgeChunk_documentId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeChunk"
      ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'KnowledgeChunk_companyId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeChunk"
      ADD CONSTRAINT "KnowledgeChunk_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
