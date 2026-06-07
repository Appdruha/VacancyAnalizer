import { generateCompanySummary, type CompanyProfileInput } from "@edagent/ai";
import { database } from "@edagent/database";
import type {
  AdaptiveRecommendation,
  AuditLog,
  BackgroundJob,
  CompanyScore,
  CompanyStage,
  Competency,
  Industry,
  Vacancy
} from "@edagent/domain";
import type { DiscoveryScoreBreakdown } from "@edagent/scoring";

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

type CreateJobInput = {
  queue: string;
  type: string;
  payload?: Record<string, string | number | boolean | null>;
};

type TriggerCompanyDiscoveryPayload = {
  industryId: string;
  limit?: number;
};

type CompanyProfileDeps = {
  company: Awaited<ReturnType<typeof database.getCompanyById>>;
  industries: Industry[];
  competencies: Competency[];
  vacancies: Vacancy[];
};

export type CompanyServiceDeps = {
  tryDatabase: <T>(action: () => Promise<T>) => Promise<T | null>;
  createJob: (input: CreateJobInput) => BackgroundJob;
  getAuditActorUserId: () => Promise<string | null>;
  createAuditEntry: (entry: Omit<AuditLog, "id" | "createdAt">) => Promise<void>;
  resolveAdaptiveRecommendation: (companyId?: string) => Promise<AdaptiveRecommendation | null>;
  buildCompanyProfile: (input: CompanyProfileDeps) => CompanyProfileInput | null;
  buildCompanyScoreBreakdown: (companyId: string) => Promise<DiscoveryScoreBreakdown | null>;
};

export function createCompaniesService(deps: CompanyServiceDeps) {
  return {
    async listCompanies(input: { industryId?: string; stage?: CompanyStage }): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getCompanies>> }>> {
      const items =
        (await deps.tryDatabase(() =>
          database.getCompanies({
            ...(input.industryId ? { industryId: input.industryId } : {}),
            ...(input.stage ? { stage: input.stage } : {})
          })
        )) ?? [];

      return { ok: true, data: { items } };
    },

    async getProfileSummary(companyId: string): Promise<ServiceResult<{ summary: string; recommendation: AdaptiveRecommendation | null }>> {
      const [company, industries, competencies, vacancies, recommendation] = await Promise.all([
        deps.tryDatabase(() => database.getCompanyById(companyId)),
        deps.tryDatabase(() => database.getIndustries()),
        deps.tryDatabase(() => database.getCompetencies()),
        deps.tryDatabase(() => database.getVacancies()),
        deps.resolveAdaptiveRecommendation(companyId)
      ]);

      if (!company || !industries || !competencies || !vacancies) {
        return {
          ok: false,
          status: 404,
          error: "not_found",
          message: "Could not build company summary."
        };
      }

      const profile = deps.buildCompanyProfile({
        company,
        industries,
        competencies,
        vacancies
      });

      if (!profile) {
        return {
          ok: false,
          status: 404,
          error: "not_found",
          message: "Company not found."
        };
      }

      return {
        ok: true,
        data: {
          summary: generateCompanySummary(profile),
          recommendation
        }
      };
    },

    async getScoreBreakdown(companyId: string): Promise<ServiceResult<{
      companyId: string;
      companyName: string;
      currentStage: CompanyStage;
      currentScore: CompanyScore | null;
      breakdown: DiscoveryScoreBreakdown;
    }>> {
      const [company, breakdown] = await Promise.all([
        deps.tryDatabase(() => database.getCompanyById(companyId)),
        deps.tryDatabase(() => deps.buildCompanyScoreBreakdown(companyId))
      ]);

      if (!company || !breakdown) {
        return {
          ok: false,
          status: 404,
          error: "not_found",
          message: "Company breakdown is not available."
        };
      }

      return {
        ok: true,
        data: {
          companyId: company.id,
          companyName: company.name,
          currentStage: company.stage,
          currentScore: company.score,
          breakdown
        }
      };
    },

    async getShortlist(input: { industryId?: string; limit: number; minimumScore: number }): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getShortlist>> }>> {
      const items =
        (await deps.tryDatabase(() =>
          database.getShortlist({
            ...(input.industryId ? { industryId: input.industryId } : {}),
            limit: input.limit,
            minimumScore: input.minimumScore
          })
        )) ?? [];

      return { ok: true, data: { items } };
    },

    async enqueueDiscovery(payload: TriggerCompanyDiscoveryPayload): Promise<ServiceResult<BackgroundJob>> {
      if (!payload.industryId) {
        return {
          ok: false,
          status: 400,
          error: "invalid_payload",
          message: "Expected industryId."
        };
      }

      const job =
        (await deps.tryDatabase(() =>
          database.createJob({
            queue: "company-discovery",
            type: "refresh-company-pool",
            status: "queued",
            attempts: 0,
            maxAttempts: 3,
            payload: {
              industryId: payload.industryId,
              limit: payload.limit ?? 50
            }
          })
        )) ??
        deps.createJob({
          queue: "company-discovery",
          type: "refresh-company-pool",
          payload: {
            industryId: payload.industryId,
            limit: payload.limit ?? 50
          }
        });

      return { ok: true, status: 201, data: job };
    },

    async updateStage(companyId: string, stage?: CompanyStage): Promise<ServiceResult<Awaited<ReturnType<typeof database.updateCompanyStage>>>> {
      if (!companyId || !stage) {
        return {
          ok: false,
          status: 400,
          error: "invalid_payload",
          message: "Expected company id and stage."
        };
      }

      const updated = await deps.tryDatabase(() => database.updateCompanyStage(companyId, stage));
      if (!updated) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not update company stage."
        };
      }

      const actorUserId = await deps.getAuditActorUserId();
      if (actorUserId) {
        await deps.createAuditEntry({
          actorUserId,
          action: "company.stage_updated",
          entityType: "company",
          entityId: companyId
        });
      }

      return { ok: true, data: updated };
    }
  };
}
