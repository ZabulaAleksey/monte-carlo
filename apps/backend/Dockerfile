FROM python:3.11-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.12.3 /uv /uvx /bin/

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
RUN uv sync --frozen --no-dev --no-editable

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && python -m app.infrastructure.database.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
