function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@edagent.local",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "changeme",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ?? ""
} as const;
