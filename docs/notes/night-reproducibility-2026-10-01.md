# Night reproducibility evidence 2026-10-01

Исходный HEAD 086c17d510457c6565a9406af5b1a8def5500112, fix/stage-3-market-data-contract.
Backend migrated .venv referenced absent C:\Python312; canonical-cache offline restore lacked mypy wheel. Online uv sync --locked --extra dev --cache-dir E:\DEV\dependencies\uv-cache restored exact graph; no lock changes. uv run --locked --extra dev python -m pytest --basetemp <writable-work>: 72 PASS, 1 guarded PostgreSQL skip. Ruff PASS; mypy 55 sources PASS. This is not fresh live database/migration proof.

Frontend default pnpm test hit 23 Vitest worker-start timeouts before assertions. Unchanged suite pnpm exec vitest run --maxWorkers=1: 23 files/91 tests PASS, 169.42s. ESLint PASS. pnpm build compiled/typechecked/generated all 11 static pages but exited 1 while standalone copy attempted Windows symlinks (EPERM on react/@next/env etc). Overall build is ENVIRONMENT_BLOCKED; compilation does not equal complete build PASS. Historical Linux/earlier build remains historical.

Owner action MC-HOST-SYMLINK-01: rerun pinned frontend production build on approved symlink-capable Windows host or existing Linux CI, preserve exact HEAD and exit0 artifact evidence. Do not enable machine-wide privileges automatically.
MC-DB01-DECISION-01 D1–D4 remains required before ticks/events migration/retention; no market writes, Stage7 or MT5 correctness claim. TD-BT-001 remains OPEN until external golden MT5 evidence.
