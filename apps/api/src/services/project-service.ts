import {
  generateCommunicationPackages,
  generateProjectBrief
} from "@edagent/ai";
import { database } from "@edagent/database";
import type {
  AgentMemoryEvent,
  AuditLog,
  CommunicationPackage,
  PartnerAgreement,
  ProjectBrief
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

type CreateAgreementPayload = {
  companyId: string;
  status?: PartnerAgreement["status"];
};

type UpdateAgreementStatusPayload = {
  status: PartnerAgreement["status"];
};

type GenerateProjectBriefPayload = {
  partnerAgreementId: string;
  title?: string;
};

type GenerateCommunicationPackagesPayload = {
  companyId: string;
  partnerAgreementId?: string;
};

export type ProjectServiceDeps = {
  tryDatabase: <T>(action: () => Promise<T>) => Promise<T | null>;
  getAuditActorUserId: () => Promise<string | null>;
  createAuditEntry: (entry: Omit<AuditLog, "id" | "createdAt">) => Promise<void>;
  createMemoryEntry: (entry: Omit<AgentMemoryEvent, "id" | "createdAt">) => Promise<void>;
  retrieveRagContext: (
    companyId: string,
    query: string,
    topK?: number
  ) => Promise<Array<{ title: string; kind: string; content: string; similarity: number }>>;
  agreements: PartnerAgreement[];
  briefs: ProjectBrief[];
};

export function createProjectService(deps: ProjectServiceDeps) {
  return {
    async listAgreements(input: {
      companyId?: string;
      status?: PartnerAgreement["status"];
    }): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getPartnerAgreements>> | PartnerAgreement[] }>> {
      const items =
        (await deps.tryDatabase(() =>
          database.getPartnerAgreements({
            ...(input.companyId ? { companyId: input.companyId } : {}),
            ...(input.status ? { status: input.status } : {})
          })
        )) ?? deps.agreements;
      return { ok: true, data: { items } };
    },

    async createAgreement(payload?: CreateAgreementPayload): Promise<ServiceResult<PartnerAgreement>> {
      if (!payload?.companyId) {
        return { ok: false, status: 400, error: "invalid_payload", message: "Expected companyId." };
      }

      const agreement = await deps.tryDatabase(() =>
        database.createPartnerAgreement({
          companyId: payload.companyId,
          status: payload.status ?? "draft"
        })
      );

      if (!agreement) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not create agreement."
        };
      }

      const actorUserId = await deps.getAuditActorUserId();
      if (actorUserId) {
        await deps.createAuditEntry({
          actorUserId,
          action: "agreement.created",
          entityType: "partner_agreement",
          entityId: agreement.id
        });
      }

      await deps.createMemoryEntry({
        companyId: agreement.companyId,
        eventType: "agreement_created",
        payload: {
          agreementId: agreement.id,
          status: agreement.status
        }
      });

      return { ok: true, status: 201, data: agreement };
    },

    async updateAgreementStatus(agreementId: string, payload?: UpdateAgreementStatusPayload): Promise<ServiceResult<PartnerAgreement>> {
      if (!agreementId || !payload?.status) {
        return {
          ok: false,
          status: 400,
          error: "invalid_payload",
          message: "Expected agreement id and status."
        };
      }

      const agreement = await deps.tryDatabase(() => database.updatePartnerAgreementStatus(agreementId, payload.status));
      if (!agreement) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not update agreement status."
        };
      }

      const actorUserId = await deps.getAuditActorUserId();
      if (actorUserId) {
        await deps.createAuditEntry({
          actorUserId,
          action: "agreement.status_updated",
          entityType: "partner_agreement",
          entityId: agreementId
        });
      }

      await deps.createMemoryEntry({
        companyId: agreement.companyId,
        eventType: "agreement_status_updated",
        payload: {
          agreementId,
          status: agreement.status,
          signed: agreement.status === "signed"
        }
      });

      return { ok: true, data: agreement };
    },

    async listProjectBriefs(partnerAgreementId?: string): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getProjectBriefs>> | ProjectBrief[] }>> {
      const items =
        (await deps.tryDatabase(() =>
          database.getProjectBriefs({
            ...(partnerAgreementId ? { partnerAgreementId } : {})
          })
        )) ?? deps.briefs;
      return { ok: true, data: { items } };
    },

    async listCommunicationPackages(input: {
      companyId?: string;
      partnerAgreementId?: string;
      kind?: CommunicationPackage["kind"];
    }): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getCommunicationPackages>> }>> {
      const items =
        (await deps.tryDatabase(() =>
          database.getCommunicationPackages({
            ...(input.companyId ? { companyId: input.companyId } : {}),
            ...(input.partnerAgreementId ? { partnerAgreementId: input.partnerAgreementId } : {}),
            ...(input.kind ? { kind: input.kind } : {})
          })
        )) ?? [];
      return { ok: true, data: { items } };
    },

    async generateCommunicationPackages(payload?: GenerateCommunicationPackagesPayload): Promise<ServiceResult<{ items: CommunicationPackage[] }>> {
      if (!payload?.companyId) {
        return { ok: false, status: 400, error: "invalid_payload", message: "Expected companyId." };
      }

      const partnerAgreementId = payload.partnerAgreementId?.trim();
      const [company, industries, competencies, vacancies, agreement] = await Promise.all([
        deps.tryDatabase(() => database.getCompanyById(payload.companyId)),
        deps.tryDatabase(() => database.getIndustries()),
        deps.tryDatabase(() => database.getCompetencies()),
        deps.tryDatabase(() => database.getVacancies()),
        partnerAgreementId
          ? deps.tryDatabase(() => database.getPartnerAgreementById(partnerAgreementId))
          : Promise.resolve(null)
      ]);

      if (!company || !industries || !competencies || !vacancies) {
        return {
          ok: false,
          status: 400,
          error: "invalid_state",
          message: "Could not build communication package context."
        };
      }

      const industry = industries.find((item) => item.id === company.industryId);
      const companyVacancies = vacancies.filter((vacancy) => vacancy.companyName === company.name);
      const competencyNames = Array.from(new Set(companyVacancies.flatMap((vacancy) => vacancy.competencyIds)))
        .map((id) => competencies.find((item) => item.id === id)?.name)
        .filter((value): value is string => Boolean(value))
        .slice(0, 5);

      const projectBriefs = partnerAgreementId
        ? await deps.tryDatabase(() => database.getProjectBriefs({ partnerAgreementId }))
        : [];
      const latestBrief = projectBriefs?.[0] ?? null;

      const generated = generateCommunicationPackages({
        companyName: company.name,
        industryName: industry?.name ?? "Unknown industry",
        competencies: competencyNames,
        region: company.region,
        ...(agreement?.status ? { agreementStatus: agreement.status } : {}),
        ...(latestBrief?.title ? { projectTitle: latestBrief.title } : {})
      });

      const items = await Promise.all([
        database.createCommunicationPackage({
          companyId: company.id,
          ...(partnerAgreementId ? { partnerAgreementId } : {}),
          kind: "one-pager",
          title: generated.onePager.title,
          summary: generated.onePager.summary,
          body: generated.onePager.body,
          bullets: generated.onePager.bullets
        }),
        database.createCommunicationPackage({
          companyId: company.id,
          ...(partnerAgreementId ? { partnerAgreementId } : {}),
          kind: "faq",
          title: generated.faq.title,
          summary: generated.faq.summary,
          body: generated.faq.body,
          bullets: generated.faq.bullets
        })
      ]);

      const actorUserId = await deps.getAuditActorUserId();
      if (actorUserId) {
        for (const item of items) {
          await deps.createAuditEntry({
            actorUserId,
            action: "communication_package.generated",
            entityType: "communication_package",
            entityId: item.id
          });
        }
      }

      await deps.createMemoryEntry({
        companyId: company.id,
        eventType: "communication_package_generated",
        payload: {
          packageCount: items.length,
          hasAgreementContext: Boolean(payload.partnerAgreementId),
          hasProjectBriefContext: Boolean(latestBrief)
        }
      });

      return { ok: true, status: 201, data: { items } };
    },

    async generateProjectBrief(payload?: GenerateProjectBriefPayload): Promise<ServiceResult<ProjectBrief>> {
      if (!payload?.partnerAgreementId) {
        return { ok: false, status: 400, error: "invalid_payload", message: "Expected partnerAgreementId." };
      }

      const agreement = await deps.tryDatabase(() => database.getPartnerAgreementById(payload.partnerAgreementId));
      if (!agreement) {
        return { ok: false, status: 404, error: "not_found", message: "Partner agreement not found." };
      }

      const [company, industries, competencies, vacancies, communicationPackages] = await Promise.all([
        deps.tryDatabase(() => database.getCompanyById(agreement.companyId)),
        deps.tryDatabase(() => database.getIndustries()),
        deps.tryDatabase(() => database.getCompetencies()),
        deps.tryDatabase(() => database.getVacancies()),
        deps.tryDatabase(() => database.getCommunicationPackages({ companyId: agreement.companyId }))
      ]);

      if (!company || !industries || !competencies || !vacancies || !communicationPackages) {
        return {
          ok: false,
          status: 400,
          error: "invalid_state",
          message: "Could not build project brief context."
        };
      }

      const industry = industries.find((item) => item.id === company.industryId);
      const topCompetencyIds = vacancies
        .filter((vacancy) => vacancy.companyName === company.name)
        .flatMap((vacancy) => vacancy.competencyIds);
      const competencyIds = Array.from(new Set(topCompetencyIds)).slice(0, 5);
      const competencyNames = competencyIds
        .map((id) => competencies.find((item) => item.id === id)?.name)
        .filter((value): value is string => Boolean(value));

      const generated = generateProjectBrief({
        companyName: company.name,
        industryName: industry?.name ?? "Unknown industry",
        competencies: competencyNames,
        region: company.region,
        agreementStatus: agreement.status,
        companyStage: company.stage,
        ...(company.website ? { website: company.website } : {}),
        ...(company.score?.total !== undefined ? { scoreTotal: company.score.total } : {}),
        communicationHighlights: communicationPackages
          .slice(0, 2)
          .flatMap((item) => item.bullets.slice(0, 1)),
        retrievedContext: await deps.retrieveRagContext(
          company.id,
          `Generate a project brief for ${company.name} in ${industry?.name ?? "industry"} focused on ${competencyNames.join(", ") || "digital product competencies"}.`,
          5
        )
      });

      const brief = await deps.tryDatabase(() =>
        database.createProjectBrief({
          partnerAgreementId: agreement.id,
          title: payload.title?.trim() || generated.title,
          summary: generated.summary,
          roles: generated.roles,
          competencyIds
        })
      );

      if (!brief) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not create project brief."
        };
      }

      const actorUserId = await deps.getAuditActorUserId();
      if (actorUserId) {
        await deps.createAuditEntry({
          actorUserId,
          action: "project_brief.generated",
          entityType: "project_brief",
          entityId: brief.id
        });
      }

      await deps.createMemoryEntry({
        companyId: company.id,
        eventType: "project_brief_generated",
        payload: {
          briefId: brief.id,
          agreementId: agreement.id,
          competencyCount: brief.competencyIds.length,
          roleCount: brief.roles.length
        }
      });

      return { ok: true, status: 201, data: brief };
    },

    async getProjectCatalog(): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getProjectCatalog>> }>> {
      const items = (await deps.tryDatabase(() => database.getProjectCatalog())) ?? [];
      return { ok: true, data: { items } };
    },

    async getUsers(): Promise<ServiceSuccess<{ items: Awaited<ReturnType<typeof database.getUsers>> }>> {
      const items = (await deps.tryDatabase(() => database.getUsers())) ?? [];
      return { ok: true, data: { items } };
    }
  };
}
