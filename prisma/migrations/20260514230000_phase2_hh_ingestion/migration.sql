-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('hh', 'linkedin');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN     "alternateUrl" TEXT,
ADD COLUMN     "areaName" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "employmentName" TEXT,
ADD COLUMN     "experienceName" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "requirement" TEXT,
ADD COLUMN     "responsibility" TEXT,
ADD COLUMN     "salaryCurrency" TEXT,
ADD COLUMN     "salaryFrom" INTEGER,
ADD COLUMN     "salaryTo" INTEGER,
ADD COLUMN     "scheduleName" TEXT,
ADD COLUMN     "url" TEXT;

-- CreateTable
CREATE TABLE "IndustrySource" (
    "id" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "source" "SourceKind" NOT NULL,
    "status" "SourceStatus" NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustrySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "industryId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "IngestionRunStatus" NOT NULL,
    "query" TEXT NOT NULL,
    "page" INTEGER,
    "perPage" INTEGER,
    "totalFound" INTEGER,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "competencyCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IndustrySource_industryId_source_key" ON "IndustrySource"("industryId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Vacancy_source_externalId_key" ON "Vacancy"("source", "externalId");

-- AddForeignKey
ALTER TABLE "IndustrySource" ADD CONSTRAINT "IndustrySource_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "Industry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IndustrySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
