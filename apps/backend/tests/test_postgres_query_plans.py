"""Bounded PostgreSQL query-plan evidence for existing database consumers."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, insert, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from test_postgres_backtest_repository import disposable_url

from app.domain.enums import CandleSource
from app.infrastructure.database.backtesting import (
    SqlAlchemyBacktestRunRepository,
    SqlAlchemyHistoricalDataProvider,
)
from app.infrastructure.database.historical_data_requests import (
    SqlAlchemyHistoricalDataRequestGateway,
)
from app.infrastructure.database.models import (
    AccountModel,
    BacktestRunModel,
    CandleModel,
    HistoricalDataCoverageModel,
    HistoricalDataRequestModel,
    PositionModel,
    SymbolModel,
    TradeModel,
)
from app.infrastructure.database.repositories import (
    SqlAlchemyCandleRepository,
    SqlAlchemyPositionRepository,
    SqlAlchemyTradeRepository,
)

SYMBOL_COUNT = 32
CANDLES_PER_SERIES = 512
COVERAGE_ROWS = 4096
ACCOUNT_COUNT = 32
ACCOUNT_ROWS = 256
RUN_COUNT = 8192
REQUEST_ROWS = 4096
CAPTURE_ENV = "MC_QUERY_PLAN_CAPTURE_JSON"
MAX_CAPTURE_BYTES = 128 * 1024


class _Rows:
    def all(self) -> list[object]:
        return []


class _StatementCapture:
    """Small session seam to obtain statements emitted by production consumers."""

    def __init__(self) -> None:
        self.statements: list[object] = []

    async def scalars(self, statement: object) -> _Rows:
        self.statements.append(statement)
        return _Rows()

    async def scalar(self, statement: object) -> None:
        self.statements.append(statement)
        return None


async def _consumer_statements(
    symbol_id: UUID, account_id: UUID
) -> dict[str, tuple[str, object]]:
    capture = _StatementCapture()
    now = datetime(2026, 1, 1, 4, 15, tzinfo=UTC)
    start = now - timedelta(minutes=5)
    end = now + timedelta(minutes=5)

    await SqlAlchemyHistoricalDataProvider(capture).get_candles(
        symbol_id, "M1", start, end
    )
    candle_history = capture.statements[-1]
    await SqlAlchemyHistoricalDataProvider(capture).get_coverage(
        symbol_id, "M1", start, end
    )
    coverage_overlap = capture.statements[-2]
    await SqlAlchemyPositionRepository(capture).list(account_id)
    account_positions = capture.statements[-1]
    await SqlAlchemyTradeRepository(capture).list(account_id, limit=10)
    account_trades = capture.statements[-1]
    await SqlAlchemyBacktestRunRepository(capture).list(limit=100)
    recent_runs = capture.statements[-1]
    await SqlAlchemyCandleRepository(capture).list(limit=200)
    global_candles = capture.statements[-1]
    await SqlAlchemyHistoricalDataRequestGateway(capture).claim("synthetic-terminal")
    request_claim = capture.statements[-1]

    return {
        "historical_candle_range": (
            "SqlAlchemyHistoricalDataProvider.get_candles",
            candle_history,
        ),
        "historical_coverage_overlap": (
            "SqlAlchemyHistoricalDataProvider.get_coverage",
            coverage_overlap,
        ),
        "account_positions_ordered": (
            "SqlAlchemyPositionRepository.list(account_id)",
            account_positions,
        ),
        "account_trades_ordered": (
            "SqlAlchemyTradeRepository.list(account_id, limit)",
            account_trades,
        ),
        "recent_backtest_runs": (
            "SqlAlchemyBacktestRunRepository.list(limit)",
            recent_runs,
        ),
        "global_optional_candle_list": (
            "SqlAlchemyCandleRepository.list(symbol_id=None, limit)",
            global_candles,
        ),
        "historical_request_claim_or_lease": (
            "SqlAlchemyHistoricalDataRequestGateway.claim(terminal_id)",
            request_claim,
        ),
    }


def _compiled_sql(statement: object) -> str:
    compiled = statement.compile(  # type: ignore[attr-defined]
        dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
    )
    return str(compiled)


def _index_names(node: dict[str, object]) -> set[str]:
    names: set[str] = set()
    index_name = node.get("Index Name")
    if isinstance(index_name, str):
        names.add(index_name)
    for child in node.get("Plans", []):  # type: ignore[union-attr]
        if isinstance(child, dict):
            names.update(_index_names(child))
    return names


def _source_hash(relative: str) -> str:
    path = Path(__file__).resolve().parents[1] / relative
    return hashlib.sha256(path.read_bytes()).hexdigest()


async def _assert_seed_rows_absent(
    sessions: async_sessionmaker[AsyncSession], run_id: UUID
) -> None:
    token = run_id.hex[:20]
    symbol_ids = select(SymbolModel.id).where(SymbolModel.name.like(f"NQ{token}%"))
    account_ids = select(AccountModel.id).where(
        AccountModel.external_id.like(f"QPLAN-{token}-%")
    )
    checks = {
        "symbols": select(func.count()).select_from(SymbolModel).where(
            SymbolModel.name.like(f"NQ{token}%")
        ),
        "accounts": select(func.count()).select_from(AccountModel).where(
            AccountModel.external_id.like(f"QPLAN-{token}-%")
        ),
        "candles": select(func.count()).select_from(CandleModel).where(
            CandleModel.symbol_id.in_(symbol_ids)
        ),
        "coverage": select(func.count()).select_from(HistoricalDataCoverageModel).where(
            HistoricalDataCoverageModel.symbol_id.in_(symbol_ids)
        ),
        "positions": select(func.count()).select_from(PositionModel).where(
            PositionModel.account_id.in_(account_ids)
        ),
        "trades": select(func.count()).select_from(TradeModel).where(
            TradeModel.account_id.in_(account_ids)
        ),
        "backtest_runs": select(func.count()).select_from(BacktestRunModel).where(
            BacktestRunModel.symbol_id.in_(symbol_ids)
        ),
        "historical_requests": select(func.count())
        .select_from(HistoricalDataRequestModel)
        .where(HistoricalDataRequestModel.symbol_id.in_(symbol_ids)),
    }
    async with sessions() as session:
        counts = {
            name: int(await session.scalar(statement) or 0)
            for name, statement in checks.items()
        }
    assert counts == dict.fromkeys(checks, 0), f"synthetic plan rows persisted: {counts}"


async def _seed(session: AsyncSession, run_id: UUID) -> tuple[UUID, UUID]:
    base = datetime(2026, 1, 1, tzinfo=UTC)
    symbol_ids = [uuid4() for _ in range(SYMBOL_COUNT)]
    account_ids = [uuid4() for _ in range(ACCOUNT_COUNT)]
    await session.execute(
        insert(SymbolModel),
        [
            {
                "id": symbol_id,
                "name": f"NQ{run_id.hex[:20]}{index:02d}",
                "digits": 5,
                "description": "synthetic query-plan evidence",
            }
            for index, symbol_id in enumerate(symbol_ids)
        ],
    )
    await session.execute(
        insert(AccountModel),
        [
            {
                "id": account_id,
                "external_id": f"QPLAN-{run_id.hex[:20]}-{index:02d}",
                "name": f"synthetic-{index:02d}",
                "currency": "USD",
                "balance": Decimal("100000"),
                "created_at": base,
            }
            for index, account_id in enumerate(account_ids)
        ],
    )

    candle_rows: list[dict[str, object]] = []
    for symbol_id in symbol_ids:
        for row_index in range(CANDLES_PER_SERIES):
            opened = base + timedelta(minutes=row_index)
            value = Decimal("1.10000") + Decimal(row_index) / Decimal("100000")
            candle_rows.append(
                {
                    "id": uuid4(),
                    "symbol_id": symbol_id,
                    "timeframe": "M1",
                    "open_time": opened,
                    "open": value,
                    "high": value + Decimal("0.00010"),
                    "low": value - Decimal("0.00010"),
                    "close": value,
                    "volume": Decimal("1"),
                    "source": CandleSource.API.value,
                }
            )
    await session.execute(insert(CandleModel), candle_rows)

    await session.execute(
        insert(HistoricalDataCoverageModel),
        [
            {
                "id": uuid4(),
                "symbol_id": symbol_ids[index % SYMBOL_COUNT],
                "timeframe": "M1",
                "covered_start": base + timedelta(minutes=index * 2),
                "covered_end": base + timedelta(minutes=index * 2 + 1),
                "source": "synthetic",
                "updated_at": base,
            }
            for index in range(COVERAGE_ROWS)
        ],
    )

    position_rows: list[dict[str, object]] = []
    trade_rows: list[dict[str, object]] = []
    for account_index, account_id in enumerate(account_ids):
        for row_index in range(ACCOUNT_ROWS):
            ordinal = account_index * ACCOUNT_ROWS + row_index
            when = base + timedelta(seconds=ordinal)
            common = {
                "account_id": account_id,
                "symbol_id": symbol_ids[ordinal % SYMBOL_COUNT],
                "volume": Decimal("0.10"),
                "open_price": Decimal("1.10000"),
            }
            position_rows.append(
                {
                    "id": uuid4(),
                    **common,
                    "external_id": f"P-{run_id.hex[:20]}-{ordinal}",
                    "side": "BUY",
                    "current_price": Decimal("1.10010"),
                    "profit": Decimal("1"),
                    "swap": Decimal("0"),
                    "opened_at": when,
                    "observed_at": when,
                }
            )
            trade_rows.append(
                {
                    "id": uuid4(),
                    **common,
                    "external_id": f"T-{run_id.hex[:20]}-{ordinal}",
                    "side": "BUY",
                    "close_price": Decimal("1.10010"),
                    "opened_at": when,
                    "closed_at": when + timedelta(minutes=1),
                    "profit": Decimal("1"),
                    "commission": Decimal("0"),
                    "swap": Decimal("0"),
                    "status": "closed",
                }
            )
    await session.execute(insert(PositionModel), position_rows)
    await session.execute(insert(TradeModel), trade_rows)

    await session.execute(
        insert(BacktestRunModel),
        [
            {
                "id": uuid4(),
                "symbol_id": symbol_ids[index % SYMBOL_COUNT],
                "strategy_name": "synthetic",
                "strategy_version": "1",
                "timeframe": "M1",
                "requested_start": base,
                "requested_end": base + timedelta(hours=1),
                "data_start": base,
                "data_end": base + timedelta(hours=1),
                "candle_count": 60,
                "initial_capital": Decimal("100000"),
                "final_balance": Decimal("100001"),
                "settings": {},
                "parameters": {},
                "metrics": {"total_trades": 1, "return_pct": "0.001"},
                "data_complete": True,
                "warnings": [],
                "status": "completed",
                "created_at": base + timedelta(seconds=index),
            }
            for index in range(RUN_COUNT)
        ],
    )

    await session.execute(
        insert(HistoricalDataRequestModel),
        [
            {
                "id": uuid4(),
                "symbol_id": symbol_ids[index % SYMBOL_COUNT],
                "timeframe": "M1",
                "requested_start": base + timedelta(minutes=index * 2),
                "requested_end": base + timedelta(minutes=index * 2 + 1),
                "status": "pending",
                "requested_at": base + timedelta(seconds=index),
                "candle_count": 0,
            }
            for index in range(REQUEST_ROWS)
        ],
    )
    await session.execute(text("ANALYZE candles"))
    await session.execute(text("ANALYZE historical_data_coverage"))
    await session.execute(text("ANALYZE positions"))
    await session.execute(text("ANALYZE trades"))
    await session.execute(text("ANALYZE backtest_runs"))
    await session.execute(text("ANALYZE historical_data_requests"))
    return symbol_ids[0], account_ids[0]


@pytest.mark.asyncio
async def test_existing_consumers_have_reviewable_postgres_query_plans() -> None:
    """Measure actual plans for repository-issued statements on bounded synthetic data."""
    engine = create_async_engine(disposable_url())
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    run_id = uuid4()
    try:
        async with sessions() as session, session.begin():
            symbol_id, account_id = await _seed(session, run_id)
            statements = await _consumer_statements(symbol_id, account_id)
            plans: dict[str, dict[str, object]] = {}
            for shape_id, (consumer, statement) in statements.items():
                sql = _compiled_sql(statement)
                result = await session.execute(
                    text(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {sql}")
                )
                raw_plan = result.scalar_one()
                plan_document = raw_plan[0]
                plan_root = plan_document["Plan"]
                plans[shape_id] = {
                    "consumer": consumer,
                    "sql_sha256": hashlib.sha256(sql.encode("utf-8")).hexdigest(),
                    "plan": plan_document,
                    "observed_index_names": sorted(_index_names(plan_root)),
                }

            expected = {
                "historical_candle_range": {
                    "uq_candle_series_time",
                    "ix_candles_symbol_time",
                },
                "historical_coverage_overlap": {"ix_historical_coverage_lookup"},
                "account_positions_ordered": {"ix_positions_account_observed"},
                "account_trades_ordered": {"ix_trades_account_opened"},
                "recent_backtest_runs": {"ix_backtest_runs_created_at"},
            }
            for shape_id, accepted_indexes in expected.items():
                assert set(plans[shape_id]["observed_index_names"]) & accepted_indexes, (
                    shape_id,
                    plans[shape_id]["observed_index_names"],
                )
            for shape in plans.values():
                assert isinstance(shape["plan"], dict)
                assert "Plan" in shape["plan"]

            if os.environ.get(CAPTURE_ENV) == "1":
                source_files = [
                    "app/infrastructure/database/backtesting.py",
                    "app/infrastructure/database/historical_data_requests.py",
                    "app/infrastructure/database/repositories.py",
                    "app/infrastructure/database/models.py",
                ]
                capture = {
                    "format": "mc-postgres-query-plan-capture-v1",
                    "database_server_version": await session.scalar(
                        text("SHOW server_version")
                    ),
                    "synthetic_cardinality": {
                        "symbols": SYMBOL_COUNT,
                        "candles": SYMBOL_COUNT * CANDLES_PER_SERIES,
                        "coverage": COVERAGE_ROWS,
                        "accounts": ACCOUNT_COUNT,
                        "positions": ACCOUNT_COUNT * ACCOUNT_ROWS,
                        "trades": ACCOUNT_COUNT * ACCOUNT_ROWS,
                        "backtest_runs": RUN_COUNT,
                        "historical_requests": REQUEST_ROWS,
                    },
                    "source_sha256": {
                        name: _source_hash(name) for name in source_files
                    },
                    "plans": plans,
                }
                capture_json = json.dumps(capture, sort_keys=True, separators=(",", ":"))
                if len(capture_json.encode("utf-8")) > MAX_CAPTURE_BYTES:
                    raise AssertionError("query-plan capture exceeds the 128 KiB output cap")
                print("MC_QUERY_PLAN_CAPTURE=" + capture_json)
            # Planning and ANALYZE stay in this transaction; never persist fixture rows.
            await session.rollback()
        await _assert_seed_rows_absent(sessions, run_id)
    finally:
        await engine.dispose()
