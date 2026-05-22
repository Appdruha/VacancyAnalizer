# RH AI memory and EdAgent

`TypeScript` monorepo для платформы анализа индустрий, поиска партнёров, outreach-процессов и генерации проектных задач.

## Structure

- `apps/api` - HTTP API, auth, settings, audit, ingestion endpoints
- `apps/worker` - background jobs, HH ingestion, runtime health
- `apps/web` - admin dashboard с live-метриками Phase 1 и Phase 2
- `packages/database` - Prisma client и слой доступа к данным
- `packages/domain` - доменные типы и demo snapshot
- `packages/integrations` - adapters для внешних источников
- `packages/scoring` - utilities для scoring
- `packages/ai` - prompt layer и AI helpers
- `packages/config` - env configuration
- `packages/shared` - shared runtime helpers
- `prisma/schema.prisma` - схема базы данных
- `prisma/seed.ts` - seed для локального окружения
- `services/ml` - отдельный Python-контур под ML/R&D

## Current status

- `Phase 1` completed: foundation, DB, worker runtime, Docker stack
- `Phase 2` completed: HH ingestion flow, competency extraction, gap analytics
- `Phase 3` completed: company discovery, scoring v1, shortlist review
- `Phase 4` completed: company summaries, draft generation, versioned review flow
- `Phase 5` completed: outreach runtime, message events, reply classification, follow-up scheduler, escalation flow
- `Phase 6` completed: partner agreements, generated project briefs, competency links, project catalog
- `Phase 7` completed: memory event log, retrieval API, adaptive recommendations for tone and follow-up cadence
- `Phase 8` completed: separate Python recommendation service, remote ML evaluation pipeline, runtime fallback from ML to TS
- `LinkedIn` intentionally left as placeholder and returns `501 not_implemented`

## Commands

Install dependencies:

```bash
npm install
```

Typecheck and build:

```bash
npm run typecheck
npm run build
```

Database:

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

Run locally:

```bash
npm run dev:api
npm run dev:web
npm run dev:worker
```

Run full stack with Docker:

```bash
npm run docker:up
npm run docker:down
```

## Services

- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`
- Web: `http://localhost:3000`
- Worker health: `http://localhost:4100/health`
- Postgres: `localhost:5433`
- Redis: `localhost:6379`

## Demo credentials

- email: `admin@edagent.local`
- password: `changeme`

## Phase 2 notes

### HH integration

- основной источник второй фазы: `HH`
- ingestion запускается через `POST /vacancies/ingest/hh`
- вакансии сохраняются в `vacancies`
- компетенции извлекаются rule-based словарём и связываются через `vacancyCompetency`
- матрица разрыва доступна через `GET /analytics/competency-gap`
- для live-режима добавлены timeout, retry, exponential backoff и request throttling
- worker пишет structured logs по HH-запросам и ingestion runs

### Fixture mode for local Docker

В `docker-compose` включён `HH_USE_FIXTURES=true`, чтобы локальный стек поднимался и тестировался стабильно даже если live HH API отвечает `403` или ограничивает трафик.

Если нужен именно live HH режим:

1. выставь `HH_USE_FIXTURES=false`
2. задай валидный `HH_USER_AGENT`
3. при необходимости подстрой:
   - `HH_TIMEOUT_MS`
   - `HH_MAX_RETRIES`
   - `HH_RETRY_BASE_MS`
   - `HH_MIN_REQUEST_INTERVAL_MS`
4. перезапусти стек

### HH production-readiness checklist

- `HH_USER_AGENT` должен быть осмысленным и стабильным
- `HH_USE_FIXTURES=false` для боевого контура
- `ingestionRuns.errorMessage` должен сохранять понятный код ошибки, например `forbidden`, `rate_limited`, `timeout`
- при временных сбоях `HH` worker должен повторять запрос с backoff
- запросы к `HH` не должны идти слишком часто подряд

## Phase 3 notes

- `POST /companies/discover` ставит job на company discovery
- worker строит компании из vacancy intelligence
- для компаний создаются contacts и score history
- `GET /companies/shortlist?limit=10` отдаёт shortlist
- `PUT /companies/:id/stage` позволяет оператору вручную подтвердить shortlist или перевести компанию дальше по pipeline
- вручную подтверждённые стадии не затираются очередным discovery job

