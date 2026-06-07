import type { AdaptiveRecommendationStats, SourceKind } from "@edagent/domain";

export type ExternalSource = "hh" | "superjob" | "linkedin" | "registry";
export type HhMode = "live" | "auto" | "fixtures";
export type HhExecutionMode = "live" | "fixtures";

export type SourceAdapterStatus = {
  source: ExternalSource;
  enabled: boolean;
};

export const defaultAdapters: SourceAdapterStatus[] = [
  { source: "hh", enabled: true },
  { source: "superjob", enabled: false },
  { source: "linkedin", enabled: false },
  { source: "registry", enabled: false }
];

export type VacancySearchInput = {
  query: string;
  page?: number;
  perPage?: number;
  area?: string;
  searchField?: "name" | "description" | "company_name" | "name,company_name";
};

export type ExternalVacancy = {
  externalId: string;
  source: SourceKind;
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
  publishedAt?: string;
};

export type VacancySearchResult = {
  found: number;
  page: number;
  pages: number;
  perPage: number;
  items: ExternalVacancy[];
  meta?: {
    source: SourceKind;
    modeUsed: HhExecutionMode;
    fallbackUsed: boolean;
    attempts: number;
    fallbackReason?: string;
  };
};

export type EmailSendInput = {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
};

export type EmailSendResult = {
  provider: string;
  providerMessageId: string;
  accepted: boolean;
  deliveredAt: string;
};

export type EmailDiagnostics = {
  configuredProvider: string;
  fromEmail: string;
  simulatedConfigured: boolean;
  mailgunConfigured: boolean;
  timeoutMs: number;
  providers: Array<{
    name: string;
    enabled: boolean;
    ready: boolean;
    notes: string[];
  }>;
};

export type HhErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "upstream_error"
  | "network_error"
  | "timeout"
  | "unknown";

export type SourceAdapter = {
  source: SourceKind;
  searchVacancies(input: VacancySearchInput): Promise<VacancySearchResult>;
};

export type EmailProvider = {
  name: string;
  sendMessage(input: EmailSendInput): Promise<EmailSendResult>;
};

export type EmailProviderErrorCode =
  | "invalid_configuration"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "upstream_error"
  | "network_error"
  | "timeout"
  | "unknown";

export type CompetencySignal = {
  canonicalName: string;
  category: string;
  aliasesMatched: string[];
};

export type MlEvaluationItem = {
  companyId?: string;
  stats: AdaptiveRecommendationStats;
  baselineTone?: "formal" | "neutral" | "friendly";
  baselineFollowUpDays?: number;
};

export type MlEvaluationResult = {
  engine: string;
  itemsEvaluated: number;
  averageConfidence: number;
  recommendedToneDistribution: Record<string, number>;
  averageFollowUpDays: number;
  recommendedChanges: number;
  notes: string[];
};

export type HhDiagnostics = {
  source: "hh";
  configuredMode: HhMode;
  apiBaseUrl: string;
  userAgent: string;
  fixtureCatalogSize: number;
  probe?: {
    ok: boolean;
    modeUsed?: HhExecutionMode;
    fallbackUsed?: boolean;
    found?: number;
    returned?: number;
    attempts?: number;
    errorCode?: HhErrorCode;
    httpStatus?: number | null;
    message?: string;
  };
};
