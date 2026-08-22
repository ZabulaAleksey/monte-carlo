# MonteCarlo Trading Analytics Platform

Торговая аналитическая платформа на Next.js, FastAPI и PostgreSQL. Она хранит
инструменты, свечи, счета и сделки, а также запускает воспроизводимый
последовательный бэктест стратегий. Симуляции Монте-Карло и генетические
алгоритмы пока не реализованы.

Этап 2 добавляет односторонний read-only мост MetaTrader 5: терминал передаёт
состояние счёта, символы, свечи, открытые позиции, историю сделок и heartbeat.
Backend не может отправлять торговые приказы.

Исторически названный «Этапом 3» блок добавляет независимый от FastAPI и
MetaTrader доменный движок
бэктестинга, демонстрационную стратегию пересечения скользящих средних,
виртуальные сделки, equity curve, метрики, REST API и research workspace на
странице `/strategies`. Демонстрационная стратегия проверяет инфраструктуру и
не позиционируется как прибыльная.

## Структура

```text
apps/
  frontend/    Next.js, React, TypeScript, Vitest
  backend/     FastAPI, Pydantic, SQLAlchemy, Alembic, pytest
infra/         описание локальной инфраструктуры
docs/          архитектурные решения
prompts/       промпты для будущих этапов 3–13
docker-compose.yml
```

Подробности слоёв и модели данных: [docs/architecture.md](docs/architecture.md).
Канонические требования этапов для продолжения разработки:
[docs/project-context.md](docs/project-context.md). Промпты для будущих этапов
собраны в [prompts/README.md](prompts/README.md) и выполняются только по одному,
после явного запроса пользователя.

## Дорожная карта и статус

Канонический план содержит 13 исходных этапов и опциональное расширение
14–28: [полный roadmap](docs/MONTE_CARLO_ROADMAP_13_TO_28.md). Краткий статус и
правила перехода находятся в [docs/ROADMAP.md](docs/ROADMAP.md), текущая работа
— в [docs/AI_PLAN.md](docs/AI_PLAN.md), подтверждённое состояние — в
[docs/AI_STATUS.md](docs/AI_STATUS.md).

Реализованный CPU-бэктест соответствует преимущественно каноническому этапу 6.
Следующий продуктовый этап — этап 7, эталонный Monte Carlo на CPU, но перед ним
нужно завершить reconciliation этапов 3–6 и независимую проверку математики P&L.
Оставшееся мигание replay-графика также сохранено как явный технический долг.
Этапы 14–28 не входят в ближайшую работу и запускаются только после отдельного
решения.

## Быстрый запуск

Требуются Docker Engine и Docker Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

После запуска:

- frontend: <http://localhost:3000>
- backend OpenAPI: <http://localhost:8000/docs>
- health check: <http://localhost:8000/health>

Backend автоматически применяет миграции и, при `SEED_DEMO_DATA=true`,
добавляет идемпотентный демонстрационный набор. Пароль в `.env.example`
предназначен только для локальной разработки — перед любым внешним развёртыванием
его необходимо заменить.

Остановка без удаления данных:

```bash
docker compose down
```

Для удаления локального тома PostgreSQL явно выполните `docker compose down -v`.

## Локальная разработка

### Backend

```bash
cd apps/backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -e ".[dev]"
pytest
ruff check .
mypy app
```

Для запуска backend вне Docker задайте `DATABASE_URL`, примените миграции
командой `alembic upgrade head` и выполните:

```bash
uvicorn app.main:app --reload
```

### Frontend

```bash
cd apps/frontend
npm ci
npm run test
npm run lint
npm run build
npm run dev
```

Публичный адрес API задаётся переменной `NEXT_PUBLIC_API_URL`. Реальные секреты
не должны использовать префикс `NEXT_PUBLIC_` и не должны попадать в Git.

Dashboard обновляет данные каждые 15 секунд. При наличии реального MT5-счёта
портфельные показатели рассчитываются только для него, а `DEMO-001` используется
только как fallback. Свечи имеют явный источник `demo`, `mt5` или `api`;
Dashboard реального счёта не смешивает их с demo-серией. Источник данных и
состояние MT5 явно показаны в интерфейсе.

Market Pulse использует TradingView Lightweight Charts и показывает настоящие
OHLC-свечи: зелёные бычьи и красные медвежьи тела с тенями `high/low`. Выбранная
комбинация символа и таймфрейма хранится в браузере под ключом
`montecarlo.market-pulse.series` и восстанавливается после обновления страницы.

Navigation, Market Data и Trades используют тот же источник состояния. Пока API
загружается, sidebar показывает `Checking environment`. При наличии online
MT5 или сохранённого реального счёта demo-свечи и demo-сделки скрываются на всех
страницах; demo остаётся только fallback-режимом.

## Основные API endpoints

