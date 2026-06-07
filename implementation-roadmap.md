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
- [ ] Фаза 9. Product hardening под финальный scope
- [ ] Фаза 10. Production baseline и защита

## Финальный Scope

Что делаем:

- `HH` как единственный источник вакансий
- `email` как единственный канал outreach, по умолчанию в `simulated` demo-режиме
- baseline `RAG` как обязательная часть темы проекта: документы, чанки, embeddings, retrieval и grounding генерации
- внутренний каталог проектов как финальный продуктовый модуль
- memory/adaptive/ML слой вокруг истории коммуникаций
- standalone-платформу без обязательной внешней зависимости от другой LMS/CRM

Что не делаем:

- интеграцию с `LinkedIn`
- второй источник вакансий
- интеграцию с `ПроКомпетенции`
- обязательную реализацию `QLoRA`, `RFT`, `NARS` в текущем релизе

Что считаем допустимым:

- `LinkedIn` может остаться как отключенный placeholder в доменной модели
- `project catalog` остается внутренним модулем платформы
- advanced research memory можно оставлять как отдельный R&D трек после core release
- `email outreach` в финальном demo-scope считается полностью допустимым в `simulated` режиме без внешнего провайдера

## Целевой продукт

На выходе должна получиться рабочая standalone-система:

- анализирует рынок вакансий через `HH`
- извлекает и нормализует компетенции
- собирает и ранжирует компании
- генерирует и проводит `email`-коммуникации, по умолчанию в `simulated` режиме для стабильного демо
- отслеживает ответы, соглашения и проектные задачи
- формирует каталог проектов
- адаптирует стратегию коммуникации на основе памяти и ML-рекомендаций
- использует retrieval-augmented generation по knowledge base компании для подготовки писем и project briefs

## Фаза 9. Product hardening под финальный scope

Статус:

- [~] В работе

### Блок 9.1. HH production-ready

Что сделать:

- убрать зависимость от `fixtures` для основного рабочего сценария
- довести live-режим `HH` до стабильного состояния
- улучшить диагностику ошибок `HH`
- подготовить операторский сценарий для пустой выдачи, `403`, `429`, timeout

Как:

- проверить и стабилизировать `HH_USER_AGENT`
- улучшить structured logs по `HH`
- разделить ошибки по типам и показать их в `ingestionRuns`
- добавить явный debug/diagnostic поток для live ingestion
- ввести явные режимы `HH_MODE=live|auto|fixtures`

Что должно получиться:

- ingestion через `HH` стабильно работает в live-режиме
- оператор понимает, почему запуск не удался
- worker не падает "вслепую"

Как протестить:

- [x] добавить явные режимы `HH_MODE=live|auto|fixtures`
- [x] добавить `GET /integrations/hh/diagnostics`
- [x] добавить прозрачный worker logging по `modeUsed/fallbackUsed`
- [ ] запустить `POST /vacancies/ingest/hh` в live-режиме
- [ ] проверить `GET /ingestion-runs`
- [ ] проверить, что ошибки пишутся понятным кодом
- [ ] проверить, что успешный run заполняет вакансии без fixture-данных

### Блок 9.2. Extraction и competency quality

Что сделать:

- улучшить extraction компетенций поверх текущего rule-based слоя
- добавить нормализацию навыков и алиасов
- уменьшить мусорные и дублирующиеся competency links

Как:

- расширить словарь и normalization rules
- добавить пост-обработку extracted competencies
- подготовить baseline-quality набор примеров

Что должно получиться:

- extracted competencies ближе к реальным навыкам рынка
- gap analysis становится более полезным

Как протестить:

- [x] добавить preview API для extraction quality
- [x] добавить canonical normalization layer с aliases
- [ ] прогнать ingestion по нескольким разным запросам
- [ ] проверить качество competency links в БД
- [ ] проверить, что `GET /analytics/competency-gap` выглядит стабильнее

### Блок 9.3. Company enrichment и scoring polish

Что сделать:

- улучшить обогащение профилей компаний
- сделать score breakdown более объяснимым
- усилить shortlist review для оператора

Как:

- добавить больше сигналов в профили компаний
- улучшить explanation layer рядом со score
- добавить фильтры и ручные пометки в shortlist flow

Что должно получиться:

- shortlist выглядит обоснованным и удобным для ручной верификации

Как протестить:

- [x] добавить explainable score breakdown
- [x] улучшить enrichment через безопасные `website/email` сигналы
- [x] проверить `GET /companies`
- [x] проверить `GET /companies/shortlist`
- [x] вручную изменить stage и убедиться, что review сохраняется

### Блок 9.4. Outreach runtime stabilization

Что сделать:

- оставить `simulated` outreach основным demo-каналом
- довести delivery tracking
- улучшить follow-up и reply handling
- добавить logging переговорных результатов

