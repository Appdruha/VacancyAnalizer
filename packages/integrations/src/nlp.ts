import type { ExternalVacancy, CompetencySignal } from "./types.js";

type CompetencyRule = {
  canonicalName: string;
  category: string;
  aliases: string[];
};

const competencyRules: CompetencyRule[] = [
  {
    canonicalName: "typescript",
    category: "engineering",
    aliases: ["typescript", "ts"]
  },
  {
    canonicalName: "javascript",
    category: "engineering",
    aliases: ["javascript", "js", "ecmascript"]
  },
  {
    canonicalName: "node.js",
    category: "backend",
    aliases: ["node.js", "nodejs", "node js"]
  },
  {
    canonicalName: "react",
    category: "frontend",
    aliases: ["react", "react.js", "reactjs"]
  },
  {
    canonicalName: "sql",
    category: "data",
    aliases: ["sql", "postgres sql", "structured query language"]
  },
  {
    canonicalName: "postgresql",
    category: "data",
    aliases: ["postgresql", "postgres", "postgre"]
  },
  {
    canonicalName: "python",
    category: "engineering",
    aliases: ["python", "py"]
  },
  {
    canonicalName: "fastapi",
    category: "backend",
    aliases: ["fastapi", "fast api"]
  },
  {
    canonicalName: "docker",
    category: "devops",
    aliases: ["docker", "containers", "containerization"]
  },
  {
    canonicalName: "redis",
    category: "backend",
    aliases: ["redis"]
  },
  {
    canonicalName: "rest api",
    category: "backend",
    aliases: ["rest api", "restful api", "http api"]
  },
  {
    canonicalName: "analytics",
    category: "analytics",
    aliases: ["analytics", "product analytics", "web analytics"]
  },
  {
    canonicalName: "data analysis",
    category: "analytics",
    aliases: ["data analysis", "analyze data", "analysis of data"]
  },
  {
    canonicalName: "machine learning",
    category: "ai",
    aliases: ["machine learning", "ml", "predictive models"]
  },
  {
    canonicalName: "prompt engineering",
    category: "ai",
    aliases: ["prompt engineering", "prompt design", "prompting"]
  },
  {
    canonicalName: "llm applications",
    category: "ai",
    aliases: ["llm", "large language model", "gpt applications", "ai assistant"]
  },
  {
    canonicalName: "data visualization",
    category: "analytics",
    aliases: ["data visualization", "dashboards", "bi dashboards", "reporting"]
  },
  {
    canonicalName: "etl",
    category: "data",
    aliases: ["etl", "data pipelines", "pipeline development"]
  },
  {
    canonicalName: "a/b testing",
    category: "analytics",
    aliases: ["a/b testing", "ab testing", "experimentation"]
  }
];

function normalizeExtractionText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[(){}[\],;:!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasToPattern(alias: string): RegExp {
  if (alias.length <= 2 && /^[a-z0-9+/#.-]+$/i.test(alias)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}([^a-z0-9]|$)`, "i");
  }

  return new RegExp(`\\b${escapeRegex(alias).replace(/\\ /g, "\\s+")}\\b`, "i");
}

export function extractCompetencySignals(
  vacancy: Pick<ExternalVacancy, "title" | "requirement" | "responsibility" | "description">
): CompetencySignal[] {
  const text = normalizeExtractionText(
    [vacancy.title, vacancy.requirement, vacancy.responsibility, vacancy.description].filter(Boolean).join(" ")
  );

  const signals = competencyRules.flatMap((rule) => {
    const aliasesMatched = rule.aliases.filter((alias) => aliasToPattern(alias).test(text));
    if (aliasesMatched.length === 0) {
      return [];
    }

    return [
      {
        canonicalName: rule.canonicalName,
        category: rule.category,
        aliasesMatched
      }
    ];
  });

  return signals.sort((left, right) => left.canonicalName.localeCompare(right.canonicalName));
}

export function extractCompetencyCandidates(
  vacancy: Pick<ExternalVacancy, "title" | "requirement" | "responsibility" | "description">
): string[] {
  return extractCompetencySignals(vacancy).map((signal) => signal.canonicalName);
}
