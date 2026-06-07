import type { EntityId } from "./common.js";

export type CompanyStage =
  | "discovered"
  | "shortlisted"
  | "approved"
  | "contacted"
  | "replied"
  | "partnered";

export type CompanySize = "startup" | "smb" | "mid-market" | "enterprise";

export type Company = {
  id: EntityId;
  name: string;
  industryId: EntityId;
  region: string;
  size: CompanySize;
  stage: CompanyStage;
  website?: string;
};

export type CompanyContact = {
  id: EntityId;
  companyId: EntityId;
  fullName: string;
  title: string;
  email?: string;
  linkedinUrl?: string;
};

export type CompanyScore = {
  companyId: EntityId;
  total: number;
  competencyFit: number;
  reputation: number;
  educationReadiness: number;
};
