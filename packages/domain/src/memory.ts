import type { EntityId, ISODateTime } from "./common.js";

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

export type AdaptiveRecommendationSource = "local" | "remote";

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

export type MlEvaluationSample = {
  id: EntityId;
  label: string;
  scenario: "company" | "benchmark";
  companyId?: EntityId;
  stats: AdaptiveRecommendationStats;
  localRecommendation: AdaptiveRecommendation;
  remoteRecommendation: AdaptiveRecommendation;
  changed: boolean;
  policy: {
    recommendedSource: AdaptiveRecommendationSource;
    enoughData: boolean;
    meaningfulChange: boolean;
    confidenceGap: number;
    reasons: string[];
  };
};

export type MlEvaluationResult = {
  engine: string;
  itemsEvaluated: number;
  averageConfidence: number;
  recommendedToneDistribution: Record<string, number>;
  averageFollowUpDays: number;
  recommendedChanges: number;
  notes: string[];
  criteria: string[];
  policySummary: {
    localPreferred: number;
    remotePreferred: number;
    enoughDataSamples: number;
    changedSamples: number;
    companySamples: number;
    benchmarkSamples: number;
  };
  samples: MlEvaluationSample[];
};
