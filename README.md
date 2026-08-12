# MonteCarlo Trading Analytics Platform

Минимально рабочий фундамент торговой аналитической платформы на Next.js,
FastAPI и PostgreSQL. Текущий этап хранит и показывает инструменты, свечи,
счета и сделки. Стратегии, бэктестинг, симуляции Монте-Карло и генетические
алгоритмы пока намеренно не реализованы.

Этап 2 добавляет односторонний read-only мост MetaTrader 5: терминал передаёт
состояние счёта, символы, свечи, открытые позиции, историю сделок и heartbeat.
Backend не может отправлять торговые приказы.

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
- `POST /api/v1/mt5/heartbeat`
- `POST /api/v1/mt5/account`
- `POST /api/v1/mt5/symbols`
- `POST /api/v1/mt5/candles/batch`
- `POST /api/v1/mt5/positions`
- `POST /api/v1/mt5/trades/batch`
- `GET /api/v1/mt5/status`

Все значения цен, объёмов и P&L передаются JSON-строками, чтобы не терять
точность decimal-значений в JavaScript.

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
