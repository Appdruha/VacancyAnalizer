import type { EntityId, ISODateTime } from "./common.js";
import type { Company, CompanyContact, CompanyScore } from "./company.js";
import type {
  Industry,
  Competency,
  ProgramCompetency,
  Vacancy,
  IndustrySource,
  IngestionRun
} from "./industry.js";
import type { AgentMemoryEvent } from "./memory.js";
import type { KnowledgeChunk, KnowledgeDocument } from "./rag.js";
import type { BackgroundJob, AuditLog, SystemSetting, User } from "./system.js";
import type { Message, MessageDraft, MessageEvent, OutreachCampaign, Reply } from "./outreach.js";
import type { CommunicationPackage, PartnerAgreement, ProjectBrief } from "./project.js";

export type PlatformSnapshot = {
  industries: Industry[];
  competencies: Competency[];
  programCompetencies: ProgramCompetency[];
  vacancies: Vacancy[];
  sources: IndustrySource[];
  ingestionRuns: IngestionRun[];
  companies: Company[];
  contacts: CompanyContact[];
  scores: CompanyScore[];
  campaigns: OutreachCampaign[];
  drafts: MessageDraft[];
  messages: Message[];
  messageEvents: MessageEvent[];
  replies: Reply[];
  agreements: PartnerAgreement[];
  briefs: ProjectBrief[];
  communicationPackages: CommunicationPackage[];
  memoryEvents: AgentMemoryEvent[];
  knowledgeDocuments: KnowledgeDocument[];
  knowledgeChunks: KnowledgeChunk[];
  users: User[];
  settings: SystemSetting[];
  auditLogs: AuditLog[];
  jobs: BackgroundJob[];
};
