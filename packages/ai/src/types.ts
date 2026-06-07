import type {
  AdaptiveRecommendation,
  AdaptiveRecommendationSource,
  AdaptiveRecommendationStats
} from "@edagent/domain";

export type PromptTemplate =
  | "company-summary"
  | "outreach-email"
  | "follow-up-email"
  | "project-brief";

export type DraftTone = "formal" | "neutral" | "friendly";

export type CompanyProfileInput = {
  companyName: string;
  industryName: string;
  region: string;
  website?: string;
  stage: string;
  score?: {
    total: number;
    competencyFit: number;
    reputation: number;
    educationReadiness: number;
  } | null;
  topCompetencies: string[];
  contactName?: string;
  contactTitle?: string;
  retrievedContext?: RetrievedContextSnippet[];
};

export type ProjectBriefInput = {
  companyName: string;
  industryName: string;
  competencies: string[];
  region?: string;
  agreementStatus?: "draft" | "aligned" | "signed";
  companyStage?: string;
  website?: string;
  scoreTotal?: number;
  communicationHighlights?: string[];
  retrievedContext?: RetrievedContextSnippet[];
};

export type GeneratedProjectRole = {
  title: string;
  summary: string;
};

export type CommunicationPackageInput = {
  companyName: string;
  industryName: string;
  competencies: string[];
  region?: string;
  agreementStatus?: "draft" | "aligned" | "signed";
  projectTitle?: string;
};

export type RetrievedContextSnippet = {
  title: string;
  kind: string;
  content: string;
  similarity: number;
};

export type GeneratedCommunicationPackage = {
  title: string;
  summary: string;
  body: string;
  bullets: string[];
};

export type AdaptiveRecommendationDecisionInput = {
  stats: AdaptiveRecommendationStats;
  localRecommendation: AdaptiveRecommendation;
  remoteRecommendation: AdaptiveRecommendation;
};

export type AdaptiveRecommendationDecision = {
  recommendedSource: AdaptiveRecommendationSource;
  enoughData: boolean;
  meaningfulChange: boolean;
  confidenceGap: number;
  reasons: string[];
};
