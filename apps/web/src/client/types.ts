export type WebRuntimeConfig = {
  apiBaseUrl: string;
  appName: string;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  provider?: string;
  user: SessionUser;
};

export type DashboardSummary = {
  industries: number;
  companies: number;
  contacts: number;
  jobs: number;
  vacancies: number;
  sources: number;
  ingestionRuns: number;
  shortlisted: number;
  drafts: number;
  approvedDrafts: number;
  campaigns: number;
  messages: number;
  replies: number;
  escalatedReplies: number;
  agreements: number;
  briefs: number;
  communicationPackages: number;
  memoryEvents: number;
};

export type SourceItem = {
  id: string;
  industryId: string;
  source: string;
  status: string;
  config: Record<string, string | number | boolean | null>;
};

export type IngestionRunItem = {
  id: string;
  status: string;
  query: string;
  processedCount: number;
  competencyCount: number;
};

export type ShortlistItem = {
  id: string;
  name: string;
  region: string;
  stage: string;
  score?: {
    total: number;
  } | null;
};

export type IndustryBootstrapItem = {
  id: string;
  name: string;
  priority: number;
  approvedByUserId?: string;
};

export type GapItem = {
  competencyName: string;
  category: string;
  programCoverage: number;
  marketDemand: number;
  gapScore: number;
};

export type DraftItem = {
  id: string;
  approved: boolean;
  companyId?: string;
  contactId?: string | null;
  subject?: string;
  tone?: string;
};

export type MessageItem = {
  id: string;
  subject: string;
  status: string;
  kind: string;
  followUpDueAt?: string | null;
};

export type ReplyItem = {
  id: string;
  category: string;
  positive: boolean;
  escalated: boolean;
  createdAt: string;
};

export type CommunicationPackageItem = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  bullets: string[];
};

export type ProjectCatalogItem = {
  id: string;
  title: string;
  companyName: string;
  companyStage: string;
  agreementStatus: string;
  scoreTotal?: number | null;
};

export type AgreementItem = {
  id: string;
  companyId: string;
  status: string;
  createdAt: string;
};

export type ProjectBriefItem = {
  id: string;
  partnerAgreementId: string;
  title: string;
  summary: string;
  createdAt: string;
};

export type MemoryOverview = {
  eventCount: number;
  replyCount: number;
  recommendation: {
    recommendedTone: string;
    recommendedFollowUpDays: number;
  };
};

export type MlHealth = {
  status: string;
};

export type MlEvaluationSample = {
  id: string;
  label: string;
  scenario: string;
  localRecommendation: {
    recommendedTone: string;
    recommendedFollowUpDays: number;
  };
  remoteRecommendation: {
    recommendedTone: string;
    recommendedFollowUpDays: number;
  };
  policy: {
    recommendedSource: string;
  };
};

export type MlEvaluation = {
  engine: string;
  samples: MlEvaluationSample[];
};

export type BootstrapResponse = {
  summary: {
    industries: number;
    companies: number;
    contacts: number;
    jobs: number;
  };
  data: {
    industries: IndustryBootstrapItem[];
    vacancies: Array<unknown>;
    sources: SourceItem[];
    ingestionRuns: IngestionRunItem[];
    campaigns: Array<unknown>;
    agreements: Array<unknown>;
    briefs: Array<unknown>;
  };
};

export type DashboardData = {
  me: { user: SessionUser };
  health: { databaseReady?: boolean };
  bootstrap: BootstrapResponse;
  companies: { items: ShortlistItem[] };
  shortlist: { items: ShortlistItem[] };
  drafts: { items: DraftItem[] };
  messages: { items: MessageItem[] };
  replies: { items: ReplyItem[] };
  agreements: { items: AgreementItem[] };
  briefs: { items: ProjectBriefItem[] };
  projectCatalog: { items: ProjectCatalogItem[] };
  communicationPackages: { items: CommunicationPackageItem[] };
  memoryOverview: MemoryOverview;
  mlHealth: MlHealth;
  mlEvaluation: MlEvaluation;
  competencyGap: { items: GapItem[] };
};

declare global {
  interface Window {
    __EDAGENT_CONFIG__?: WebRuntimeConfig;
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
          renderButton(container: HTMLElement | null, options: Record<string, string>): void;
        };
      };
    };
  }
}

export {};
