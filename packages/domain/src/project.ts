import type { EntityId, ISODateTime } from "./common.js";

export type PartnerAgreement = {
  id: EntityId;
  companyId: EntityId;
  status: "draft" | "aligned" | "signed";
  signedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ProjectRole = {
  title: string;
  summary: string;
};

export type ProjectBrief = {
  id: EntityId;
  partnerAgreementId: EntityId;
  title: string;
  summary: string;
  roles: ProjectRole[];
  competencyIds: EntityId[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type CommunicationPackageKind = "one-pager" | "faq";

export type CommunicationPackage = {
  id: EntityId;
  companyId: EntityId;
  partnerAgreementId?: EntityId;
  kind: CommunicationPackageKind;
  title: string;
  summary: string;
  body: string;
  bullets: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};
