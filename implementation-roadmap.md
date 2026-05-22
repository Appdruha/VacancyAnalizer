# Roadmap реализации `RH AI memory and EdAgent`

## Статус

- [x] Фаза 1. Foundation
- [x] Фаза 2. Анализ индустрии и компетенций
- [x] Фаза 3. Поиск компаний и скоринг
- [x] Фаза 4. Коммуникации
- [x] Фаза 5. Outreach и квалификация
- [x] Фаза 6. Генерация ТЗ и каталога проектов
- [x] Фаза 7. Память агента и адаптация
- [x] Фаза 8. ML hardening и Python recommendation service

## Стек

- Основной backend: `Node.js + TypeScript`
- Frontend: `TypeScript`
- База данных: `PostgreSQL`
- Очереди и кэш: `Redis`
- ORM: `Prisma`
- Контейнеризация: `Docker Compose`
- ML/R&D контур: `Python` как отдельный сервис

## Фаза 1. Foundation

Статус:

- [x] Готово

Что сделать:

- собрать монорепо;
- поднять `api`, `web`, `worker`;
- подключить `PostgreSQL`, `Redis`, `Prisma`;
- сделать базовую схему БД;
- добавить миграции и seed;
- сделать базовые `auth`, `settings`, `audit logs`, `jobs`;
- собрать запуск одной командой через Docker.

Как:

- `apps/api` как HTTP API;
- `apps/web` как admin dashboard shell;
- `apps/worker` как runtime для background jobs;
- `packages/database` как DB access layer;
- `Prisma migrate + seed`;
- `docker compose up -d --build` для полного старта.

Что должно получиться:

- рабочий инженерный фундамент;
- API и worker работают с БД;
- dashboard поднимается;
- всё запускается одной командой.

Как протестить:

- `npm run typecheck`
- `npm run docker:up`
- открыть `http://localhost:4000/health`
- открыть `http://localhost:4000/platform/bootstrap`
- открыть `http://localhost:3000`
- открыть `http://localhost:4100/health`
- создать job через `POST /jobs` и убедиться, что worker перевёл её в `completed`

## Фаза 2. Анализ индустрии и компетенций

Статус:

- [x] Готово

Что сделать:

- подключить первый источник вакансий `HH`;
- оставить `LinkedIn` как placeholder, но не реализовывать;
- собрать ingestion вакансий через background jobs;
- извлекать компетенции из описаний вакансий;
- сохранять вакансии, источники и ingestion runs в БД;
- построить матрицу разрыва между программой и рынком;
- показать результаты в dashboard.

Как:

- `packages/integrations` содержит `HhAdapter` и `LinkedInAdapterPlaceholder`;
- `POST /vacancies/ingest/hh` ставит job в очередь;
- `apps/worker` забирает job, тянет вакансии HH, извлекает компетенции и сохраняет данные;
- `packages/database` хранит `industrySources`, `ingestionRuns`, `vacancies`, связи vacancy-competency;
- `GET /analytics/competency-gap` отдаёт gap matrix;
- `apps/web` показывает live-данные по источникам, прогонам, вакансиям и competency gaps;
- для локального Docker включён `HH_USE_FIXTURES=true`, чтобы сценарий был воспроизводимым даже если live HH API отвечает `403`.

Что должно получиться:

- в системе есть HH-источники и история ingestion runs;
- вакансии и extracted competencies лежат в БД;
- `LinkedIn` явно отвечает `501 not_implemented`;
- видно, какие компетенции покрываются программой хуже рынка;
- dashboard показывает данные второй фазы из API, а не только foundation shell.
- live-контур `HH` имеет timeout, retry, backoff, throttling и понятные коды ошибок.

Как протестить:

- `npm run typecheck`
- `npm run docker:up`
- открыть `http://localhost:4000/industry-sources`
- открыть `http://localhost:4000/ingestion-runs`
- открыть `http://localhost:4000/vacancies`
- открыть `http://localhost:4000/analytics/competency-gap`
- выполнить `POST /vacancies/ingest/hh` с `industryId`, `query`, `page`, `perPage`
- проверить, что worker обработал job и появился новый `ingestionRun`
- проверить, что `POST /industry-sources` с `source=linkedin` возвращает `501`
- открыть `http://localhost:3000` и убедиться, что dashboard показывает HH sources, latest runs, vacancy feed и competency gaps

## Фаза 3. Поиск компаний и скоринг

Статус:

- [x] Готово

Что сделать:

- собрать компании из открытых источников;
- хранить карточки компаний и контактов;
- реализовать scoring v1;
- сделать shortlist review;
- подготовить Top-10 и Top-100.

Как:

- добавить adapters для company discovery;
- нормализовать компанию по отрасли, региону и размеру;
- считать scoring по rule-based формуле;
- отдельным API отдавать shortlist и score breakdown;
- дать оператору возможность подтверждать shortlist.

Что должно получиться:

- есть пул компаний;
- каждая компания имеет score;
- можно собирать приоритетный shortlist.
- operator review сохраняет вручную подтверждённые стадии и не даёт discovery-пайплайну их затирать.

Как протестить:

- запустить job поиска компаний;
- проверить `companies`, `contacts`, `scores` в БД;
- проверить API списка компаний;
- проверить корректную сортировку Top-10;
- вручную поменять stage через review API и убедиться, что shortlist сохраняется

## Фаза 4. Коммуникации

