import { env } from "@edagent/config";
import type { AdaptiveRecommendation, AdaptiveRecommendationStats, SourceKind } from "@edagent/domain";

export type ExternalSource = "hh" | "superjob" | "linkedin" | "registry";

export type SourceAdapterStatus = {
  source: ExternalSource;
  enabled: boolean;
};

export const defaultAdapters: SourceAdapterStatus[] = [
  { source: "hh", enabled: true },
  { source: "superjob", enabled: false },
  { source: "linkedin", enabled: false },
  { source: "registry", enabled: false }
];

export type VacancySearchInput = {
  query: string;
  page?: number;
  perPage?: number;
  area?: string;
  searchField?: "name" | "description" | "company_name" | "name,company_name";
};

export type ExternalVacancy = {
  externalId: string;
  source: SourceKind;
  title: string;
  companyName: string;
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
};

export type VacancySearchResult = {
  found: number;
  page: number;
  pages: number;
  perPage: number;
  items: ExternalVacancy[];
};

export type EmailSendInput = {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
};

export type EmailSendResult = {
  provider: string;
  providerMessageId: string;
  accepted: boolean;
  deliveredAt: string;
};

export type HhErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "upstream_error"
  | "network_error"
  | "timeout"
  | "unknown";

export type SourceAdapter = {
  source: SourceKind;
  searchVacancies(input: VacancySearchInput): Promise<VacancySearchResult>;
};

export type EmailProvider = {
  name: string;
  sendMessage(input: EmailSendInput): Promise<EmailSendResult>;
};

export type MlEvaluationItem = {
  companyId?: string;
  stats: AdaptiveRecommendationStats;
  baselineTone?: "formal" | "neutral" | "friendly";
  baselineFollowUpDays?: number;
};

export type MlEvaluationResult = {
  engine: string;
  itemsEvaluated: number;
  averageConfidence: number;
  recommendedToneDistribution: Record<string, number>;
  averageFollowUpDays: number;
  recommendedChanges: number;
  notes: string[];
};

type HhVacancySearchResponse = {
  found: number;
  page: number;
  pages: number;
  per_page: number;
  items: HhVacancyItem[];
};

type HhVacancyItem = {
  id: string;
  name: string;
  alternate_url?: string | null;
  url?: string | null;
  published_at?: string | null;
  snippet?: {
    requirement?: string | null;
    responsibility?: string | null;
  } | null;
  employer?: {
    name?: string | null;
  } | null;
  area?: {
    name?: string | null;
  } | null;
  salary?: {
    from?: number | null;
    to?: number | null;
    currency?: string | null;
  } | null;
  schedule?: {
    name?: string | null;
  } | null;
  experience?: {
    name?: string | null;
  } | null;
  employment?: {
    name?: string | null;
  } | null;
};

export class HhApiError extends Error {
  readonly code: HhErrorCode;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly details?: string;

  constructor(input: {
    message: string;
    code: HhErrorCode;
    status?: number | null;
    retryable: boolean;
    details?: string;
  }) {
    super(input.message);
    this.name = "HhApiError";
    this.code = input.code;
    this.status = input.status ?? null;
    this.retryable = input.retryable;
    if (input.details !== undefined) {
      this.details = input.details;
    }
  }
}

let lastHhRequestAt = 0;

