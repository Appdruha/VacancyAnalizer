import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { env } from "@edagent/config";
import { database } from "@edagent/database";
import {
  demoSnapshot,
  type AuditLog,
  type BackgroundJob,
  type SourceKind,
  type SystemSetting
} from "@edagent/domain";
import {
  createId,
  jsonResponse,
  notFoundResponse,
  parseJson,
  readinessProbe
} from "@edagent/shared";

type LoginPayload = {
  email: string;
  password: string;
};

type UpdateSettingPayload = {
  value: string;
};

type CreateJobPayload = {
  queue: string;
  type: string;
  payload?: Record<string, string | number | boolean | null>;
};

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

const settings = [...demoSnapshot.settings];
const auditLogs = [...demoSnapshot.auditLogs];
const jobs = [...demoSnapshot.jobs];

async function tryDatabase<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch {
    return null;
  }
}

function send(res: ServerResponse, payload: ReturnType<typeof jsonResponse>): void {
  res.writeHead(payload.statusCode, payload.headers);
  res.end(payload.body);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf-8");
}

function appendAuditLog(entry: Omit<AuditLog, "id" | "createdAt">): AuditLog {
  const log: AuditLog = {
    id: createId("aud"),
    createdAt: new Date().toISOString(),
    ...entry
  };
  auditLogs.unshift(log);
  return log;
}

function upsertSetting(key: string, value: string): SystemSetting {
  const existing = settings.find((item) => item.key === key);

  if (existing) {
    existing.value = value;
    existing.updatedAt = new Date().toISOString();
    return existing;
  }

  const created: SystemSetting = {
    key,
    value,
    updatedAt: new Date().toISOString()
  };

  settings.push(created);
  return created;
}

