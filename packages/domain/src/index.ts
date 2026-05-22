export type ISODateTime = string;

export type EntityId = string;

export type CompanyStage =
  | "discovered"
  | "shortlisted"
  | "approved"
  | "contacted"
  | "replied"
  | "partnered";

export type CompanySize = "startup" | "smb" | "mid-market" | "enterprise";

export type UserRole = "admin" | "operator" | "manager";

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type IngestionRunStatus = "queued" | "running" | "completed" | "failed";

export type ReplyCategory = "interest" | "decline" | "question" | "meeting";
export type MessageStatus = "queued" | "sent" | "delivered" | "replied" | "failed";
export type MessageKind = "outreach-email" | "follow-up-email";
export type MessageEventType =
  | "queued"
  | "sent"
  | "delivered"
  | "replied"
  | "failed"
  | "follow-up-scheduled"
  | "escalated";

export type OutreachChannel = "email" | "linkedin";
export type SourceKind = "hh" | "linkedin";
export type SourceStatus = "active" | "disabled";

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

export type IndustrySource = {
  id: EntityId;
  industryId: EntityId;
  source: SourceKind;
  status: SourceStatus;
  config: Record<string, string | number | boolean | null>;
};

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

export type OutreachCampaign = {
  id: EntityId;
  name: string;
  channel: OutreachChannel;
  status: "draft" | "approved" | "sent";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type MessageDraft = {
  id: EntityId;
  companyId: EntityId;
  contactId: EntityId;
  subject: string;
  body: string;
  tone: "formal" | "neutral" | "friendly";
  approved: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type Message = {
  id: EntityId;
  companyId: EntityId;
  contactId: EntityId;
  draftId?: EntityId;
  campaignId?: EntityId;
  parentMessageId?: EntityId;
  channel: OutreachChannel;
  kind: MessageKind;
  provider: string;
  providerMessageId?: string;
  status: MessageStatus;
  subject: string;
  body: string;
  lastError?: string;
  followUpDueAt?: ISODateTime;
  sentAt?: ISODateTime;
  deliveredAt?: ISODateTime;
  repliedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type MessageEvent = {
  id: EntityId;
  messageId: EntityId;
  type: MessageEventType;
  payload: Record<string, string | number | boolean | null>;
  createdAt: ISODateTime;
};

export type Reply = {
  id: EntityId;
  messageId?: EntityId;
  companyId: EntityId;
  category: ReplyCategory;
  summary: string;
  incomingFrom?: string;
  rawBody?: string;
  positive: boolean;
  escalated: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

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

export type AgentMemoryEvent = {
  id: EntityId;
  companyId?: EntityId;
  eventType: string;
  payload: Record<string, string | number | boolean | null>;
  createdAt: ISODateTime;
};

export type AdaptiveRecommendation = {
  scope: "company" | "global";
  recommendedTone: "formal" | "neutral" | "friendly";
  recommendedFollowUpDays: number;
  confidence: number;
  basedOnEvents: number;
  totalReplies: number;
  positiveReplyRate: number;
  meetingRate: number;
  reasons: string[];
};

export type AdaptiveRecommendationStats = {
  eventCount: number;
  totalReplies: number;
  positiveReplies: number;
  meetingReplies: number;
  declineReplies: number;
  questionReplies: number;
  outreachSent: number;
  followUpsSent: number;
  positiveByTone: Partial<Record<"formal" | "neutral" | "friendly", number>>;
  negativeByTone: Partial<Record<"formal" | "neutral" | "friendly", number>>;
};

export type MemoryOverview = {
  companyId?: EntityId;
  eventCount: number;
  replyCount: number;
  recentEvents: AgentMemoryEvent[];
  topEventTypes: Array<{
    eventType: string;
    count: number;
  }>;
  recommendation: AdaptiveRecommendation;
};

export type User = {
  id: EntityId;
  email: string;
  fullName: string;
  role: UserRole;
};

export type SystemSetting = {
  key: string;
  value: string;
  updatedAt: ISODateTime;
};

export type AuditLog = {
  id: EntityId;
  actorUserId: EntityId;
  action: string;
  entityType: string;
  entityId: EntityId;
  createdAt: ISODateTime;
};

export type BackgroundJob = {
  id: EntityId;
  queue: string;
  type: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, string | number | boolean | null>;
  lastError?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

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
  memoryEvents: AgentMemoryEvent[];
  users: User[];
  settings: SystemSetting[];
  auditLogs: AuditLog[];
  jobs: BackgroundJob[];
};

const now = new Date().toISOString();

export const demoSnapshot: PlatformSnapshot = {
  industries: [
    { id: "ind-1", name: "EdTech", priority: 1, approvedByUserId: "usr-1" },
    { id: "ind-2", name: "AI Products", priority: 2, approvedByUserId: "usr-1" }
  ],
  competencies: [
    { id: "cmp-1", name: "TypeScript", category: "engineering" },
    { id: "cmp-2", name: "Data Analysis", category: "analytics" },
    { id: "cmp-3", name: "Prompt Engineering", category: "ai" }
  ],
  programCompetencies: [
    {
      id: "pc-1",
      programName: "Project Learning",
      competencyId: "cmp-1",
      coverageScore: 78
    },
    {
      id: "pc-2",
      programName: "Project Learning",
      competencyId: "cmp-2",
      coverageScore: 66
    }
  ],
  vacancies: [
    {
      id: "vac-1",
      externalId: "7760476",
      source: "hh",
      title: "Junior TypeScript Developer",
      companyName: "SkillMatrix",
      areaName: "Moscow",
      employmentName: "Full time",
      experienceName: "No experience",
      requirement: "TypeScript, REST API, SQL",
      industryId: "ind-1",
      competencyIds: ["cmp-1", "cmp-3"],
      collectedAt: now
    }
  ],
  sources: [
    {
      id: "src-1",
      industryId: "ind-1",
      source: "hh",
      status: "active",
      config: {
        query: "typescript edtech",
        area: "1",
        perPage: 20
      }
    },
    {
      id: "src-2",
      industryId: "ind-1",
      source: "linkedin",
      status: "disabled",
      config: {}
    }
  ],
  ingestionRuns: [
    {
      id: "run-1",
      industryId: "ind-1",
      sourceId: "src-1",
      status: "completed",
      query: "typescript edtech",
      page: 0,
      perPage: 20,
      totalFound: 1,
      processedCount: 1,
      competencyCount: 2,
      startedAt: now,
      finishedAt: now,
      createdAt: now,
      updatedAt: now
    }
  ],
  companies: [
    {
      id: "co-1",
      name: "SkillMatrix",
      industryId: "ind-1",
      region: "Moscow",
      size: "mid-market",
      stage: "shortlisted",
      website: "https://example.com/skillmatrix"
    },
    {
      id: "co-2",
      name: "Vector AI Labs",
      industryId: "ind-2",
      region: "Yekaterinburg",
      size: "startup",
      stage: "discovered",
      website: "https://example.com/vector-ai"
    }
  ],
  contacts: [
    {
      id: "ct-1",
      companyId: "co-1",
      fullName: "Irina Petrova",
      title: "HR Director",
      email: "irina@example.com"
    }
  ],
  scores: [
    {
      companyId: "co-1",
      total: 84,
      competencyFit: 88,
      reputation: 80,
      educationReadiness: 79
    },
    {
      companyId: "co-2",
      total: 73,
      competencyFit: 77,
      reputation: 70,
      educationReadiness: 71
    }
  ],
  campaigns: [
    {
      id: "cam-1",
      name: "Pilot EdTech Outreach",
      channel: "email",
      status: "draft",
      createdAt: now,
      updatedAt: now
    }
  ],
  drafts: [
    {
      id: "dr-1",
      companyId: "co-1",
      contactId: "ct-1",
      subject: "Partnership proposal with Project Learning",
      body: "We would like to discuss a project-based partnership format.",
      tone: "formal",
      approved: false,
      createdAt: now,
      updatedAt: now
    }
  ],
  messages: [],
  messageEvents: [],
  replies: [],
  agreements: [],
  briefs: [],
  memoryEvents: [
    {
      id: "mem-1",
      companyId: "co-1",
      eventType: "company_shortlisted",
      payload: { score: 84 },
      createdAt: now
    }
  ],
  users: [
    {
      id: "usr-1",
      email: "admin@edagent.local",
      fullName: "Platform Admin",
      role: "admin"
    },
    {
      id: "usr-2",
      email: "operator@edagent.local",
      fullName: "Outreach Operator",
      role: "operator"
    }
  ],
  settings: [
    { key: "outreach.followUpDays", value: "10", updatedAt: now },
    { key: "scoring.minimumApprovalScore", value: "75", updatedAt: now }
  ],
  auditLogs: [
    {
      id: "aud-1",
      actorUserId: "usr-1",
      action: "industry.approved",
      entityType: "industry",
      entityId: "ind-1",
      createdAt: now
    }
  ],
  jobs: [
    {
      id: "job-1",
      queue: "company-discovery",
      type: "refresh-company-pool",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      payload: { industryId: "ind-1" },
      createdAt: now,
      updatedAt: now
    }
  ]
};
