# ML service

Отдельный `Python`-контур для:

- NLP extraction из вакансий и сайтов;
- экспериментального `QLoRA`;
- исследовательских компонентов памяти;
- будущих `RFT/NARS` интеграций.

Сейчас сервис уже используется в `Phase 8` как remote recommendation engine:

- `GET /health`
- `POST /recommend/adaptive`
- `POST /evaluate/adaptive`

Основная идея:

- `TS` платформа остаётся основной runtime-системой;
- `Python` сервис позволяет быстрее экспериментировать с recommendation logic;
- при недоступности `Python`-сервиса основной контур откатывается на локальный `TS` fallback.
