import { env } from "@edagent/config";
import type { SourceKind } from "@edagent/domain";

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

export type SourceAdapter = {
  source: SourceKind;
  searchVacancies(input: VacancySearchInput): Promise<VacancySearchResult>;
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

function withOptionalString(value: string | null | undefined): string | undefined {
  return value ?? undefined;
}

function withOptionalNumber(value: number | null | undefined): number | undefined {
  return value ?? undefined;
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

export class HhAdapter implements SourceAdapter {
  readonly source = "hh" as const;

  async searchVacancies(input: VacancySearchInput): Promise<VacancySearchResult> {
    const url = new URL("/vacancies", env.HH_API_BASE_URL);
    url.searchParams.set("text", input.query);
    url.searchParams.set("page", String(input.page ?? 0));
    url.searchParams.set("per_page", String(input.perPage ?? 20));
    url.searchParams.set("search_field", input.searchField ?? "name");

    if (input.area) {
      url.searchParams.set("area", input.area);
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": env.HH_USER_AGENT,
        "HH-User-Agent": env.HH_USER_AGENT,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HH API request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as HhVacancySearchResponse;

    return {
      found: payload.found,
      page: payload.page,
      pages: payload.pages,
      perPage: payload.per_page,
      items: payload.items.map(mapHhVacancy)
    };
  }
}

export class LinkedInAdapterPlaceholder implements SourceAdapter {
  readonly source = "linkedin" as const;

  async searchVacancies(): Promise<VacancySearchResult> {
    throw new Error("linkedin_not_implemented");
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
