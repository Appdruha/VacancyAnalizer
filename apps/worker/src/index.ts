import { createServer } from "node:http";
import { env } from "@edagent/config";
import { database } from "@edagent/database";
import type { BackgroundJob } from "@edagent/domain";
import { extractCompetencyCandidates, getSourceAdapter } from "@edagent/integrations";
import { jsonResponse, readinessProbe } from "@edagent/shared";

const runtimeState = {
  processedCount: 0,
  lastProcessedAt: null as string | null,
  lastError: null as string | null,
  mode: "database" as "database" | "idle"
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function handleJob(job: BackgroundJob): Promise<void> {
  console.log(`[worker] processing job ${job.id} (${job.queue}/${job.type})`);

  if (job.type === "hh-sync-vacancies") {
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

      let competencyCount = 0;

      for (const item of result.items) {
        const competencyNames = extractCompetencyCandidates(item);
        const competencyIds: string[] = [];

        for (const competencyName of competencyNames) {
          const competency = await database.upsertCompetencyByName(competencyName, "market");
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown HH ingestion error";
      await database.updateIngestionRun(run.id, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        errorMessage: message
      });
      throw error;
    }
  } else {
    await sleep(300);
  }

  await database.completeJob(job.id);
  runtimeState.processedCount += 1;
  runtimeState.lastProcessedAt = new Date().toISOString();
  runtimeState.lastError = null;
  console.log(`[worker] completed job ${job.id}`);
}

async function processNextJob(): Promise<void> {
  try {
    const reachable = await database.canReachDatabase();
    if (!reachable) {
      runtimeState.mode = "idle";
      runtimeState.lastError = "Database is not reachable.";
      return;
    }

    runtimeState.mode = "database";
    const job = await database.claimNextJob();
    if (!job) {
      return;
    }

    await handleJob(job);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    runtimeState.lastError = message;
    console.error(`[worker] ${message}`);

    const jobs = await database.getJobs().catch(() => []);
    const activeJob = jobs.find((job) => job.status === "running");
    if (activeJob) {
      await database.failJob(activeJob.id, message).catch(() => undefined);
    }
  }
}

function main(): void {
  const server = createServer((_, res) => {
    void (async () => {
      const jobStats = await database.getJobStats().catch(() => ({
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0
      }));

      const payload = jsonResponse({
        ...readinessProbe("worker"),
        mode: runtimeState.mode,
        processedCount: runtimeState.processedCount,
        lastProcessedAt: runtimeState.lastProcessedAt,
        lastError: runtimeState.lastError,
        pollMs: env.WORKER_POLL_MS,
        jobs: jobStats
      });

      res.writeHead(payload.statusCode, payload.headers);
      res.end(payload.body);
    })();
  });

  server.listen(env.WORKER_PORT, () => {
    const status = readinessProbe("worker");
    console.log(`[worker] ${status.service} is listening on port ${env.WORKER_PORT}`);
  });

  void processNextJob();
  setInterval(() => {
    void processNextJob();
  }, env.WORKER_POLL_MS);
}

main();