Как:

- сохранить опциональный live provider как расширение, но не как обязательную часть demo-scope
- хранить provider-specific delivery data
- добавить операторский слой для фиксации outcome после positive reply

Что должно получиться:

- simulated outreach стабильно закрывает основной флоу без внешнего мейлера
- система знает, что было после положительного ответа

Как протестить:

- [x] добавить `GET /integrations/email/diagnostics`
- [x] добавить demo-safe simulated provider для браузерного сценария
- [x] проверить `GET /messages`
- [x] проверить `GET /message-events`
- [x] проверить фиксацию negotiation outcome
- [x] проверить simulated campaign end-to-end без внешнего mail provider

### Блок 9.5. Materials, FAQ и communication package

Что сделать:

- добавить FAQ/one-pager/materials слой
- связать материалы с компанией и проектом
- улучшить quality communication package

Как:

- генерировать FAQ и short briefing materials
- хранить материалы рядом с draft/agreement/project context

Что должно получиться:

- кроме письма есть полноценный communication package

Как протестить:

- [x] сгенерировать пакет материалов
- [x] проверить сохранение и выдачу через API
- [ ] вывести communication package в dashboard

### Блок 9.6. Project catalog polish

Что сделать:

- улучшить project brief generation
- усилить role decomposition
- довести внутренний каталог проектов до финального UX

Как:

- обогатить `brief` контекстом компании и соглашения
- улучшить роли и skill requirements
- улучшить отображение каталога в dashboard/API

Что должно получиться:

- каталог выглядит как финальный продуктовый модуль

Как протестить:

- [x] обогатить brief company/agreement/materials context
- [x] улучшить catalog projection в API/dashboard
- [ ] создать agreement
- [ ] сгенерировать project brief
- [ ] проверить `GET /projects/catalog`

### Блок 9.7. Memory/ML evaluation

Что сделать:

- собрать evaluation dataset
- формализовать сравнение `TS baseline` и `Python recommender`
- определить policy переключения между local и remote recommendation

Как:

- добавить evaluation samples по реальным сценариям ответов
- расширить `POST /ml/evaluations/run`
- зафиксировать критерии качества рекомендации

Что должно получиться:

- Phase 7-8 становятся измеримыми, а не только архитектурными

Как протестить:

- [x] прогнать `POST /ml/evaluations/run`
- [x] сравнить baseline и remote рекомендации
- [x] добавить benchmark dataset и sample-level policy summary
- [x] проверить, что рекомендации меняются на реальных outcome-сценариях

## Фаза 10. Production baseline и защита

Статус:

- [ ] Не начато

### Блок 10.1. Security и access

Что сделать:

- усилить auth
- добавить базовый `RBAC`
- привести конфиг и секреты к production baseline

Как протестить:

- [x] добавить Google auth API и signed bearer sessions
- [x] добавить `GET /auth/me`
- [x] добавить test page для Google sign-in
- [x] проверить login flow
- [x] проверить ограничения ролей
- [x] закрыть business API routes авторизацией
- [x] перевести `web` в auth-gated режим
- [ ] проверить отсутствие секретов в коде и seed

### Блок 10.2. Audit и compliance baseline

Что сделать:

- довести audit trail
- подготовить privacy/data-retention baseline
- закрыть минимальные требования по персональным данным

Как протестить:

- [ ] проверить audit logs на ключевых действиях
- [ ] проверить, что критические изменения не проходят без trace

### Блок 10.3. Tests

Что сделать:

- добавить smoke tests
- добавить integration tests
- добавить regression checks для core flow

Как протестить:

- [ ] прогнать test suite локально
- [ ] прогнать e2e сценарий `HH -> company -> draft -> outreach -> reply -> agreement -> brief`

### Блок 10.4. Observability и ops

Что сделать:

- добавить monitoring/metrics baseline
- улучшить logs
- подготовить runbook по основным сбоям

Как протестить:

- [ ] проверить health endpoints
- [ ] проверить логи по API, worker, ML service
- [ ] проверить runbook на сценариях `HH fail`, `email fail`, `ml fail`

### Блок 10.5. Demo/defense readiness

Что сделать:

- подготовить стабильный demo script
- зафиксировать KPI и ограничения
- собрать финальный narrative для защиты проекта

Как протестить:

- [ ] прогнать demo без ручных патчей в ходе показа
- [ ] проверить, что все ключевые артефакты создаются end-to-end

## Ближайший следующий шаг

- [ ] Начать Блок 9.1. HH production-ready

Что делаем первым:

- перевести `HH` из demo-first режима в live-first сценарий
- сохранить fallback для локальной разработки, но не считать его основным путем
- подготовить понятную диагностику live ingestion
