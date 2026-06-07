import {
  decideAdaptiveRecommendationSource,
  recommendAdaptiveStrategy
} from "@edagent/ai";
import { env } from "@edagent/config";
import { database } from "@edagent/database";
import {
  getMlServiceHealth,
  requestRemoteAdaptiveRecommendation,
  runRemoteAdaptiveEvaluation
} from "@edagent/integrations";
import type {
  AdaptiveRecommendation,
  AdaptiveRecommendationStats,
  AgentMemoryEvent,
  MlEvaluationResult,
  MlEvaluationSample
} from "@edagent/domain";

type ServiceSuccess<T> = {
  ok: true;
  status?: number;
  data: T;
};

type ServiceFailure = {
  ok: false;
  status: number;
  error: string;
  message: string;
};

type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

type MlEvaluationDatasetItem = {
  id: string;
  label: string;
  scenario: "company" | "benchmark";
  companyId?: string;
  stats: AdaptiveRecommendationStats;
  localRecommendation: AdaptiveRecommendation;
};

export type MemoryServiceDeps = {
  tryDatabase: <T>(action: () => Promise<T>) => Promise<T | null>;
  resolveAdaptiveRecommendation: (companyId?: string) => Promise<AdaptiveRecommendation | null>;
  buildMlEvaluationBenchmarks: () => Array<{
    id: string;
    label: string;
    scenario: "benchmark";
    stats: AdaptiveRecommendationStats;
  }>;
  memoryEvents: AgentMemoryEvent[];
};

