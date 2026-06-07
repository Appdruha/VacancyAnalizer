import { database } from "@edagent/database";
import type { BackgroundJob } from "@edagent/domain";
import { HhApiError, extractCompetencySignals, getSourceAdapter } from "@edagent/integrations";

export async function handleHhSyncVacanciesJob(job: BackgroundJob): Promise<void> {
  const industryId = String(job.payload.industryId ?? "");
  const query = String(job.payload.query ?? "");
  const page = Number(job.payload.page ?? 0);
  const perPage = Number(job.payload.perPage ?? 20);
  const area = String(job.payload.area ?? "");

  if (!industryId || !query) {
    throw new Error("HH ingestion job payload is incomplete.");
  }

  const source =
    (await database.getIndustrySourceByKind(industryId, "hh")) ??
    (await database.upsertIndustrySource({
      industryId,
      source: "hh",
      status: "active",
      config: {
        query,
        page,
        perPage,
        area
      }
    }));

  const run = await database.createIngestionRun({
    industryId,
    sourceId: source.id,
    status: "running",
    query,
    page,
    perPage
  });

  await database.updateIngestionRun(run.id, {
    startedAt: new Date().toISOString(),
    status: "running"
  });

  try {
    const adapter = getSourceAdapter("hh");
    const searchInput: {
      query: string;
      page: number;
      perPage: number;
      area?: string;
      searchField: "name";
    } = {
      query,
      page,
      perPage,
      searchField: "name"
    };
    if (area) {
      searchInput.area = area;
    }

    const result = await adapter.searchVacancies(searchInput);
    console.log(
      JSON.stringify({
        scope: "worker.hh_ingestion",
        status: "fetched",
        jobId: job.id,
        industryId,
        query,
        page,
        perPage,
        modeUsed: result.meta?.modeUsed ?? null,
        fallbackUsed: result.meta?.fallbackUsed ?? false,
        fallbackReason: result.meta?.fallbackReason ?? null,
        found: result.found,
        returned: result.items.length
      })
    );

    let competencyCount = 0;

    for (const item of result.items) {
      const competencySignals = extractCompetencySignals(item);
      const competencyIds: string[] = [];

      for (const signal of competencySignals) {
        const competency = await database.upsertCompetencyByName(signal.canonicalName, signal.category);
        competencyIds.push(competency.id);
      }

      competencyCount += competencyIds.length;

      const vacancyInput: {
        externalId: string;
        source: "hh";
        title: string;
        companyName: string;
        industryId: string;
        competencyIds: string[];
        collectedAt: string;
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
      } = {
        externalId: item.externalId,
        source: "hh",
        title: item.title,
        companyName: item.companyName,
        industryId,
        competencyIds,
        collectedAt: new Date().toISOString()
      };

      const optionalFields = {
        areaName: item.areaName,
        employmentName: item.employmentName,
        experienceName: item.experienceName,
        scheduleName: item.scheduleName,
        url: item.url,
        alternateUrl: item.alternateUrl,
        requirement: item.requirement,
        responsibility: item.responsibility,
        description: item.description,
        salaryFrom: item.salaryFrom,
        salaryTo: item.salaryTo,
        salaryCurrency: item.salaryCurrency,
        publishedAt: item.publishedAt
      };

      for (const [key, value] of Object.entries(optionalFields)) {
        if (value !== undefined) {
          (vacancyInput as Record<string, string | number | string[] | undefined>)[key] = value as
            | string
            | number;
        }
      }

      await database.createOrUpdateVacancy(vacancyInput);
    }

    await database.updateIngestionRun(run.id, {
      status: "completed",
      totalFound: result.found,
      processedCount: result.items.length,
      competencyCount,
      finishedAt: new Date().toISOString(),
      errorMessage: null
    });

    console.log(
      JSON.stringify({
        scope: "worker.hh_ingestion",
        status: "completed",
        jobId: job.id,
        runId: run.id,
        industryId,
        query,
        modeUsed: result.meta?.modeUsed ?? null,
        fallbackUsed: result.meta?.fallbackUsed ?? false,
        processedCount: result.items.length,
        competencyCount
      })
    );
  } catch (error: unknown) {
    const message =
      error instanceof HhApiError
        ? `[${error.code}] ${error.message}${error.status ? ` status=${error.status}` : ""}${error.details ? ` details=${error.details}` : ""}`
        : error instanceof Error
          ? error.message
          : "Unknown HH ingestion error";

    console.error(
      JSON.stringify({
        scope: "worker.hh_ingestion",
        status: "failed",
        jobId: job.id,
        industryId,
        query,
        errorCode: error instanceof HhApiError ? error.code : "unknown",
        retryable: error instanceof HhApiError ? error.retryable : false,
        httpStatus: error instanceof HhApiError ? error.status : null,
        message
      })
    );

    await database.updateIngestionRun(run.id, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      errorMessage: message
    });
    throw error;
  }
}
