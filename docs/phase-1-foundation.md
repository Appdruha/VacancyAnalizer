# Phase 1 Foundation

Этот этап реализует базовую платформу из роэдмапа:

- `apps/api` - минимальный HTTP API foundation
- `apps/worker` - каркас фонового процессинга и job tracking
- `apps/web` - admin dashboard shell
- `prisma/schema.prisma` - схема данных под `PostgreSQL`
- `auth`, `audit logs`, `system settings` - базовые платформенные модули

## Что уже покрыто

- базовая предметная модель и seed snapshot;
- HTTP endpoints для `health`, `login`, `settings`, `audit logs`, `jobs`, `companies`, `users`;
- runtime-контур очередей и статусов задач через `PostgreSQL`;
- worker health endpoint и фоновой процессинг заданий;
- admin shell с обзором KPI и shortlist preview на live API-данных;
- схема БД для ключевых сущностей первой фазы.

## Текущие ограничения

- хранилище пока in-memory;
- `Prisma`, `PostgreSQL`, `Redis` еще не подключены runtime-слоем;
- auth пока демо-формата через `.env`;
- worker пока не использует реальную очередь.

## Что подключать следующим шагом

1. `npm install`
2. поднять реальный `PostgreSQL`
3. `npm run db:generate`
4. `npm run db:migrate -- --name init`
5. `npm run db:seed`
6. `Redis/BullMQ`

## Проверка

1. `npm run typecheck`
2. `npm run dev:api`
3. открыть `GET /health`
4. открыть `GET /platform/bootstrap`
5. открыть `GET http://localhost:4100`

Если БД недоступна, API продолжит работать на demo snapshot.
