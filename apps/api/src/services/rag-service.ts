import { chunkText, embedText, toRetrievedContext } from "@edagent/ai";
import { database } from "@edagent/database";
import type {
  CommunicationPackage,
  Company,
  Competency,
  Industry,
  KnowledgeDocument,
  PartnerAgreement,
  ProjectBrief,
  RagSearchHit,
  Reply,
  Vacancy
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

export type RagServiceDeps = {
  tryDatabase: <T>(action: () => Promise<T>) => Promise<T | null>;
};

function buildCompanyProfileDocument(input: {
  company: Company & { score?: { total: number; competencyFit: number; reputation: number; educationReadiness: number } | null };
  industry?: Industry | undefined;
  topCompetencies: string[];
  contacts: Array<{ fullName: string; title: string; email?: string }>;
}): Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt"> {
  const contact = input.contacts[0];
  const content = [
    `Company: ${input.company.name}`,
    `Industry: ${input.industry?.name ?? "Unknown industry"}`,
    `Region: ${input.company.region}`,
    `Stage: ${input.company.stage}`,
    `Website: ${input.company.website ?? "n/a"}`,
    input.company.score ? `Score: ${input.company.score.total}/100` : null,
    input.topCompetencies.length > 0 ? `Top competencies: ${input.topCompetencies.join(", ")}` : null,
    contact ? `Primary contact: ${contact.fullName}, ${contact.title}, ${contact.email ?? "no email"}` : null
  ]
    .filter(Boolean)
    .join("\n");

  return {
    companyId: input.company.id,
    kind: "company_profile",
    title: `${input.company.name} company profile`,
    sourceRef: `company:${input.company.id}:profile`,
    content,
    metadata: {
      stage: input.company.stage,
      region: input.company.region,
      industry: input.industry?.name ?? null
    }
  };
}

function buildVacancyDocuments(input: {
  company: Company;
  vacancies: Vacancy[];
  competencies: Competency[];
}): Array<Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">> {
  return input.vacancies.map((vacancy) => ({
    companyId: input.company.id,
    kind: "vacancy",
    title: vacancy.title,
    sourceRef: `vacancy:${vacancy.id}`,
    content: [
      `Vacancy title: ${vacancy.title}`,
      `Company: ${vacancy.companyName}`,
      vacancy.requirement ? `Requirements: ${vacancy.requirement}` : null,
      vacancy.responsibility ? `Responsibilities: ${vacancy.responsibility}` : null,
      vacancy.description ? `Description: ${vacancy.description}` : null,
      `Competencies: ${vacancy.competencyIds
        .map((id) => input.competencies.find((item) => item.id === id)?.name)
        .filter((value): value is string => Boolean(value))
        .join(", ")}`
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      source: vacancy.source,
      areaName: vacancy.areaName ?? null,
      publishedAt: vacancy.publishedAt ?? null
    }
  }));
}

function buildCommunicationDocuments(input: {
  packages: CommunicationPackage[];
}): Array<Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">> {
  return input.packages.map((item) => ({
    companyId: item.companyId,
    kind: "communication_package",
    title: item.title,
    sourceRef: `communication-package:${item.id}`,
    content: [item.summary, item.body, item.bullets.join("\n")].filter(Boolean).join("\n"),
    metadata: {
      kind: item.kind,
      partnerAgreementId: item.partnerAgreementId ?? null
    }
  }));
}

function buildProjectBriefDocuments(input: {
  companyId: string;
  briefs: ProjectBrief[];
  competencies: Competency[];
}): Array<Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">> {
  return input.briefs.map((brief) => ({
    companyId: input.companyId,
    kind: "project_brief",
    title: brief.title,
    sourceRef: `project-brief:${brief.id}`,
    content: [
      brief.summary,
      `Roles: ${brief.roles.map((role) => `${role.title} - ${role.summary}`).join(" | ")}`,
      `Competencies: ${brief.competencyIds
        .map((id) => input.competencies.find((item) => item.id === id)?.name)
        .filter((value): value is string => Boolean(value))
        .join(", ")}`
    ].join("\n"),
    metadata: {
      partnerAgreementId: brief.partnerAgreementId
    }
  }));
}

function buildReplyDocuments(input: { replies: Reply[] }): Array<Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">> {
  return input.replies.map((reply) => ({
    companyId: reply.companyId,
    kind: "reply",
    title: `Reply ${reply.category}`,
    sourceRef: `reply:${reply.id}`,
    content: [reply.summary, reply.rawBody ?? null].filter(Boolean).join("\n"),
    metadata: {
      category: reply.category,
      positive: reply.positive,
      escalated: reply.escalated
    }
  }));
}

