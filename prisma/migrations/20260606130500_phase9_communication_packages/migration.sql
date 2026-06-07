DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'CommunicationPackageKind'
  ) THEN
    CREATE TYPE "CommunicationPackageKind" AS ENUM ('one_pager', 'faq');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CommunicationPackage" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "partnerAgreementId" TEXT,
  "kind" "CommunicationPackageKind" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "bullets" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationPackage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CommunicationPackage_companyId_idx"
  ON "CommunicationPackage"("companyId");

CREATE INDEX IF NOT EXISTS "CommunicationPackage_partnerAgreementId_idx"
  ON "CommunicationPackage"("partnerAgreementId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CommunicationPackage_companyId_fkey'
  ) THEN
    ALTER TABLE "CommunicationPackage"
      ADD CONSTRAINT "CommunicationPackage_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CommunicationPackage_partnerAgreementId_fkey'
  ) THEN
    ALTER TABLE "CommunicationPackage"
      ADD CONSTRAINT "CommunicationPackage_partnerAgreementId_fkey"
      FOREIGN KEY ("partnerAgreementId") REFERENCES "PartnerAgreement"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