- `GET /health`
- `GET /api/v1/info`
- CRUD `/api/v1/symbols`
- `GET|POST /api/v1/candles`
- `GET|POST /api/v1/accounts`
- `GET|POST /api/v1/trades`
- `GET /api/v1/backtests/strategies`
- `POST /api/v1/backtests`
- `GET /api/v1/backtests`
- `GET /api/v1/backtests/{run_id}`
- `GET /api/v1/backtests/{run_id}/trades`
- `GET|PUT /api/v1/backtests/history/coverage`
- external API aliases under `/api/v1/tester/backtests`
- `GET /api/v1/tester/documentation` — скачиваемая документация тестера
- `GET /api/v1/database/overview` — безопасный read-only обзор PostgreSQL
- `POST /api/v1/mt5/heartbeat`
- `POST /api/v1/mt5/account`
- `POST /api/v1/mt5/symbols`
- `POST /api/v1/mt5/candles/batch`
- `POST /api/v1/mt5/candles/coverage`
- `POST /api/v1/mt5/positions`
- `POST /api/v1/mt5/trades/batch`
- `GET /api/v1/mt5/status`

Все значения цен, объёмов и P&L передаются JSON-строками, чтобы не терять
точность decimal-значений в JavaScript.

## Правила бэктеста

- Стратегия видит историю только до текущей завершённой свечи.
- Решение `BUY`, `SELL` или `CLOSE` исполняется на открытии следующей
  свечи; `HOLD` не создаёт ордер.
- Одновременно поддерживается одна net-позиция; противоположный сигнал
  детерминированно закрывает и разворачивает её.
- Stop loss и take profit задаются в процентах от цены исполнения. При
  одновременном касании обоих уровней применяется консервативное правило
  stop-first.
- Position size задаётся в лотах. Минимум, шаг, максимум и размер контракта
  синхронизируются из MT5; дополнительно действует платформенный максимум 99
  лотов. Комиссия задаётся в процентах от номинала каждого исполнения, swap —
  как подписанный дневной процент от номинала открытого лота, а проскальзывание
  — в пунктах котировки с точностью до шестого информативного знака.
- До симуляции backend проверяет подтверждённое покрытие всего периода.
  Перекрывающиеся кэшированные диапазоны объединяются и повторно используются.
- Оставшаяся позиция закрывается по close последней свечи.
- Один синхронный запуск ограничен 20 000 свечами; более длинный диапазон нужно
  разбить на отдельные исследовательские прогоны.

Если подтверждено только частичное покрытие, сайт кратко повторяет проверку,
показывает заметное предупреждение и запускает расчёт на крупнейшем
подтверждённом непрерывном интервале. Запрошенный и фактический диапазоны,
`data_complete` и предупреждения сохраняются вместе с результатом.

Разделы `/api-docs`, `/database` и `/guide` содержат API-контракт, read-only
состояние PostgreSQL и пошаговый запуск сервиса. Автономный файл
`apps/frontend/public/offline/index.html` можно открыть напрямую, даже когда
Docker и все HTTP-сервисы остановлены.

Настройки, фактический диапазон и количество свечей, версия и параметры
стратегии, все виртуальные сделки, полная equity curve и итоговые метрики
сохраняются в отдельных таблицах backtesting.

Контракт запуска без сайта и примеры запросов описаны в
[`docs/backtesting-api.md`](docs/backtesting-api.md).

## Подключение MetaTrader 5

1. Скопируйте корневой файл [`.env.example`](.env.example) в корневой
   `.env`. В строке `MT5_API_KEY=...` файла `<корень проекта>/.env`
   замените пример случайным значением длиной не менее 32 символов.
2. Скопируйте [`mt5/config.example`](mt5/config.example) в
   `mt5/config.local`. В этом локальном, исключённом из Git файле заполните
   `BridgeBaseUrl`, `BridgeTerminalId` и тот же `MT5_API_KEY`.
3. Перезапустите backend командой `docker compose up --build`.
4. Скомпилируйте
   [`mt5/Experts/MonteCarloBridge.mq5`](mt5/Experts/MonteCarloBridge.mq5).
5. В MetaTrader откройте **Tools → Options → Expert Advisors → Allow
   WebRequest for listed URL** и добавьте значение `BridgeBaseUrl` из
   `<корень проекта>/mt5/config.local`.
6. При подключении EA к графику откройте вкладку **Inputs** и перенесите туда
   значения `BridgeBaseUrl`, `BridgeTerminalId` и `MT5_API_KEY` из
   `<корень проекта>/mt5/config.local`.

Подробная модель безопасности, контракты и правила идемпотентности описаны в
[`docs/mt5-bridge.md`](docs/mt5-bridge.md). Ключ используется только backend и
EA; frontend его не получает. Файл `config.local` служит приватной локальной
памяткой: MQL5 не читает его автоматически.
