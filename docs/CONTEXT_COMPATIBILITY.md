# Совместимость проектного контекста

## Матрица

| Источник | Статус | Правило |
|---|---|---|
| Workspace/глобальные `AGENTS.md`, skills, hooks, Git workflow | наследуется | Не дублировать локально, кроме проектных уточнений |
| Корневой `AGENTS.md` проекта | активен | Маршрутизирует к минимальному набору источников истины |
| `MONTE_CARLO_ROADMAP_13_TO_28.md` | канонический план | 1–13 базовые; 14–28 опциональные |
| `prompts/STAGES.md` | canonical execution state | Единственный current selector/status/blockers/evidence/NEXT |
| `ROADMAP.md` | производный human summary | Хранит долгосрочный порядок, не отдельную state machine |
| Исторические секции внутри `STAGES.md` | reference launchers | Сохраняют уникальные ограничения, но не имеют selector/status/NEXT |
| Промпты из `docs/integrate-future-context` | superseded | Не удаляются из истории; актуальные launchers находятся в текущей ветке |
| Отдельные project hooks/MCP | не требуются | Существующая автоматизация достаточна |
| MT5, Broker API, MetaApi | продуктовые адаптеры | Не классифицировать как MCP Codex |

## Поток контекста

`AGENTS.md` → current record в `prompts/STAGES.md` → нужный раздел roadmap →
SPEC/ADR → код и тесты → evidence/status/NEXT в том же selected record.

Автоматизация контекста обязана различать план и подтверждённое состояние.
Сканирование всего roadmap не требуется для локальной задачи. При расхождении
статуса с кодом приоритет имеют проверенный код, миграции и тесты, после чего
живые документы синхронизируются.

## Устранённые конфликты

- Старое рабочее название «Этап 3» сопоставлено с каноническим этапом 6.
- Частичная реализация этапов 3–5 не объявлена завершённой без evidence-аудита.
- Опциональные этапы 14–28 исключены из автоматического выбора следующей задачи.
- Похожие по назначению промпты сохранены как короткие launchers вместо второго
  независимого набора требований.
- Legacy `docs/AI_PLAN.md` и `docs/AI_STATUS.md` семантически объединены с
  selected record и удалены как competing execution-state owners; их история
  остаётся в Git.

## Известное ограничение validator runtime traversal

На Windows текущий global context validator при рекурсивном обходе может зайти
в runtime junction `apps/frontend/.next/standalone/node_modules/react` и
завершиться с `WinError 5`. Для проверок Slice A `.next` временно перемещался за
пределы Git-root и гарантированно возвращался после запуска validator; tracked
files при этом не менялись. Это tooling limitation, а не project-state blocker.
В отдельном global tooling slice следует сделать traversal детерминированным:
исключать `.next` и другие объявленные disposable runtime/build directories до
разыменования junction/symlink, чтобы ручное перемещение больше не требовалось.
