# MonteCarlo Trading Analytics Platform

Минимально рабочий фундамент торговой аналитической платформы на Next.js,
FastAPI и PostgreSQL. Текущий этап хранит и показывает инструменты, свечи,
счета и сделки. Стратегии, бэктестинг, симуляции Монте-Карло и генетические
алгоритмы пока намеренно не реализованы.

## Структура

```text
apps/
  frontend/    Next.js, React, TypeScript, Vitest
  backend/     FastAPI, Pydantic, SQLAlchemy, Alembic, pytest
infra/         описание локальной инфраструктуры
docs/          архитектурные решения
docker-compose.yml
```

Подробности слоёв и модели данных: [docs/architecture.md](docs/architecture.md).

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

## Основные API endpoints

- `GET /health`
- `GET /api/v1/info`
- CRUD `/api/v1/symbols`
- `GET|POST /api/v1/candles`
- `GET|POST /api/v1/accounts`
- `GET|POST /api/v1/trades`

Все значения цен, объёмов и P&L передаются JSON-строками, чтобы не терять
точность decimal-значений в JavaScript.