export function createMemoryService(deps: MemoryServiceDeps) {
  return {
    async listMemoryEvents(input: { companyId?: string; eventType?: string; limit?: number }): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getMemoryEvents>> | AgentMemoryEvent[] }>> {
      const items =
        (await deps.tryDatabase(() =>
          database.getMemoryEvents({
            ...(input.companyId ? { companyId: input.companyId } : {}),
            ...(input.eventType ? { eventType: input.eventType } : {}),
            ...(input.limit && Number.isFinite(input.limit) ? { limit: input.limit } : {})
          })
        )) ??
        deps.memoryEvents
          .filter(
            (item) =>
              (!input.companyId || item.companyId === input.companyId) &&
              (!input.eventType || item.eventType === input.eventType)
          )
          .slice(0, input.limit && Number.isFinite(input.limit) ? input.limit : deps.memoryEvents.length);

      return { ok: true, data: { items } };
    },

    async getRecommendation(companyId?: string): Promise<ServiceResult<AdaptiveRecommendation>> {
      const recommendation = await deps.resolveAdaptiveRecommendation(companyId);
      if (!recommendation) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not build adaptive recommendation."
        };
      }

      return { ok: true, data: recommendation };
    },

    async getOverview(companyId?: string): Promise<ServiceResult<Awaited<ReturnType<typeof database.getMemoryOverview>>>> {
      const overview = await deps.tryDatabase(() => database.getMemoryOverview(companyId));
      if (!overview) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not build memory overview."
        };
      }

      return { ok: true, data: overview };
    },

    async getMlHealth(): Promise<ServiceSuccess<Awaited<ReturnType<typeof getMlServiceHealth>>> | ServiceFailure> {
      try {
        const health = await getMlServiceHealth();
        return { ok: true, data: health };
      } catch (error: unknown) {
        return {
          ok: false,
          status: 503,
          error: "ml_service_unavailable",
          message: error instanceof Error ? error.message : "Unknown ML service error"
        };
      }
    },

    async runMlEvaluation(): Promise<ServiceResult<MlEvaluationResult>> {
      const companies = await deps.tryDatabase(() => database.getCompanies());
      if (!companies) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not load companies for ML evaluation."
        };
      }

      const companyItems = await Promise.all(
        companies.map(async (company) => {
          const [stats, localRecommendation] = await Promise.all([
            database.getAdaptiveRecommendationStats(company.id),
            database.getAdaptiveRecommendation(company.id)
          ]);

          return {
            id: company.id,
            label: company.name,
            scenario: "company" as const,
            companyId: company.id,
            stats,
            localRecommendation
          };
        })
      );

      const benchmarkItems: MlEvaluationDatasetItem[] = deps.buildMlEvaluationBenchmarks().map((item) => {
        const baseline = recommendAdaptiveStrategy(item.stats);
        return {
          id: item.id,
          label: item.label,
          scenario: item.scenario,
          stats: item.stats,
          localRecommendation: {
            scope: "global",
            recommendedTone: baseline.recommendedTone,
            recommendedFollowUpDays: baseline.recommendedFollowUpDays,
            confidence: baseline.confidence,
            basedOnEvents: item.stats.eventCount,
            totalReplies: item.stats.totalReplies,
            positiveReplyRate: baseline.positiveReplyRate,
            meetingRate: baseline.meetingRate,
            reasons: baseline.reasons
          }
        }
      });

      const items: MlEvaluationDatasetItem[] = [...companyItems, ...benchmarkItems];

      try {
        const evaluationPayload = items.map((item) => ({
          ...(item.companyId ? { companyId: item.companyId } : {}),
          stats: item.stats,
          baselineTone: item.localRecommendation.recommendedTone,
          baselineFollowUpDays: item.localRecommendation.recommendedFollowUpDays
        }));
        const aggregate = await runRemoteAdaptiveEvaluation({ items: evaluationPayload });
        const remoteRecommendations = await Promise.all(
          evaluationPayload.map((item) =>
            requestRemoteAdaptiveRecommendation({
              scope: item.companyId ? "company" : "global",
              stats: item.stats
            })
          )
        );

        const samples: MlEvaluationSample[] = items.map((item, index) => {
          const localRecommendation = item.localRecommendation;
          const remoteRecommendation = remoteRecommendations[index] ?? localRecommendation;
          const policy = decideAdaptiveRecommendationSource({
            stats: item.stats,
            localRecommendation,
            remoteRecommendation
          });

          return {
            id: item.id,
            label: item.label,
            scenario: item.scenario,
            ...(item.companyId ? { companyId: item.companyId } : {}),
            stats: item.stats,
            localRecommendation,
            remoteRecommendation,
            changed:
              localRecommendation.recommendedTone !== remoteRecommendation.recommendedTone ||
              localRecommendation.recommendedFollowUpDays !== remoteRecommendation.recommendedFollowUpDays,
            policy
          };
        });

        const evaluation: MlEvaluationResult = {
          ...aggregate,
          criteria: [
            "Prefer the local baseline when there is too little reply history.",
            "Prefer the remote recommender only when its confidence is high enough and the change is meaningful.",
            "Benchmark scenarios stay in the dataset so we can compare cold-start, meeting-heavy and decline-heavy behaviour."
          ],
          policySummary: {
            localPreferred: samples.filter((item) => item.policy.recommendedSource === "local").length,
            remotePreferred: samples.filter((item) => item.policy.recommendedSource === "remote").length,
            enoughDataSamples: samples.filter((item) => item.policy.enoughData).length,
            changedSamples: samples.filter((item) => item.changed).length,
            companySamples: samples.filter((item) => item.scenario === "company").length,
            benchmarkSamples: samples.filter((item) => item.scenario === "benchmark").length
          },
          samples
        };

        return { ok: true, status: 201, data: evaluation };
      } catch (error: unknown) {
        return {
          ok: false,
          status: 503,
          error: "ml_service_unavailable",
          message: error instanceof Error ? error.message : "Unknown ML evaluation error"
        };
      }
    },

    degradedMlHealth(message: string) {
      return {
        status: "degraded" as const,
        service: "edagent-ml-service",
        remoteRecommenderEnabled: env.ML_USE_REMOTE_RECOMMENDER,
        error: message
      };
    }
  };
}