function buildMemoryDocuments(input: {
  companyId: string;
  events: Array<{ id: string; eventType: string; payload: Record<string, string | number | boolean | null> }>;
}): Array<Omit<KnowledgeDocument, "id" | "createdAt" | "updatedAt">> {
  return input.events.map((event) => ({
    companyId: input.companyId,
    kind: "memory_event",
    title: `Memory ${event.eventType}`,
    sourceRef: `memory-event:${event.id}`,
    content: [`Event type: ${event.eventType}`, JSON.stringify(event.payload)].join("\n"),
    metadata: {
      eventType: event.eventType
    }
  }));
}

export function createRagService(deps: RagServiceDeps) {
  return {
    async reindexCompany(companyId: string): Promise<ServiceResult<{ documents: number; chunks: number }>> {
      const [company, industries, competencies, vacancies, communicationPackages, replies, memoryEvents, agreements, allBriefs] =
        await Promise.all([
          deps.tryDatabase(() => database.getCompanyById(companyId)),
          deps.tryDatabase(() => database.getIndustries()),
          deps.tryDatabase(() => database.getCompetencies()),
          deps.tryDatabase(() => database.getVacancies()),
          deps.tryDatabase(() => database.getCommunicationPackages({ companyId })),
          deps.tryDatabase(() => database.getReplies({ companyId })),
          deps.tryDatabase(() => database.getMemoryEvents({ companyId, limit: 20 })),
          deps.tryDatabase(() => database.getPartnerAgreements({ companyId })),
          deps.tryDatabase(() => database.getProjectBriefs())
        ]);

      if (!company || !industries || !competencies || !vacancies || !communicationPackages || !replies || !memoryEvents || !agreements || !allBriefs) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not load enough data to build the RAG index."
        };
      }

      const companyVacancies = vacancies.filter((item) => item.companyName === company.name);
      const topCompetencies = Array.from(new Set(companyVacancies.flatMap((vacancy) => vacancy.competencyIds)))
        .map((id) => competencies.find((item) => item.id === id)?.name)
        .filter((value): value is string => Boolean(value))
        .slice(0, 8);
      const agreementIds = new Set(agreements.map((item) => item.id));
      const companyBriefs = allBriefs.filter((brief) => agreementIds.has(brief.partnerAgreementId));
      const industry = industries.find((item) => item.id === company.industryId);

      const documents = [
        buildCompanyProfileDocument({
          company,
          ...(industry ? { industry } : {}),
          topCompetencies,
          contacts: company.contacts
        }),
        ...buildVacancyDocuments({
          company,
          vacancies: companyVacancies,
          competencies
        }),
        ...buildCommunicationDocuments({
          packages: communicationPackages
        }),
        ...buildProjectBriefDocuments({
          companyId: company.id,
          briefs: companyBriefs,
          competencies
        }),
        ...buildReplyDocuments({
          replies
        }),
        ...buildMemoryDocuments({
          companyId: company.id,
          events: memoryEvents
        })
      ];

      let chunkCount = 0;
      for (const document of documents) {
        const storedDocument = await database.upsertKnowledgeDocument(document);
        const chunks = chunkText({ text: document.content, maxChars: 420, overlapChars: 90 }).map((chunk, index) => ({
          chunkIndex: index,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding: embedText(chunk.content)
        }));
        chunkCount += chunks.length;
        await database.replaceKnowledgeChunks({
          documentId: storedDocument.id,
          ...(document.companyId ? { companyId: document.companyId } : {}),
          items: chunks
        });
      }

      return {
        ok: true,
        data: {
          documents: documents.length,
          chunks: chunkCount
        }
      };
    },

    async search(input: {
      companyId: string;
      query: string;
      topK?: number;
      reindex?: boolean;
    }): Promise<ServiceResult<{ items: RagSearchHit[] }>> {
      if (!input.companyId || !input.query.trim()) {
        return {
          ok: false,
          status: 400,
          error: "invalid_payload",
          message: "Expected companyId and query."
        };
      }

      if (input.reindex !== false) {
        const reindexResult = await this.reindexCompany(input.companyId);
        if (!reindexResult.ok) {
          return reindexResult;
        }
      }

      const items = await deps.tryDatabase(() =>
        database.searchKnowledgeChunks({
          companyId: input.companyId,
          queryEmbedding: embedText(input.query),
          limit: input.topK ?? 5
        })
      );

      if (!items) {
        return {
          ok: false,
          status: 503,
          error: "database_unavailable",
          message: "Could not search the RAG index."
        };
      }

      return { ok: true, data: { items } };
    },

    async retrieveContext(companyId: string, query: string, topK = 4) {
      const result = await this.search({ companyId, query, topK, reindex: true });
      if (!result.ok) {
        return [];
      }

      return toRetrievedContext(result.data.items);
    }
  };
}