const hhFixtureCatalog: ExternalVacancy[] = [
  {
    externalId: "hh-fixture-1",
    source: "hh",
    title: "TypeScript Developer in EdTech",
    companyName: "SkillMatrix",
    areaName: "Moscow",
    employmentName: "Full time",
    experienceName: "1-3 years",
    scheduleName: "Remote",
    requirement: "TypeScript, Node.js, SQL, REST API, Docker",
    responsibility: "Develop student analytics and partner integrations.",
    description: "Hands-on product engineering for education workflows.",
    salaryFrom: 140000,
    salaryTo: 190000,
    salaryCurrency: "RUR",
    publishedAt: "2026-05-20T09:00:00.000Z",
    alternateUrl: "https://hh.ru/vacancy/hh-fixture-1"
  },
  {
    externalId: "hh-fixture-2",
    source: "hh",
    title: "Junior Data Analyst for Learning Products",
    companyName: "Campus Pulse",
    areaName: "Saint Petersburg",
    employmentName: "Full time",
    experienceName: "No experience",
    scheduleName: "Hybrid",
    requirement: "SQL, analytics, data analysis, Python",
    responsibility: "Analyse student funnels and program outcomes.",
    description: "Support product decisions with dashboards and reports.",
    salaryFrom: 90000,
    salaryTo: 120000,
    salaryCurrency: "RUR",
    publishedAt: "2026-05-19T10:30:00.000Z",
    alternateUrl: "https://hh.ru/vacancy/hh-fixture-2"
  },
  {
    externalId: "hh-fixture-3",
    source: "hh",
    title: "Prompt Engineer for AI Tutor",
    companyName: "Vector AI Labs",
    areaName: "Moscow",
    employmentName: "Full time",
    experienceName: "1-3 years",
    scheduleName: "Remote",
    requirement: "Prompt engineering, Python, machine learning, analytics",
    responsibility: "Design prompts and evaluate tutoring quality.",
    description: "Work with adaptive educational AI flows.",
    salaryFrom: 180000,
    salaryTo: 240000,
    salaryCurrency: "RUR",
    publishedAt: "2026-05-18T12:00:00.000Z",
    alternateUrl: "https://hh.ru/vacancy/hh-fixture-3"
  },
  {
    externalId: "hh-fixture-4",
    source: "hh",
    title: "Frontend React Engineer for LMS",
    companyName: "Open Learning Studio",
    areaName: "Kazan",
    employmentName: "Full time",
    experienceName: "1-3 years",
    scheduleName: "Remote",
    requirement: "JavaScript, React, TypeScript, REST API",
    responsibility: "Build interfaces for student assignments and portfolios.",
    description: "Own dashboard flows for educators and students.",
    salaryFrom: 130000,
    salaryTo: 170000,
    salaryCurrency: "RUR",
    publishedAt: "2026-05-17T08:15:00.000Z",
    alternateUrl: "https://hh.ru/vacancy/hh-fixture-4"
  }
];

function withOptionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function withOptionalNumber(value: number | null | undefined): number | undefined {
  return value ?? undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, env.ML_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function waitForRateLimitWindow(): Promise<void> {
  const now = Date.now();
  const delta = now - lastHhRequestAt;
  const waitMs = Math.max(0, env.HH_MIN_REQUEST_INTERVAL_MS - delta);
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  lastHhRequestAt = Date.now();
}

function classifyHhStatus(status: number): Pick<HhApiError, "code" | "retryable"> {
  switch (status) {
    case 401:
      return { code: "unauthorized", retryable: false };
    case 403:
      return { code: "forbidden", retryable: false };
    case 404:
      return { code: "not_found", retryable: false };
    case 429:
      return { code: "rate_limited", retryable: true };
    default:
      if (status >= 500) {
        return { code: "upstream_error", retryable: true };
      }
      return { code: "unknown", retryable: false };
  }
}

function mapHhVacancy(item: HhVacancyItem): ExternalVacancy {
  let vacancy: ExternalVacancy = {
    externalId: item.id,
    source: "hh",
    title: item.name,
    companyName: item.employer?.name ?? "Unknown employer"
  };

  const optionalStrings: Array<[keyof ExternalVacancy, string | undefined]> = [
    ["areaName", withOptionalString(item.area?.name)],
    ["employmentName", withOptionalString(item.employment?.name)],
    ["experienceName", withOptionalString(item.experience?.name)],
    ["scheduleName", withOptionalString(item.schedule?.name)],
    ["url", withOptionalString(item.url)],
    ["alternateUrl", withOptionalString(item.alternate_url)],
    ["requirement", withOptionalString(item.snippet?.requirement)],
    ["responsibility", withOptionalString(item.snippet?.responsibility)],
    ["salaryCurrency", withOptionalString(item.salary?.currency)],
    ["publishedAt", withOptionalString(item.published_at)]
  ];

  for (const [key, value] of optionalStrings) {
    if (value !== undefined) {
      vacancy = {
        ...vacancy,
        [key]: value
      };
    }
  }

  const salaryFrom = withOptionalNumber(item.salary?.from);
  const salaryTo = withOptionalNumber(item.salary?.to);
  if (salaryFrom !== undefined) {
    vacancy = { ...vacancy, salaryFrom };
  }
  if (salaryTo !== undefined) {
    vacancy = { ...vacancy, salaryTo };
  }

  return vacancy;
}

function searchFixtureVacancies(input: VacancySearchInput): VacancySearchResult {
  const tokens = input.query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const page = input.page ?? 0;
  const perPage = input.perPage ?? 20;

  const filtered = hhFixtureCatalog.filter((vacancy) => {
    const haystack = [
      vacancy.title,
      vacancy.companyName,
      vacancy.requirement,
      vacancy.responsibility,
      vacancy.description
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return tokens.length === 0 || tokens.every((token) => haystack.includes(token));
  });

  const start = page * perPage;
  const items = filtered.slice(start, start + perPage);

  return {
    found: filtered.length,
    page,
    pages: Math.max(1, Math.ceil(filtered.length / perPage)),
    perPage,
    items
  };
}

export class HhAdapter implements SourceAdapter {
  readonly source = "hh" as const;

  async searchVacancies(input: VacancySearchInput): Promise<VacancySearchResult> {
    if (env.HH_USE_FIXTURES) {
      return searchFixtureVacancies(input);
    }

    const url = new URL("/vacancies", env.HH_API_BASE_URL);
    url.searchParams.set("text", input.query);
    url.searchParams.set("page", String(input.page ?? 0));
    url.searchParams.set("per_page", String(input.perPage ?? 20));
    url.searchParams.set("search_field", input.searchField ?? "name");

    if (input.area) {
      url.searchParams.set("area", input.area);
    }

    let lastError: HhApiError | null = null;

    for (let attempt = 0; attempt <= env.HH_MAX_RETRIES; attempt += 1) {
      await waitForRateLimitWindow();
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
      }, env.HH_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": env.HH_USER_AGENT,
            "HH-User-Agent": env.HH_USER_AGENT,
            Accept: "application/json"
          },
          signal: controller.signal
        });

        if (!response.ok) {
          const details = (await response.text().catch(() => "")).slice(0, 240);
          const classification = classifyHhStatus(response.status);
          const error = new HhApiError({
            message: `HH API request failed with status ${response.status}.`,
            code: classification.code,
            status: response.status,
            retryable: classification.retryable,
            details
          });

          console.log(
            JSON.stringify({
              scope: "hh.request",
              status: "error",
              source: "hh",
              url: url.toString(),
              query: input.query,
              page: input.page ?? 0,
              perPage: input.perPage ?? 20,
              area: input.area ?? null,
              attempt: attempt + 1,
              durationMs: Date.now() - startedAt,
              httpStatus: response.status,
              errorCode: error.code,
              retryable: error.retryable
            })
          );

          if (!error.retryable || attempt === env.HH_MAX_RETRIES) {
            throw error;
          }

          lastError = error;
          await sleep(env.HH_RETRY_BASE_MS * 2 ** attempt);
          continue;
        }

        const payload = (await response.json()) as HhVacancySearchResponse;
        console.log(
          JSON.stringify({
            scope: "hh.request",
            status: "ok",
            source: "hh",
            url: url.toString(),
            query: input.query,
            page: payload.page,
            perPage: payload.per_page,
            area: input.area ?? null,
            attempt: attempt + 1,
            durationMs: Date.now() - startedAt,
            found: payload.found,
            returned: payload.items.length
          })
        );

        return {
          found: payload.found,
          page: payload.page,
          pages: payload.pages,
          perPage: payload.per_page,
          items: payload.items.map(mapHhVacancy)
        };
      } catch (error: unknown) {
        if (error instanceof HhApiError) {
          clearTimeout(timeoutHandle);
          throw error;
        }

        const aborted = error instanceof Error && error.name === "AbortError";
        const details = error instanceof Error ? error.message : undefined;
        const hhError = new HhApiError(
          details !== undefined
            ? {
                message: aborted
                  ? `HH API request timed out after ${env.HH_TIMEOUT_MS}ms.`
                  : "HH API request failed due to network error.",
                code: aborted ? "timeout" : "network_error",
                retryable: true,
                details
              }
            : {
                message: aborted
                  ? `HH API request timed out after ${env.HH_TIMEOUT_MS}ms.`
                  : "HH API request failed due to network error.",
                code: aborted ? "timeout" : "network_error",
                retryable: true
              }
        );

        console.log(
          JSON.stringify({
            scope: "hh.request",
            status: "error",
            source: "hh",
            url: url.toString(),
            query: input.query,
            page: input.page ?? 0,
            perPage: input.perPage ?? 20,
            area: input.area ?? null,
            attempt: attempt + 1,
            durationMs: Date.now() - startedAt,
            errorCode: hhError.code,
            retryable: hhError.retryable,
            details: hhError.details ?? null
          })
        );

        if (attempt === env.HH_MAX_RETRIES) {
          clearTimeout(timeoutHandle);
          throw hhError;
        }

        lastError = hhError;
        await sleep(env.HH_RETRY_BASE_MS * 2 ** attempt);
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    throw (
      lastError ??
      new HhApiError({
        message: "HH API request failed with unknown error.",
        code: "unknown",
        retryable: false
      })
    );
  }
}