## Phase 4 notes

- `GET /companies/:id/profile-summary` отдаёт краткий профиль компании
- `POST /drafts/generate` создаёт новый `MessageDraft`
- разные `tone` и `kind` дают разные версии текста
- `PUT /drafts/:id/approval` поддерживает approve/reject flow
- все версии драфтов сохраняются в БД как отдельные записи
- `draft.generated` и `draft.approved` пишутся в `audit_logs`

## Phase 5 notes

- `POST /campaigns/send` creates an outreach campaign and queues the sending job
- `GET /campaigns` returns outreach campaigns
- `GET /messages` returns sent messages with delivery and reply statuses
- `GET /message-events` returns the event timeline for messages
- `POST /replies/simulate` queues reply processing
- `GET /replies` returns classified replies
- `POST /follow-ups/run` triggers the follow-up scheduler
- positive replies move into escalation workflow and create memory events
- `EMAIL_PROVIDER=simulated` gives a deterministic local provider for dev/test
- Docker Postgres now uses `localhost:5433` to avoid conflicts with local PostgreSQL on `5432`

## Phase 6 notes

- `POST /agreements` creates a partner agreement for a company
- `PUT /agreements/:id/status` updates agreement state to `draft`, `aligned`, or `signed`
- `POST /project-briefs/generate` creates a generated brief from the agreement and company competency context
- `GET /project-briefs` returns stored project briefs
- `GET /projects/catalog` returns the student-facing project catalog projection with company and agreement status
- project briefs now store explicit `roles` plus linked competencies

## Phase 7 notes

- `GET /memory-events` returns the retrieval-ready event log, optionally filtered by `companyId` or `eventType`
- `GET /memory/recommendations` returns the current recommended `tone` and `follow-up` cadence
- `GET /memory/overview` returns recent events, top event types and the current adaptive recommendation
- memory events are now written for draft generation, outreach delivery/failure, reply processing, escalation, agreements and project brief generation
- `POST /drafts/generate` now uses adaptive memory recommendations when `tone` is not passed explicitly
- worker uses adaptive memory to adjust `followUpDueAt` per company instead of only a global static setting

## Phase 8 notes

- `services/ml` is now a separate `FastAPI` service exposed on `http://localhost:8000`
- `GET /ml/health` checks the Python recommendation service through the API
- `POST /ml/evaluations/run` evaluates the remote Python heuristic against the current TS baseline
- `ML_USE_REMOTE_RECOMMENDER=true` makes `api` and `worker` use the Python recommendation engine first
- if the Python service is unavailable, the platform falls back to the local `TS` recommendation logic
- `docker compose` now starts `api`, `worker`, `web`, `postgres`, `redis`, and `ml` together

## Useful API checks

```bash
curl http://localhost:4000/platform/bootstrap
curl http://localhost:4000/vacancies
curl http://localhost:4000/industry-sources
curl http://localhost:4000/ingestion-runs
curl http://localhost:4000/analytics/competency-gap
curl http://localhost:4000/companies
curl http://localhost:4000/companies/shortlist?limit=10
curl http://localhost:4000/drafts
curl http://localhost:4000/campaigns
curl http://localhost:4000/messages
curl http://localhost:4000/message-events
curl http://localhost:4000/replies
```

Trigger HH ingestion:

```bash
curl -X POST http://localhost:4000/vacancies/ingest/hh \
  -H "Content-Type: application/json" \
  -d "{\"industryId\":\"<industry-id>\",\"query\":\"typescript edtech\",\"page\":0,\"perPage\":10,\"area\":\"1\"}"
```

Trigger outreach:

```bash
curl -X POST http://localhost:4000/campaigns/send \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Pilot outreach\",\"draftIds\":[\"<approved-draft-id>\"]}"

curl -X POST http://localhost:4000/replies/simulate \
  -H "Content-Type: application/json" \
  -d "{\"messageId\":\"<message-id>\",\"body\":\"We are interested, let's schedule a call next week.\",\"incomingFrom\":\"partner@example.com\"}"

curl -X POST http://localhost:4000/follow-ups/run
```
