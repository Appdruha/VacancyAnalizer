import type { EntityId, ISODateTime } from "./common.js";

export type Competency = {
  id: EntityId;
  name: string;
  category: string;
};

export type Industry = {
  id: EntityId;
  name: string;
  priority: number;
  approvedByUserId?: EntityId;
};

export type ProgramCompetency = {
  id: EntityId;
  programName: string;
  competencyId: EntityId;
  coverageScore: number;
};

export type Vacancy = {
  id: EntityId;
  externalId?: string;
  source: string;
  title: string;
  companyName: string;
  areaName?: string;
  employmentName?: string;
  experienceName?: string;
  scheduleName?: string;
  url?: string;
  alternateUrl?: string;
  requirement?: string;
  responsibility?: string;
  description?: string;
  salaryFrom?: number;
  salaryTo?: number;
  salaryCurrency?: string;
  publishedAt?: ISODateTime;
  industryId: EntityId;
  competencyIds: EntityId[];
  collectedAt: ISODateTime;
};

export type SourceKind = "hh" | "linkedin";
export type SourceStatus = "active" | "disabled";

export type IndustrySource = {
  id: EntityId;
  industryId: EntityId;
  source: SourceKind;
  status: SourceStatus;
  config: Record<string, string | number | boolean | null>;
};

export type IngestionRunStatus = "queued" | "running" | "completed" | "failed";

export type IngestionRun = {
  id: EntityId;
  industryId: EntityId;
  sourceId: EntityId;
  status: IngestionRunStatus;
  query: string;
  page?: number;
  perPage?: number;
  totalFound?: number;
  processedCount: number;
  competencyCount: number;
  startedAt?: ISODateTime;
  finishedAt?: ISODateTime;
  errorMessage?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};
