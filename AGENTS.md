# monte-carlo - local instructions

Before working here, read `~/codex-workspace/AGENTS.md`. This file adds only project-specific constraints.

## Project context

- Trading analytics platform with Next.js frontend, FastAPI backend, PostgreSQL, and a separate backtesting domain engine.
- `docs/architecture.md` is the primary architecture map.
- The MetaTrader 5 bridge is read-only; do not add order execution without an explicit architecture and security decision.
- Keep the backtesting engine independent of FastAPI and MT5 adapters and preserve deterministic, reproducible results.
- Treat market, account, and trade data as sensitive; never commit `.env` or credentials.

## Checks

- Frontend: run `npm run lint` and `npm test` from `apps/frontend`; use `npm run build` when build behavior changes.
- Backend: run `python -m pytest` from `apps/backend`; use configured Ruff and mypy checks for affected Python code.

Open only the relevant project document, AI Dev Team rule, or SPEC; do not preload all rules, specifications, or `LEARNING_LOG.md`.
