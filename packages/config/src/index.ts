function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export const env = {
  APP_NAME: process.env.APP_NAME ?? "RH AI memory and EdAgent",
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: readNumber("PORT", 3000),
  API_PORT: readNumber("API_PORT", 4000),
  WORKER_PORT: readNumber("WORKER_PORT", 4100),
  WORKER_POLL_MS: readNumber("WORKER_POLL_MS", 2000),
  API_BASE_URL: process.env.API_BASE_URL ?? "http://localhost:4000",
  HH_API_BASE_URL: process.env.HH_API_BASE_URL ?? "https://api.hh.ru",
  HH_USER_AGENT: process.env.HH_USER_AGENT ?? "edagent/0.1 (local development)",
  HH_USE_FIXTURES: readBoolean("HH_USE_FIXTURES", false),
  HH_TIMEOUT_MS: readNumber("HH_TIMEOUT_MS", 10000),
  HH_MAX_RETRIES: readNumber("HH_MAX_RETRIES", 2),
  HH_RETRY_BASE_MS: readNumber("HH_RETRY_BASE_MS", 800),
  HH_MIN_REQUEST_INTERVAL_MS: readNumber("HH_MIN_REQUEST_INTERVAL_MS", 1000),
  ML_SERVICE_URL: process.env.ML_SERVICE_URL ?? "http://localhost:8000",
  ML_REQUEST_TIMEOUT_MS: readNumber("ML_REQUEST_TIMEOUT_MS", 5000),
  ML_USE_REMOTE_RECOMMENDER: readBoolean("ML_USE_REMOTE_RECOMMENDER", false),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@edagent.local",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "changeme",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ?? "",
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? "simulated",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "partnerships@edagent.local"
} as const;
