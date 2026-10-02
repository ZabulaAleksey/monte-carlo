# Lossless migration audit: legacy AI plan/status

Этот документ — evidence-note миграции, а не владелец execution state. Current
Stage ID/status/NEXT/blockers теперь принадлежат только `docs/STAGES.md`; этот
аудит ниже сохраняет исторические пути первой миграции 2026-09-08.

## Scope и метод

Сравнены версии `main:docs/AI_PLAN.md` и `main:docs/AI_STATUS.md` с current HEAD:
SPEC, ROADMAP, STAGES, architecture/design/decisions, API/MT5 documentation,
LEARNING_LOG, manifests, code и accepted tests. Проверялась семантика, а не
совпадение текста. Inventory содержит 101 нумерованный source item: `P01–P21`
из AI_PLAN и `S01–S80` из AI_STATUS. Продолжающий текст и ненумерованные абзацы
рассматривались как qualifiers соответствующего item.

Классификации:

- `MIGRATED` — актуальный факт находится в подходящем canonical owner;
- `DUPLICATE` — факт уже существовал вне legacy state-файла до Slice A;
- `OBSOLETE` — имеется конкретное более новое заменяющее evidence;
- `MISSING` — актуальный факт не представлен после миграции.

## AI_PLAN inventory

| Source items | Итог | Destination/evidence |
|---|---|---|
| P01–P03: обязательные 1–13, опциональные 14–28, старое имя «Этап 3» соответствует преимущественно этапу 6 | DUPLICATE | `docs/ROADMAP.md`, `docs/MONTE_CARLO_ROADMAP_13_TO_28.md`, `docs/project-context.md` |
| P04–P08: reconciliation перед Stage 7, evidence matrix, TD-BT-001, Stage 7 SPEC и explicit launch gate | MIGRATED | selected `MC-RECON-3-6` record и historical Stage 7 launcher в `prompts/STAGES.md`; старый отдельный path `prompts/07-monte-carlo-cpu.md` заменён объединённым STAGES record |
| P09–P11: TD-UI automated/component/browser gates и 20 000-candle evidence | DUPLICATE | `backtesting-reliability.spec.md`, `DECISIONS.md`, `LEARNING_LOG.md`, README |
| P12: переход на Canvas/OffscreenCanvas только при сохраняющемся white-frame/full-redraw | OBSOLETE | production browser evidence подтвердило stable SVG без white frame/full redraw; migration renderer не требуется |
| P13–P17: TD-BT-001 contract/tick/currency/cost/exits/bankruptcy/equity criteria | MIGRATED | selected STAGES record; detailed behavior remains in backtesting SPEC/architecture/API |
| P18–P20: после reconciliation утвердить/реализовать/test Stage 7 | DUPLICATE | roadmap, project context и historical Stage 7 launcher; Stage 7 остаётся inactive |
| P21: обновлять AI_STATUS после Stage 7 | OBSOLETE | `prompts/STAGES.md` принят единственным execution-state owner |

## AI_STATUS inventory

| Source items | Итог | Destination/evidence |
|---|---|---|
| S01: объединение stage launchers и overlay result | DUPLICATE | Git history, `CONTEXT_COMPATIBILITY.md`, current canonical validator |
| S02: датированные test counts 63/90 | OBSOLETE | последующие commits изменили suites; более новое frontend evidence содержит 91 test, а старые counts остаются историей Git |
| S03–S07: repo move/integration history, pnpm/uv locks/caches/virtual store и build allowlist | DUPLICATE | Git history, architecture/ADR, AGENTS и `package.json`/`pnpm-workspace.yaml` |
| S08: audit advisories и отказ от автоматического major/binary upgrade | MIGRATED | `docs/DECISIONS.md`, ADR-000 dated security baseline |
| S09: frozen Docker restores и `UNVERIFIED_BY_LOCAL_DOCKER` | MIGRATED | dependency contract в `docs/ARCHITECTURE.md` |
| S10–S15: marker lookup, virtualized chart, replay clock/evidence, ledger и frontend boundaries | DUPLICATE | BTR-025/026/030, DESIGN, frontend architecture, decisions, tests |
| S16: независимая прокрутка двух Strategies columns | OBSOLETE | BTR-024 и текущая implementation заменили её единой page scroll; internal scroll оставлен только ledger после десяти строк |
| S17–S32: drawdown, yearly history, calendar/fullscreen/cancellation, domain/API/replay/localization/saved-run/lot contracts | DUPLICATE | backtesting SPEC, architecture, DESIGN, API docs, decisions, tests |
| S33: денежный swap на лот в день | OBSOLETE | более новый BTR/API/architecture contract задаёт signed percentage of entry notional per crossed day |
| S34–S68: lookback/coverage/API/axes/cost inputs/partial data/queues/quotes/Dashboard/MT5/runtime/Market Data behavior | DUPLICATE | backtesting and market-pulse SPECs, architecture, DESIGN, API/MT5 docs, LEARNING_LOG and accepted tests |
| S69–S70: TD-BT trust boundary и непроверенные canonical stages | MIGRATED | selected `MC-RECON-3-6`; reconciliation расширена до stages 3–6 |
| S71–S75: 20 000 cap, client replay, sampled quotes, FX classification и current contract-size P&L boundary | DUPLICATE | architecture, BTR/MP specs, decisions and MT5 docs |
| S76: explicit cost inputs без автоматического historical cost profile | MIGRATED | backtesting boundary в `docs/ARCHITECTURE.md` |
| S77–S79: reconciliation, TD-BT и gated preparation of Stage 7 | MIGRATED | selected STAGES record and ROADMAP |
| S80: optional stages 14–28 deferred | DUPLICATE | ROADMAP, system SPEC and project context |

Ненумерованные legacy prose clauses не добавляют отдельного непокрытого факта:
last-completed-block mapping находится в ROADMAP; TD-UI commit boundary и
browser evidence — в DECISIONS/LEARNING_LOG/SPEC; TD-BT closure criterion — в
STAGES; Docker limitation покрыта S09.

## Итог

| Classification | Count |
|---|---:|
| MIGRATED | 18 |
| DUPLICATE | 78 |
| OBSOLETE | 5 |
| MISSING | 0 |

Первичный audit нашёл три missing facts: S08, S09 и S76. Они восстановлены в
семантически подходящих canonical destinations, после чего unresolved
`MISSING=0`. Legacy `AI_PLAN.md`/`AI_STATUS.md` восстанавливать как state owners
не требуется.
