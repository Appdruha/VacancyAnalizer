import type { BackgroundJob, SourceKind } from "@edagent/domain";
import { database } from "@edagent/database";
import { env } from "@edagent/config";
import { extractCompetencySignals, getEmailDiagnostics, getHhDiagnostics } from "@edagent/integrations";
import { jsonResponse, parseJson } from "@edagent/shared";
import type { RouteContext } from "./types.js";

type UpsertSourcePayload = {
  industryId: string;
  source: SourceKind;
  status: "active" | "disabled";
  config?: Record<string, string | number | boolean | null>;
};

type TriggerHhIngestionPayload = {
  industryId: string;
  query: string;
  page?: number;
  perPage?: number;
  area?: string;
};

type SetupIndustryBootstrapPayload = {
  industryName: string;
  priority?: number;
  query: string;
  area?: string;
  perPage?: number;
  programName: string;
  competencies: Array<{
    name: string;
    category?: string;
    coverageScore: number;
  }>;
};

type CompetencyExtractionPreviewPayload = {
  title?: string;
  requirement?: string;
  responsibility?: string;
  description?: string;
};

export async function handleIndustryRoutes(
  context: RouteContext,
  deps: {
    send: (res: RouteContext["res"], payload: ReturnType<typeof jsonResponse>) => void;
    readBody: (req: RouteContext["req"]) => Promise<string>;
    tryDatabase: <T>(action: () => Promise<T>) => Promise<T | null>;
    createJob: (input: {
      queue: string;
      type: string;
      payload?: Record<string, string | number | boolean | null>;
    }) => BackgroundJob;
    createAuditEntry: (entry: {
      actorUserId: string;
      action: string;
      entityType: string;
      entityId: string;
    }) => Promise<void>;
    ensurePlatformBootstrap: () => Promise<void>;
  }
): Promise<boolean> {
  const { req, res, url, pathname } = context;

  if (req.method === "GET" && pathname === "/vacancies") {
    const items = (await deps.tryDatabase(() => database.getVacancies())) ?? [];
    deps.send(res, jsonResponse({ items }));
    return true;
  }

  if (req.method === "GET" && pathname === "/industry-sources") {
    const items = (await deps.tryDatabase(() => database.getIndustrySources())) ?? [];
    deps.send(res, jsonResponse({ items }));
    return true;
  }

  if (req.method === "POST" && pathname === "/industry-sources") {
    const payload = parseJson<UpsertSourcePayload>(await deps.readBody(req));

    if (!payload?.industryId || !payload.source || !payload.status) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected industryId, source and status."
          },
          400
        )
      );
      return true;
    }

    if (payload.source === "linkedin") {
      deps.send(
        res,
        jsonResponse(
          {
            error: "not_implemented",
            message: "LinkedIn integration is intentionally left as a placeholder for now."
          },
          501
        )
      );
      return true;
    }

    const source = await deps.tryDatabase(() =>
      database.upsertIndustrySource({
        industryId: payload.industryId,
        source: payload.source,
        status: payload.status,
        config: payload.config ?? {}
      })
    );

    if (!source) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not persist source configuration."
          },
          503
        )
      );
      return true;
    }

    deps.send(res, jsonResponse(source, 201));
    return true;
  }

  if (req.method === "GET" && pathname === "/ingestion-runs") {
    const items = (await deps.tryDatabase(() => database.getIngestionRuns())) ?? [];
    deps.send(res, jsonResponse({ items }));
    return true;
  }

  if (req.method === "GET" && pathname === "/integrations/hh/diagnostics") {
    const probe = url.searchParams.get("probe");
    const query = url.searchParams.get("query");
    const area = url.searchParams.get("area");
    const page = url.searchParams.get("page");
    const perPage = url.searchParams.get("perPage");
    const diagnostics = await getHhDiagnostics({
      probe: probe === "1" || probe === "true",
      ...(query ? { query } : {}),
      ...(area ? { area } : {}),
      ...(page ? { page: Number(page) } : {}),
      ...(perPage ? { perPage: Number(perPage) } : {})
    });
    const sourceConfigs = (await deps.tryDatabase(() => database.getIndustrySources())) ?? [];
    const latestRuns = ((await deps.tryDatabase(() => database.getIngestionRuns())) ?? [])
      .filter((item) => sourceConfigs.some((source) => source.id === item.sourceId && source.source === "hh"))
      .slice(0, 5);

    deps.send(
      res,
      jsonResponse({
        ...diagnostics,
        sourceConfigs: sourceConfigs.filter((item) => item.source === "hh"),
        latestRuns
      })
    );
    return true;
  }

  if (req.method === "GET" && pathname === "/integrations/email/diagnostics") {
    deps.send(res, jsonResponse(getEmailDiagnostics()));
    return true;
  }

  if (req.method === "POST" && pathname === "/vacancies/ingest/hh") {
    const payload = parseJson<TriggerHhIngestionPayload>(await deps.readBody(req));

    if (!payload?.industryId || !payload.query) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected industryId and query."
          },
          400
        )
      );
      return true;
    }

    const job =
      (await deps.tryDatabase(() =>
        database.createJob({
          queue: "industry-analysis",
          type: "hh-sync-vacancies",
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          payload: {
            industryId: payload.industryId,
            query: payload.query,
            page: payload.page ?? 0,
            perPage: payload.perPage ?? 20,
            area: payload.area ?? ""
          }
        })
      )) ??
      deps.createJob({
        queue: "industry-analysis",
        type: "hh-sync-vacancies",
        payload: {
          industryId: payload.industryId,
          query: payload.query,
          page: payload.page ?? 0,
          perPage: payload.perPage ?? 20,
          area: payload.area ?? ""
        }
      });

    deps.send(res, jsonResponse(job, 201));
    return true;
  }

  if (req.method === "POST" && pathname === "/setup/bootstrap-industry") {
    const payload = parseJson<SetupIndustryBootstrapPayload>(await deps.readBody(req));

    if (!payload?.industryName || !payload.query || !payload.programName || !Array.isArray(payload.competencies)) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected industryName, query, programName and competencies array."
          },
          400
        )
      );
      return true;
    }

    const normalizedCompetencies = payload.competencies
      .map((item) => ({
        name: item.name.trim(),
        category: item.category?.trim() || "program",
        coverageScore: item.coverageScore
      }))
      .filter((item) => item.name.length > 0 && Number.isFinite(item.coverageScore));

    if (normalizedCompetencies.length === 0) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected at least one valid competency mapping."
          },
          400
        )
      );
      return true;
    }

    await deps.ensurePlatformBootstrap();
    const adminUser = await database.findUserByEmail(env.ADMIN_EMAIL);
    if (!adminUser) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "configuration_error",
            message: "Admin user is not configured."
          },
          500
        )
      );
      return true;
    }

    const industry = await database.upsertIndustry({
      name: payload.industryName.trim(),
      priority: payload.priority ?? 1,
      approvedByUserId: adminUser.id
    });

    const competencies = await Promise.all(
      normalizedCompetencies.map((item) => database.upsertCompetencyByName(item.name, item.category))
    );

    const uniqueProgramMappings = normalizedCompetencies.flatMap((item) => {
      const competency = competencies.find((candidate) => candidate.name === item.name.toLowerCase());
      if (!competency) {
        return [];
      }

      return [
        {
          competencyId: competency.id,
          coverageScore: item.coverageScore
        }
      ];
    });

    await database.replaceProgramCompetencies({
      programName: payload.programName.trim(),
      items: uniqueProgramMappings
    });

    const source = await database.upsertIndustrySource({
      industryId: industry.id,
      source: "hh",
      status: "active",
      config: {
        query: payload.query,
        area: payload.area ?? "1",
        perPage: payload.perPage ?? 20
      }
    });

    await deps.createAuditEntry({
      actorUserId: adminUser.id,
      action: "setup.bootstrap_industry",
      entityType: "industry",
      entityId: industry.id
    });

    deps.send(
      res,
      jsonResponse(
        {
          industry,
          source,
          programName: payload.programName.trim(),
          competencies
        },
        201
      )
    );
    return true;
  }

  if (req.method === "GET" && pathname === "/analytics/competency-gap") {
    const items = (await deps.tryDatabase(() => database.getCompetencyGapMatrix())) ?? [];
    deps.send(res, jsonResponse({ items }));
    return true;
  }

  if (req.method === "POST" && pathname === "/analytics/competency-extraction/preview") {
    const payload = parseJson<CompetencyExtractionPreviewPayload>(await deps.readBody(req));
    const vacancyText = {
      title: payload?.title ?? "",
      ...(payload?.requirement ? { requirement: payload.requirement } : {}),
      ...(payload?.responsibility ? { responsibility: payload.responsibility } : {}),
      ...(payload?.description ? { description: payload.description } : {})
    };

    if (!vacancyText.title && !vacancyText.requirement && !vacancyText.responsibility && !vacancyText.description) {
      deps.send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected at least one of title, requirement, responsibility or description."
          },
          400
        )
      );
      return true;
    }

    const signals = extractCompetencySignals(vacancyText);
    deps.send(
      res,
      jsonResponse({
        items: signals,
        summary: {
          competenciesDetected: signals.length,
          canonicalNames: signals.map((item) => item.canonicalName)
        }
      })
    );
    return true;
  }

  return false;
}
