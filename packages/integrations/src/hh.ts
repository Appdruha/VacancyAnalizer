import { env } from "@edagent/config";
import type { SourceKind } from "@edagent/domain";
import type {
  ExternalVacancy,
  HhDiagnostics,
  HhErrorCode,
  HhMode,
  SourceAdapter,
  VacancySearchInput,
  VacancySearchResult
} from "./types.js";

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

type HhSearchCard = {
  externalId: string;
  title: string;
  companyName: string;
  alternateUrl: string;
  areaName?: string;
  experienceName?: string;
  scheduleName?: string;
  salaryFrom?: number;
  salaryTo?: number;
  salaryCurrency?: string;
};

type HtmlFetchOptions = {
  purpose: "search" | "vacancy";
  input: VacancySearchInput;
  vacancyUrl?: string;
  attempt?: number;
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
const HH_WEB_BASE_URL = "https://hh.ru";
const HH_BROWSER_USER_AGENT =
  env.HH_USER_AGENT.includes("Mozilla/")
    ? env.HH_USER_AGENT
    : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 EdAgent/1.0";

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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractMatch(content: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(content);
  if (!match) {
    return undefined;
  }

  return stripHtml(match[1] ?? "");
}

function parseSalaryText(value: string | undefined): Pick<ExternalVacancy, "salaryFrom" | "salaryTo" | "salaryCurrency"> {
  if (!value) {
    return {};
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const numbers = Array.from(normalized.matchAll(/(\d[\d\s ]*)/g))
    .map((match) => {
      const captured = match[1] ?? "";
      return Number(captured.replace(/[^\d]/g, ""));
    })
    .filter((item) => Number.isFinite(item) && item > 0);

  const salaryCurrency = normalized.includes("₽")
    ? "RUR"
    : normalized.includes("$")
      ? "USD"
      : normalized.includes("€")
        ? "EUR"
        : undefined;

  const salaryFrom = numbers.length >= 1 ? numbers[0] : undefined;
  const salaryTo = numbers.length >= 2 ? numbers[1] : undefined;

  return {
    ...(salaryFrom !== undefined ? { salaryFrom } : {}),
    ...(salaryTo !== undefined ? { salaryTo } : {}),
    ...(salaryCurrency !== undefined ? { salaryCurrency } : {})
  };
}

function normalizeVacancyUrl(value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return new URL(value, HH_WEB_BASE_URL).toString();
}

function splitVacancyDescription(description: string): Pick<ExternalVacancy, "requirement" | "responsibility"> {
  const normalized = description.replace(/\s+/g, " ").trim();
  const result: Pick<ExternalVacancy, "requirement" | "responsibility"> = {};

  const requirementPatterns = [
    /(?:требования|ожидания от кандидата|мы ожидаем|нам важно|вы нам подходите, если)[:\s-]+(.+?)(?=(?:обязанности|задачи|условия|мы предлагаем|что предстоит|$))/i
  ];
  const responsibilityPatterns = [
    /(?:обязанности|задачи|что предстоит делать|чем предстоит заниматься|функционал)[:\s-]+(.+?)(?=(?:требования|условия|мы предлагаем|$))/i
  ];

  for (const pattern of requirementPatterns) {
    const match = pattern.exec(normalized);
    if (match?.[1]) {
      result.requirement = match[1].trim();
      break;
    }
  }

  for (const pattern of responsibilityPatterns) {
    const match = pattern.exec(normalized);
    if (match?.[1]) {
      result.responsibility = match[1].trim();
      break;
    }
  }

  if (result.requirement === undefined) {
    result.requirement = normalized.slice(0, 500).trim();
  }

  if (result.responsibility === undefined) {
    result.responsibility = normalized.slice(0, 500).trim();
  }

  return result;
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

async function fetchHhHtml(url: URL, options: HtmlFetchOptions): Promise<string> {
  await waitForRateLimitWindow();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, env.HH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": HH_BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const details = (await response.text().catch(() => "")).slice(0, 240);
      const classification = classifyHhStatus(response.status);
      throw new HhApiError({
        message: `HH website request failed with status ${response.status}.`,
        code: classification.code,
        status: response.status,
        retryable: classification.retryable,
        details
      });
    }

    const html = await response.text();
    console.log(
      JSON.stringify({
        scope: "hh.web_request",
        status: "ok",
        purpose: options.purpose,
        url: url.toString(),
        query: options.input.query,
        page: options.input.page ?? 0,
        perPage: options.input.perPage ?? 20,
        area: options.input.area ?? null,
        vacancyUrl: options.vacancyUrl ?? null,
        attempt: options.attempt ?? 1,
        durationMs: Date.now() - startedAt
      })
    );
    return html;
  } catch (error: unknown) {
    const aborted = error instanceof Error && error.name === "AbortError";

    if (error instanceof HhApiError) {
      console.log(
        JSON.stringify({
          scope: "hh.web_request",
          status: "error",
          purpose: options.purpose,
          url: url.toString(),
          query: options.input.query,
          page: options.input.page ?? 0,
          perPage: options.input.perPage ?? 20,
          area: options.input.area ?? null,
          vacancyUrl: options.vacancyUrl ?? null,
          attempt: options.attempt ?? 1,
          durationMs: Date.now() - startedAt,
          errorCode: error.code,
          retryable: error.retryable,
          httpStatus: error.status
        })
      );
      throw error;
    }

    const details = error instanceof Error ? error.message : undefined;
    const hhError = new HhApiError({
      message: aborted
        ? `HH website request timed out after ${env.HH_TIMEOUT_MS}ms.`
        : "HH website request failed due to network error.",
      code: aborted ? "timeout" : "network_error",
      retryable: true,
      ...(details !== undefined ? { details } : {})
    });

    console.log(
      JSON.stringify({
        scope: "hh.web_request",
        status: "error",
        purpose: options.purpose,
        url: url.toString(),
        query: options.input.query,
        page: options.input.page ?? 0,
        perPage: options.input.perPage ?? 20,
        area: options.input.area ?? null,
        vacancyUrl: options.vacancyUrl ?? null,
        attempt: options.attempt ?? 1,
        durationMs: Date.now() - startedAt,
        errorCode: hhError.code,
        retryable: hhError.retryable,
        details: hhError.details ?? null
      })
    );

    throw hhError;
  } finally {
    clearTimeout(timeoutHandle);
  }
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

function parseHhSearchCards(html: string, perPage: number): HhSearchCard[] {
  const cardMatches = html.matchAll(
    /<div id="(\d+)" class="vacancy-card[\s\S]*?(?=<div id="\d+" class="vacancy-card|<div class="pager|$)/g
  );
  const cards: HhSearchCard[] = [];
  const seenIds = new Set<string>();

  for (const cardMatch of cardMatches) {
    const externalId = cardMatch[1];
    const cardHtml = cardMatch[0];
    if (!externalId || seenIds.has(externalId)) {
      continue;
    }

    const title = extractMatch(cardHtml, /data-qa="serp-item__title-text"[^>]*>([\s\S]*?)<\/span>/i);
    const hrefMatch = /data-qa="serp-item__title"[^>]*href="([^"]+)"/i.exec(cardHtml);
    const companyName =
      extractMatch(cardHtml, /data-qa="vacancy-serp__vacancy-employer-text"[^>]*>([\s\S]*?)<\/span>/i) ??
      extractMatch(cardHtml, /data-qa="vacancy-serp__vacancy-employer"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);

    if (!title || !hrefMatch?.[1] || !companyName) {
      continue;
    }

    const alternateUrl = normalizeVacancyUrl(decodeHtmlEntities(hrefMatch[1]));
    const areaName = extractMatch(cardHtml, /data-qa="vacancy-serp__vacancy-address"[^>]*>([\s\S]*?)<\/span>/i);
    const compensationText =
      extractMatch(cardHtml, /magritte-text_typography-label-1-regular[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ??
      extractMatch(cardHtml, /data-qa="vacancy-salary"[^>]*>([\s\S]*?)<\/div>/i);
    const experienceName = extractMatch(
      cardHtml,
      /data-qa="vacancy-serp__vacancy-work-experience-[^"]+"[^>]*>([\s\S]*?)<\/span>/i
    );
    const scheduleName = extractMatch(cardHtml, /data-qa="vacancy-label-work-schedule-[^"]+"[^>]*>([\s\S]*?)<\/span>/i);
    const salary = parseSalaryText(compensationText);

    cards.push({
      externalId,
      title,
      companyName,
      alternateUrl,
      ...(areaName !== undefined ? { areaName } : {}),
      ...(experienceName !== undefined ? { experienceName } : {}),
      ...(scheduleName !== undefined ? { scheduleName } : {}),
      ...salary
    });
    seenIds.add(externalId);

    if (cards.length >= perPage) {
      break;
    }
  }

  return cards;
}

async function fetchHhVacancyDetails(
  card: HhSearchCard,
  input: VacancySearchInput
): Promise<Pick<ExternalVacancy, "title" | "companyName" | "areaName" | "description" | "requirement" | "responsibility" | "salaryFrom" | "salaryTo" | "salaryCurrency">> {
  const url = new URL(card.alternateUrl);
  const html = await fetchHhHtml(url, {
    purpose: "vacancy",
    input,
    vacancyUrl: card.alternateUrl
  });

  const descriptionHtmlMatch = /data-qa="vacancy-description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i.exec(html);
  const description = stripHtml(descriptionHtmlMatch?.[1] ?? "");
  const detailTitle = extractMatch(html, /data-qa="vacancy-title"[^>]*>([\s\S]*?)<\/h1>/i);
  const detailCompanyName =
    extractMatch(html, /data-qa="vacancy-company-name"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i) ?? card.companyName;
  const detailAreaName = extractMatch(html, /data-qa="vacancy-view-raw-address"[^>]*>([\s\S]*?)<\/span>/i) ?? card.areaName;
  const detailSalaryText = extractMatch(html, /data-qa="vacancy-salary"[^>]*>([\s\S]*?)<\/div>/i);
  const detailSalary = parseSalaryText(detailSalaryText);
  const splitDescription = description ? splitVacancyDescription(description) : {};

  return {
    title: detailTitle ?? card.title,
    companyName: detailCompanyName,
    ...(detailAreaName !== undefined ? { areaName: detailAreaName } : {}),
    ...(description ? { description } : {}),
    ...(splitDescription.requirement !== undefined ? { requirement: splitDescription.requirement } : {}),
    ...(splitDescription.responsibility !== undefined ? { responsibility: splitDescription.responsibility } : {}),
    ...(detailSalary.salaryFrom ?? card.salaryFrom) !== undefined
      ? { salaryFrom: detailSalary.salaryFrom ?? card.salaryFrom }
      : {},
    ...(detailSalary.salaryTo ?? card.salaryTo) !== undefined ? { salaryTo: detailSalary.salaryTo ?? card.salaryTo } : {},
    ...(detailSalary.salaryCurrency ?? card.salaryCurrency) !== undefined
      ? { salaryCurrency: detailSalary.salaryCurrency ?? card.salaryCurrency }
      : {}
  };
}

async function performLiveHhHtmlSearch(input: VacancySearchInput): Promise<VacancySearchResult> {
  const url = new URL("/search/vacancy", HH_WEB_BASE_URL);
  url.searchParams.set("text", input.query);
  url.searchParams.set("page", String(input.page ?? 0));
  if (input.area) {
    url.searchParams.set("area", input.area);
  }

  const html = await fetchHhHtml(url, {
    purpose: "search",
    input
  });
  const cards = parseHhSearchCards(html, input.perPage ?? 20);

  const items: ExternalVacancy[] = [];
  for (const card of cards) {
    const details = await fetchHhVacancyDetails(card, input).catch(
      (): Pick<
        ExternalVacancy,
        "title" | "companyName" | "areaName" | "description" | "requirement" | "responsibility" | "salaryFrom" | "salaryTo" | "salaryCurrency"
      > => ({
        title: card.title,
        companyName: card.companyName,
        ...(card.areaName !== undefined ? { areaName: card.areaName } : {}),
        ...(card.salaryFrom !== undefined ? { salaryFrom: card.salaryFrom } : {}),
        ...(card.salaryTo !== undefined ? { salaryTo: card.salaryTo } : {}),
        ...(card.salaryCurrency !== undefined ? { salaryCurrency: card.salaryCurrency } : {})
      })
    );

    items.push({
      externalId: card.externalId,
      source: "hh",
      title: details.title,
      companyName: details.companyName,
      alternateUrl: card.alternateUrl,
      ...(details.areaName !== undefined ? { areaName: details.areaName } : {}),
      ...(card.experienceName !== undefined ? { experienceName: card.experienceName } : {}),
      ...(card.scheduleName !== undefined ? { scheduleName: card.scheduleName } : {}),
      ...(details.description !== undefined ? { description: details.description } : {}),
      ...(details.requirement !== undefined ? { requirement: details.requirement } : {}),
      ...(details.responsibility !== undefined ? { responsibility: details.responsibility } : {}),
      ...(details.salaryFrom !== undefined ? { salaryFrom: details.salaryFrom } : {}),
      ...(details.salaryTo !== undefined ? { salaryTo: details.salaryTo } : {}),
      ...(details.salaryCurrency !== undefined ? { salaryCurrency: details.salaryCurrency } : {})
    });
  }

  if (items.length === 0) {
    throw new HhApiError({
      message: "HH website search returned no parseable vacancy cards.",
      code: "unknown",
      retryable: false
    });
  }

  console.log(
    JSON.stringify({
      scope: "hh.web_search",
      status: "ok",
      source: "hh",
      mode: "live",
      url: url.toString(),
      query: input.query,
      page: input.page ?? 0,
      perPage: input.perPage ?? 20,
      area: input.area ?? null,
      found: items.length,
      returned: items.length
    })
  );

  return {
    found: items.length,
    page: input.page ?? 0,
    pages: items.length > 0 ? 1 : 0,
    perPage: input.perPage ?? 20,
    items,
    meta: {
      source: "hh",
      modeUsed: "live",
      fallbackUsed: false,
      attempts: 1
    }
  };
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
    items,
    meta: {
      source: "hh",
      modeUsed: "fixtures",
      fallbackUsed: false,
      attempts: 0
    }
  };
}