Статус:

- [x] Готово

Что сделать:

- генерировать письма;
- генерировать краткий профиль компании;
- поддержать несколько tone-of-voice;
- добавить approve/reject flow;
- хранить версии драфтов.

Как:

- `packages/ai` использовать как prompt-layer;
- генерировать `MessageDraft`;
- сохранять все версии текста;
- approval фиксировать в БД и audit log.

Что должно получиться:

- для каждой компании можно подготовить персонализированный draft;
- оператор может утвердить или отклонить письмо;
- история правок сохраняется.
- company summary и tone-aware drafts доступны через API и dashboard.

Как протестить:

- создать draft для компании;
- проверить, что он сохранился в БД;
- утвердить/отклонить его через API;
- проверить audit log;
- убедиться, что текст и статус меняются корректно
- открыть `http://localhost:3000` и проверить блок `Draft Review`

## Фаза 5. Outreach и квалификация

Статус:

- [x] Готово

Что сделать:

- интегрировать email-отправку;
- отслеживать статусы писем;
- обрабатывать ответы;
- делать follow-up;
- эскалировать положительные ответы человеку.

Как:

- подключить email provider;
- отправку делать через jobs;
- reply classification хранить в БД;
- worker использовать для follow-up scheduler;
- положительные ответы переводить в отдельный workflow.

Что должно получиться:

- outreach-цикл работает end-to-end;
- есть видимость по доставке, ответам и follow-up;
- входящие ответы квалифицируются автоматически.

Как протестить:

- отправить тестовую кампанию;
- проверить создание `messages/events/replies`;
- смоделировать ответ и проверить классификацию;
- проверить, что follow-up создаётся по расписанию;
- проверить, что positive reply попадает в escalation flow

## Фаза 6. Генерация ТЗ и каталога проектов

Статус:

- [x] Готово

Что сделать:

- генерировать `Project Brief`;
- связывать проект с компетенциями;
- разбивать проект по ролям;
- публиковать каталог проектов.

Как:

- использовать данные из соглашения с партнёром;
- генерировать ТЗ по шаблону;
- сохранять `project_briefs`, `project_competencies`, роли;
- отдавать через API и dashboard.

Что должно получиться:

- из партнёрского соглашения формируется проект;
- проект связан с компетенциями;
- каталог готов для студентов.

Как протестить:

- создать agreement;
- сгенерировать по нему project brief;
- проверить связи в БД;
- проверить выдачу каталога через API;
- убедиться, что роли и компетенции сохраняются

## Фаза 7. Память агента и адаптация

Статус:

- [x] Готово

Что сделать:

- хранить историю всех действий агента;
- анализировать успешные и неуспешные коммуникации;
- внедрить adaptive recommendations;
- подготовить отдельный ML-контур.

Как:

- сначала строить memory как event log + retrieval;
- затем добавить аналитику outcomes;
- потом вынести `Python` сервис для R&D;
- позже подключать `QLoRA` и более сложную адаптацию.

Что должно получиться:

- агент запоминает историю;
- рекомендации улучшаются на основе прошлых результатов;
- есть основа для self-improving behavior.

Как протестить:

- накопить события коммуникаций;
- проверить, что outcomes сохраняются;
- сравнить рекомендации до и после истории;
- проверить, что adaptive logic меняет follow-up или tone;
- отдельно прогнать тестовый ML pipeline

## Фаза 8. ML hardening и Python recommendation service

Статус:

- [x] Готово

Что сделать:

- вынести recommendation engine в отдельный `Python` сервис;
- добавить отдельный evaluation pipeline для `tone` и `follow-up`;
- подключить безопасный remote recommender с fallback на `TS`;
- поднять весь ML-контур через `Docker Compose`.

Как:

- реализовать `services/ml` на `FastAPI`;
- добавить ручки `/health`, `/recommend/adaptive`, `/evaluate/adaptive`;
- в `api` сделать proxy-ручки `GET /ml/health` и `POST /ml/evaluations/run`;
- в `api` и `worker` использовать remote recommendation при `ML_USE_REMOTE_RECOMMENDER=true`, а при ошибке откатываться на локальную логику;
- dashboard показывать состояние ML-сервиса и результат evaluation.

Что должно получиться:

- recommendation engine живёт отдельно от основного `TS` runtime;
- можно сравнивать `Python` heuristic c текущим `TS` baseline;
- `draft generation` и `follow-up cadence` могут идти через remote ML сервис;
- при падении ML-сервиса платформа остаётся рабочей за счёт fallback.

Как протестить:

- `npm run typecheck`
- `npm run docker:up`
- открыть `http://localhost:4000/ml/health`
- выполнить `POST /ml/evaluations/run`
- выполнить `GET /memory/recommendations?companyId=<companyId>` и убедиться, что ответ идёт из remote recommendation flow
- выполнить `POST /drafts/generate` без `tone` и проверить, что выбран рекомендованный `tone`
- смоделировать positive/meeting reply и проверить, что recommendation меняет `follow-up` cadence

## Ближайший следующий шаг

- [ ] Начать Phase 9 / advanced ranking and experiments

Что делать первым:

- решить, нужен ли `QLoRA`/ranking поверх current heuristic;
- подготовить offline датасет для сравнения `TS` и `Python` recommendation engines;
- определить, какие сигналы стоит векторизовать и где действительно нужен retrieval beyond event log.