export class LinkedInAdapterPlaceholder implements SourceAdapter {
  readonly source = "linkedin" as const;

  async searchVacancies(): Promise<VacancySearchResult> {
    throw new Error("linkedin_not_implemented");
  }
}

export class SimulatedEmailProvider implements EmailProvider {
  readonly name = env.EMAIL_PROVIDER === "simulated" ? "simulated-email" : env.EMAIL_PROVIDER;

  async sendMessage(input: EmailSendInput): Promise<EmailSendResult> {
    const providerMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const deliveredAt = new Date(Date.now() + 200).toISOString();

    console.log(
      JSON.stringify({
        scope: "email.provider",
        provider: this.name,
        status: "accepted",
        to: input.to,
        subject: input.subject,
        replyTo: input.replyTo ?? null,
        providerMessageId
      })
    );

    return {
      provider: this.name,
      providerMessageId,
      accepted: true,
      deliveredAt
    };
  }
}

export function extractCompetencyCandidates(vacancy: Pick<
  ExternalVacancy,
  "title" | "requirement" | "responsibility" | "description"
>): string[] {
  const text = [vacancy.title, vacancy.requirement, vacancy.responsibility, vacancy.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const dictionary = [
    "typescript",
    "javascript",
    "node.js",
    "react",
    "sql",
    "postgresql",
    "python",
    "fastapi",
    "docker",
    "redis",
    "rest api",
    "analytics",
    "data analysis",
    "machine learning",
    "prompt engineering"
  ];

  return dictionary.filter((item) => text.includes(item));
}

export function getSourceAdapter(source: SourceKind): SourceAdapter {
  switch (source) {
    case "hh":
      return new HhAdapter();
    case "linkedin":
      return new LinkedInAdapterPlaceholder();
  }
}

export function classifyReplyCategory(input: string): {
  category: "interest" | "decline" | "question" | "meeting";
  positive: boolean;
  summary: string;
} {
  const normalized = input.trim().toLowerCase();

  if (/(meeting|call|discuss|calendar|next week|demo)/.test(normalized)) {
    return {
      category: "meeting",
      positive: true,
      summary: "The contact is open to a meeting or a direct follow-up discussion."
    };
  }

  if (/(interested|sounds good|let'?s talk|partnership|relevant|curious)/.test(normalized)) {
    return {
      category: "interest",
      positive: true,
      summary: "The contact expressed interest in exploring a partnership."
    };
  }

  if (/(not interested|no thanks|decline|not relevant|pass)/.test(normalized)) {
    return {
      category: "decline",
      positive: false,
      summary: "The contact declined the current outreach."
    };
  }

  return {
    category: "question",
    positive: false,
    summary: "The contact replied with a question or requested clarification."
  };
}

export function getEmailProvider(): EmailProvider {
  return new SimulatedEmailProvider();
}

export async function getMlServiceHealth(): Promise<{
  status: "ok";
  service: string;
  version: string;
  remoteRecommenderEnabled: boolean;
}> {
  const response = await fetchWithTimeout(`${env.ML_SERVICE_URL}/health`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`ML service health check failed with status ${response.status}.`);
  }

  return (await response.json()) as {
    status: "ok";
    service: string;
    version: string;
    remoteRecommenderEnabled: boolean;
  };
}

export async function requestRemoteAdaptiveRecommendation(input: {
  scope: "company" | "global";
  stats: AdaptiveRecommendationStats;
}): Promise<AdaptiveRecommendation> {
  const response = await fetchWithTimeout(`${env.ML_SERVICE_URL}/recommend/adaptive`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const details = (await response.text().catch(() => "")).slice(0, 240);
    throw new Error(`ML recommendation failed with status ${response.status}. ${details}`.trim());
  }

  return (await response.json()) as AdaptiveRecommendation;
}

export async function runRemoteAdaptiveEvaluation(input: {
  items: MlEvaluationItem[];
}): Promise<MlEvaluationResult> {
  const response = await fetchWithTimeout(`${env.ML_SERVICE_URL}/evaluate/adaptive`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const details = (await response.text().catch(() => "")).slice(0, 240);
    throw new Error(`ML evaluation failed with status ${response.status}. ${details}`.trim());
  }

  return (await response.json()) as MlEvaluationResult;
}