function resolveHhMode(): HhMode {
  return env.HH_MODE;
}

function buildFixtureResult(
  input: VacancySearchInput,
  options?: {
    fallbackReason?: string;
    attempts?: number;
  }
): VacancySearchResult {
  const result = searchFixtureVacancies(input);
  return {
    ...result,
    meta: {
      source: "hh",
      modeUsed: "fixtures",
      fallbackUsed: options?.fallbackReason !== undefined,
      attempts: options?.attempts ?? 0,
      ...(options?.fallbackReason !== undefined ? { fallbackReason: options.fallbackReason } : {})
    }
  };
}

async function performLiveHhSearch(input: VacancySearchInput): Promise<VacancySearchResult> {
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
            mode: "live",
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
          mode: "live",
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
        items: payload.items.map(mapHhVacancy),
        meta: {
          source: "hh",
          modeUsed: "live",
          fallbackUsed: false,
          attempts: attempt + 1
        }
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
          mode: "live",
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

function canFallbackToFixtures(error: HhApiError): boolean {
  return resolveHhMode() === "auto" && error.code !== "unauthorized";
}

export class HhAdapter implements SourceAdapter {
  readonly source = "hh" as const;

  async searchVacancies(input: VacancySearchInput): Promise<VacancySearchResult> {
    const mode = resolveHhMode();
    if (mode === "fixtures") {
      return buildFixtureResult(input);
    }

    try {
      return await performLiveHhSearch(input);
    } catch (error: unknown) {
      if (error instanceof HhApiError) {
        try {
          const htmlResult = await performLiveHhHtmlSearch(input);
          return {
            ...htmlResult,
            meta: {
              source: "hh",
              modeUsed: "live",
              fallbackUsed: true,
              attempts: (htmlResult.meta?.attempts ?? 1) + env.HH_MAX_RETRIES + 1,
              fallbackReason: `api_${error.code}${error.status ? `:${error.status}` : ""}_html_search`
            }
          };
        } catch (htmlError: unknown) {
          if (htmlError instanceof HhApiError && canFallbackToFixtures(htmlError)) {
            console.log(
              JSON.stringify({
                scope: "hh.request",
                status: "fallback",
                source: "hh",
                configuredMode: mode,
                errorCode: htmlError.code,
                httpStatus: htmlError.status,
                retryable: htmlError.retryable,
                stage: "html_search"
              })
            );

            return buildFixtureResult(input, {
              fallbackReason: `html_${htmlError.code}${htmlError.status ? `:${htmlError.status}` : ""}`,
              attempts: env.HH_MAX_RETRIES + 2
            });
          }

          throw htmlError;
        }
      }

      if (error instanceof HhApiError && canFallbackToFixtures(error)) {
        console.log(
          JSON.stringify({
            scope: "hh.request",
            status: "fallback",
            source: "hh",
            configuredMode: mode,
            errorCode: error.code,
            httpStatus: error.status,
            retryable: error.retryable
          })
        );

        return buildFixtureResult(input, {
          fallbackReason: `${error.code}${error.status ? `:${error.status}` : ""}`,
          attempts: env.HH_MAX_RETRIES + 1
        });
      }

      throw error;
    }
  }
}

export class LinkedInAdapterPlaceholder implements SourceAdapter {
  readonly source = "linkedin" as const;

  async searchVacancies(): Promise<VacancySearchResult> {
    throw new Error("linkedin_not_implemented");
  }
}

export async function getHhDiagnostics(input?: {
  probe?: boolean;
  query?: string;
  page?: number;
  perPage?: number;
  area?: string;
}): Promise<HhDiagnostics> {
  const diagnostics: HhDiagnostics = {
    source: "hh",
    configuredMode: resolveHhMode(),
    apiBaseUrl: env.HH_API_BASE_URL,
    userAgent: env.HH_USER_AGENT,
    fixtureCatalogSize: hhFixtureCatalog.length
  };

  if (!input?.probe) {
    return diagnostics;
  }

  try {
    const result = await new HhAdapter().searchVacancies({
      query: input.query ?? "typescript edtech",
      page: input.page ?? 0,
      perPage: input.perPage ?? 1,
      ...(input?.area ? { area: input.area } : {}),
      searchField: "name"
    });

    return {
      ...diagnostics,
      probe: {
        ok: true,
        modeUsed: result.meta?.modeUsed ?? "fixtures",
        fallbackUsed: result.meta?.fallbackUsed ?? false,
        found: result.found,
        returned: result.items.length,
        attempts: result.meta?.attempts ?? 0
      }
    };
  } catch (error: unknown) {
    if (error instanceof HhApiError) {
      return {
        ...diagnostics,
        probe: {
          ok: false,
          errorCode: error.code,
          httpStatus: error.status,
          message: error.message
        }
      };
    }

    return {
      ...diagnostics,
      probe: {
        ok: false,
        errorCode: "unknown",
        message: error instanceof Error ? error.message : "Unknown HH diagnostics error"
      }
    };
  }
}

export function getSourceAdapter(source: SourceKind): SourceAdapter {
  switch (source) {
    case "hh":
      return new HhAdapter();
    case "linkedin":
      return new LinkedInAdapterPlaceholder();
  }
}
