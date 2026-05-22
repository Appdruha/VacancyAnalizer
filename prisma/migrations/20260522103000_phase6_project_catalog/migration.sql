-- AlterTable
ALTER TABLE "ProjectBrief"
ADD COLUMN "roles" JSONB NOT NULL DEFAULT '[]';
