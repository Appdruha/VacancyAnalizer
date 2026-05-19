# RH AI memory and EdAgent

`TypeScript` monorepo для платформы анализа индустрии, поиска партнеров, outreach и генерации проектных задач.

## Structure

- `apps/api` - API foundation, auth, settings, audit and read models
- `apps/worker` - background processing shell and job lifecycle
- `apps/web` - admin dashboard shell
- `packages/domain` - domain entities and seed snapshot
- `packages/scoring` - company scoring utilities
- `packages/integrations` - external source adapter contracts
- `packages/ai` - prompt catalog and generation helpers
- `packages/config` - environment configuration
- `packages/shared` - shared runtime helpers
- `prisma/schema.prisma` - database schema baseline
- `services/ml` - separate Python service for NLP and research tasks

## Phase 1 status

Phase 1 foundation is now scaffolded:

- monorepo layout is in place;
- API, worker and web shells exist;
- auth, audit logs, settings and jobs are modeled;
- first-pass database schema is defined;
- in-memory snapshot lets us iterate before wiring PostgreSQL and Redis.

## Commands

After installing dependencies:

```bash
npm install
npm run typecheck
npm run build
npm run db:generate
```

Start services from the root:

```bash
npm run dev:api
npm run dev:web
npm run dev:worker
```

Database setup:

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

One-command Docker startup:

```bash
npm run docker:up
```

Services:

- API: `http://localhost:4000/health`
- Web: `http://localhost:3000`
- Worker: `http://localhost:4100` (background process logs only)
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Demo credentials

- email: `admin@edagent.local`
- password: `changeme`
