"""Real PostgreSQL backtest repository evidence on explicit disposable loopback DB."""

from __future__ import annotations

import os
from dataclasses import replace
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import delete, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from test_backtest_engine import ScriptedStrategy, candle, run_engine, settings

from app.domain.backtesting.models import Signal
from app.infrastructure.database.backtesting import SqlAlchemyBacktestRunRepository
from app.infrastructure.database.models import (
    BacktestEquityPointModel,
    BacktestRunModel,
    BacktestTradeModel,
    SymbolModel,
)


def disposable_url() -> str:
    url = os.environ.get("MC_TEST_POSTGRES_URL")
    if url is None:
        pytest.skip("explicit disposable PostgreSQL is required")
    parsed = make_url(url)
    if (
        bool(parsed.query)
        or parsed.drivername != "postgresql+asyncpg"
        or parsed.host not in {"127.0.0.1", "localhost", "::1"}
        or not (parsed.database or "").endswith("_test")
        or os.environ.get("MC_TEST_DISPOSABLE") != "1"
    ):
        pytest.fail("repository proof requires explicit disposable loopback asyncpg *_test DB")
    return url


@pytest.mark.parametrize(
    "url,flag",
    [
        ("sqlite+aiosqlite:///not-postgres_test", "1"),
        ("postgresql+asyncpg://localhost/production", "1"),
        ("postgresql+asyncpg://external.example.invalid/scratch_test", "1"),
        ("postgresql+asyncpg://localhost/scratch_test", "0"),
        ("postgresql+asyncpg://localhost/scratch_test?host=external.example:5432", "1"),
        ("postgresql+asyncpg://localhost/scratch_test?host=/tmp/postgres", "1"),
        ("postgresql+asyncpg://localhost/scratch_test?port=6543", "1"),
        ("postgresql+asyncpg://localhost/scratch_test?host=localhost&host=external.example", "1"),
        ("postgresql+asyncpg://localhost/scratch_test?ssl=prefer", "1"),
    ],
)
def test_postgres_repository_guard_rejects_unsafe_target(monkeypatch, url, flag):
    monkeypatch.setenv("MC_TEST_POSTGRES_URL", url)
    monkeypatch.setenv("MC_TEST_DISPOSABLE", flag)
    with pytest.raises(pytest.fail.Exception, match="explicit disposable"):
        disposable_url()


@pytest.mark.asyncio
async def test_postgres_backtest_add_reload_list_trades_delete_owned_rows():
    engine = create_async_engine(disposable_url())
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    symbol_id = uuid4()
    run_id = None
    symbol_created = False
    try:
        result = await run_engine(
            [
                candle(1, open_price="100"),
                candle(2, open_price="100"),
                candle(3, open_price="90"),
                candle(4, open_price="95"),
            ],
            ScriptedStrategy({1: Signal.SELL, 2: Signal.BUY, 3: Signal.CLOSE}),
            settings(),
        )
        result = replace(
            result,
            symbol_id=symbol_id,
            parameters={"scenario": "synthetic_sell_reverse", "ordinal": 1},
            warnings=("Synthetic internal evidence only; no MT5 parity",),
        )
        async with sessions() as session:
            assert await session.scalar(text("SELECT version_num FROM alembic_version")) == "0009"
            session.add(
                SymbolModel(
                    id=symbol_id,
                    name=f"NIGHT_{symbol_id.hex[:16]}",
                    digits=2,
                    description="Disposable synthetic repository proof",
                )
            )
            await session.commit()
            symbol_created = True
            stored = await SqlAlchemyBacktestRunRepository(session).add(result)
            run_id = stored.id
            assert stored.result == result
            assert stored.result.metrics.final_balance == Decimal("1015")
            assert len(stored.result.trades) == 2
        # New session proves durable reload, not identity-map reuse.
        async with sessions() as session:
            repository = SqlAlchemyBacktestRunRepository(session)
            reloaded = await repository.get(run_id)
            assert reloaded is not None and reloaded.result == result
            assert await repository.trades(run_id) == result.trades
            summaries = await repository.list()
            summary = next(item for item in summaries if item.id == run_id)
            assert summary.symbol_id == symbol_id
            assert summary.total_trades == 2
            assert summary.final_balance == Decimal("1015")
            assert summary.created_at.utcoffset().total_seconds() == 0
            assert await repository.delete(run_id)
            assert await repository.get(run_id) is None
            assert await repository.trades(run_id) is None
            assert not await repository.delete(run_id)
            for model in (BacktestRunModel, BacktestTradeModel, BacktestEquityPointModel):
                column = model.id if model is BacktestRunModel else model.run_id
                count = await session.scalar(
                    select(func.count()).select_from(model).where(column == run_id)
                )
                assert count == 0
    finally:
        # Cleanup exact random test identity only; never truncate/delete tables.
        async with sessions() as session:
            if symbol_created:
                await session.execute(
                    delete(BacktestRunModel).where(BacktestRunModel.symbol_id == symbol_id)
                )
                await session.execute(delete(SymbolModel).where(SymbolModel.id == symbol_id))
            await session.commit()
        await engine.dispose()