function createJob(input: CreateJobPayload): BackgroundJob {
  const job: BackgroundJob = {
    id: createId("job"),
    queue: input.queue,
    type: input.type,
    status: "queued",
    attempts: 0,
    maxAttempts: 3,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  jobs.unshift(job);
  return job;
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${env.API_PORT}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/health") {
    const databaseReady = await database.canReachDatabase().catch(() => false);

    send(
      res,
      jsonResponse({
        ...readinessProbe("api"),
        app: env.APP_NAME,
        databaseReady
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/platform/bootstrap") {
    const dbSnapshot = await tryDatabase(() => database.getSnapshot());
    const bootstrap = dbSnapshot ?? {
      industries: demoSnapshot.industries,
      competencies: demoSnapshot.competencies,
      programCompetencies: demoSnapshot.programCompetencies,
      vacancies: demoSnapshot.vacancies,
      sources: demoSnapshot.sources,
      ingestionRuns: demoSnapshot.ingestionRuns,
      companies: demoSnapshot.companies,
      contacts: demoSnapshot.contacts,
      scores: demoSnapshot.scores,
      users: demoSnapshot.users,
      settings,
      auditLogs,
      jobs
    };

    send(
      res,
      jsonResponse({
        summary: {
          industries: bootstrap.industries.length,
          companies: bootstrap.companies.length,
          contacts: bootstrap.contacts.length,
          jobs: bootstrap.jobs.length
        },
        data: {
          industries: bootstrap.industries,
          competencies: bootstrap.competencies,
          vacancies: bootstrap.vacancies,
          sources: bootstrap.sources,
          ingestionRuns: bootstrap.ingestionRuns,
          companies: bootstrap.companies,
          scores: bootstrap.scores,
          settings: bootstrap.settings,
          jobs: bootstrap.jobs
        }
      })
    );
    return;
  }

  if (req.method === "POST" && pathname === "/auth/login") {
    const rawBody = await readBody(req);
    const payload = parseJson<LoginPayload>(rawBody);
    const adminUser =
      (await tryDatabase(() => database.findUserByEmail(env.ADMIN_EMAIL))) ?? demoSnapshot.users[0] ?? null;

    if (!payload || payload.email !== env.ADMIN_EMAIL || payload.password !== env.ADMIN_PASSWORD) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_credentials",
            message: "Email or password is incorrect."
          },
          401
        )
      );
      return;
    }

    if (!adminUser) {
      send(
        res,
        jsonResponse(
          {
            error: "configuration_error",
            message: "Admin user is not configured in the demo snapshot."
          },
          500
        )
      );
      return;
    }

    const auditEntry = {
      actorUserId: adminUser.id,
      action: "auth.login",
      entityType: "user",
      entityId: adminUser.id
    };
    await tryDatabase(() => database.createAuditLog(auditEntry));
    appendAuditLog(auditEntry);

    send(
      res,
      jsonResponse({
        token: "demo-admin-token",
        user: adminUser
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/settings") {
    const items = (await tryDatabase(() => database.getSettings())) ?? settings;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "PUT" && pathname.startsWith("/settings/")) {
    const key = pathname.replace("/settings/", "");
    const payload = parseJson<UpdateSettingPayload>(await readBody(req));

    if (!payload?.value) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected JSON body with non-empty value."
          },
          400
        )
      );
      return;
    }

    const updated =
      (await tryDatabase(() => database.upsertSetting(key, payload.value))) ?? upsertSetting(key, payload.value);
    const auditEntry = {
      actorUserId: "usr-1",
      action: "settings.updated",
      entityType: "system_setting",
      entityId: key
    };
    await tryDatabase(() => database.createAuditLog(auditEntry));
    appendAuditLog(auditEntry);
    send(res, jsonResponse(updated));
    return;
  }

  if (req.method === "GET" && pathname === "/audit-logs") {
    const items = (await tryDatabase(() => database.getAuditLogs())) ?? auditLogs;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/jobs") {
    const items = (await tryDatabase(() => database.getJobs())) ?? jobs;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/jobs") {
    const payload = parseJson<CreateJobPayload>(await readBody(req));

    if (!payload?.queue || !payload.type) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected queue and type in the request body."
          },
          400
        )
      );
      return;
    }

    const job =
      (await tryDatabase(() =>
        database.createJob({
          queue: payload.queue,
          type: payload.type,
          status: "queued",
          attempts: 0,
          maxAttempts: 3,
          payload: payload.payload ?? {}
        })
      )) ?? createJob(payload);
    const auditEntry = {
      actorUserId: "usr-1",
      action: "job.created",
      entityType: "background_job",
      entityId: job.id
    };
    await tryDatabase(() => database.createAuditLog(auditEntry));
    appendAuditLog(auditEntry);

    send(res, jsonResponse(job, 201));
    return;
  }

  if (req.method === "GET" && pathname === "/vacancies") {
    const items = (await tryDatabase(() => database.getVacancies())) ?? demoSnapshot.vacancies;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/industry-sources") {
    const items = (await tryDatabase(() => database.getIndustrySources())) ?? demoSnapshot.sources;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/industry-sources") {
    const payload = parseJson<UpsertSourcePayload>(await readBody(req));

    if (!payload?.industryId || !payload.source || !payload.status) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected industryId, source and status."
          },
          400
        )
      );
      return;
    }

    if (payload.source === "linkedin") {
      send(
        res,
        jsonResponse(
          {
            error: "not_implemented",
            message: "LinkedIn integration is intentionally left as a placeholder for now."
          },
          501
        )
      );
      return;
    }

    const source = await tryDatabase(() =>
      database.upsertIndustrySource({
        industryId: payload.industryId,
        source: payload.source,
        status: payload.status,
        config: payload.config ?? {}
      })
    );

    if (!source) {
      send(
        res,
        jsonResponse(
          {
            error: "database_unavailable",
            message: "Could not persist source configuration."
          },
          503
        )
      );
      return;
    }

    send(res, jsonResponse(source, 201));
    return;
  }

  if (req.method === "GET" && pathname === "/ingestion-runs") {
    const items = (await tryDatabase(() => database.getIngestionRuns())) ?? demoSnapshot.ingestionRuns;
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "POST" && pathname === "/vacancies/ingest/hh") {
    const payload = parseJson<TriggerHhIngestionPayload>(await readBody(req));

    if (!payload?.industryId || !payload.query) {
      send(
        res,
        jsonResponse(
          {
            error: "invalid_payload",
            message: "Expected industryId and query."
          },
          400
        )
      );
      return;
    }

    const job =
      (await tryDatabase(() =>
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
      createJob({
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

    send(res, jsonResponse(job, 201));
    return;
  }

  if (req.method === "GET" && pathname === "/analytics/competency-gap") {
    const items = (await tryDatabase(() => database.getCompetencyGapMatrix())) ?? [];
    send(res, jsonResponse({ items }));
    return;
  }

  if (req.method === "GET" && pathname === "/companies") {
    const dbCompanies = await tryDatabase(() => database.getCompanies());

    send(
      res,
      jsonResponse({
        items:
          dbCompanies ??
          demoSnapshot.companies.map((company) => ({
            ...company,
            score: demoSnapshot.scores.find((score) => score.companyId === company.id) ?? null,
            contacts: demoSnapshot.contacts.filter((contact) => contact.companyId === company.id)
          }))
      })
    );
    return;
  }

  if (req.method === "GET" && pathname === "/users") {
    const items = (await tryDatabase(() => database.getUsers())) ?? demoSnapshot.users;
    send(res, jsonResponse({ items }));
    return;
  }

  send(res, notFoundResponse(pathname));
}

function main(): void {
  const server = createServer((req, res) => {
    route(req, res).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      send(
        res,
        jsonResponse(
          {
            error: "internal_error",
            message
          },
          500
        )
      );
    });
  });

  server.listen(env.API_PORT, () => {
    const status = readinessProbe("api");
    console.log(`[api] ${status.service} is listening on port ${env.API_PORT}`);
  });
}

main();
