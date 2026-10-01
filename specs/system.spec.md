# System specification

## Назначение

Monte Carlo — read-only платформа рыночных данных, исследований стратегий и
воспроизводимого бэктестинга. Базовое развитие следует этапам 1–13 из
`docs/MONTE_CARLO_ROADMAP_13_TO_28.md`; этапы 14–28 являются опциональными.

## Системные инварианты

1. Доменная логика не зависит от web-фреймворка, ORM и брокерского терминала.
2. Исторические вычисления используют только данные, доступные на текущем шаге.
3. Результат воспроизводим по данным, версии стратегии, параметрам, seed и
   версии вычислителя.
4. Цена, объём и деньги не теряют точность из-за неявного binary floating point.
5. Источник, диапазон, полнота и преобразования данных сохраняются как provenance.
6. MT5 и будущие провайдеры подключаются через порты; торговые команды не входят
   в текущую границу продукта.
7. Ускоренные вычислители сверяются с эталонной CPU-реализацией.
8. Fallback не маскирует неполные данные и не смешивает источники без явной метки.

## Общие критерии приёмки этапа

- есть ограниченный SPEC и проверенные зависимости;
- миграции обратимы и не разрушают существующие данные;
- добавлены unit/integration/e2e тесты в соответствии с риском;
- обновлены `docs/ARCHITECTURE.md` и selected record в `prompts/STAGES.md`;
- подтверждены воспроизводимость, наблюдаемость и отказоустойчивое поведение;
- следующий этап не начинается автоматически.

## MC-BUILD-001 — Совместимый frontend container toolchain

Night Factory разрешает устранить воспроизведённый setup defect, не меняя
market/financial behavior. Pinned pnpm11.23.0 требует Node>=22.13.0;
dependencies/builder/runner Docker stages используют одну проверенную Node22
LTS image, закреплённую version+digest. pnpm pin и dependency lock сохраняются.
Acceptance: frozen Linux install → Next compile/typecheck/static generation →
standalone artifact → non-root runtime HTTP smoke на loopback. Windows symlink
EPERM не требует изменения host privileges, если equivalent Linux gate прошёл.
Это не MT5/API/browser correctness, не Stage7 и не deployment.
