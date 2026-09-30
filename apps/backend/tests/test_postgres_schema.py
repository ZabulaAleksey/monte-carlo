"""Disposable PostgreSQL proof for the existing market-data migrations."""

import asyncio
import os
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine


def test_disposable_postgres_market_data_schema_and_roundtrip() -> None:
    database_url = os.getenv("MC_TEST_POSTGRES_URL")
    if database_url is None:
        pytest.skip("MC_TEST_POSTGRES_URL is required")
    parsed = make_url(database_url)
    if (
        parsed.get_backend_name() != "postgresql"
        or not (parsed.database or "").endswith("_test")
        or os.getenv("MC_TEST_DISPOSABLE") != "1"
    ):
        pytest.fail("real PostgreSQL integration requires an explicit disposable *_test database")

    async def verify() -> None:
        engine = create_async_engine(database_url)
        try:
            async with engine.connect() as connection:
                revision = await connection.scalar(text("SELECT version_num FROM alembic_version"))
                assert revision == "0009"
                columns = (
                    await connection.execute(
                        text(
                            "SELECT table_name, column_name, data_type, numeric_precision, "
                            "numeric_scale FROM information_schema.columns "
                            "WHERE table_schema = 'public' AND "
                            "((table_name = 'candles' AND column_name IN "
                            "('open_time', 'open', 'high', 'low', 'close', 'volume')) "
                            "OR (table_name = 'market_quotes' AND column_name IN "
                            "('bid', 'ask', 'observed_at', 'received_at')))"
                        )
                    )
                ).all()
                by_column = {(row.table_name, row.column_name): row for row in columns}
                for name in ("open", "high", "low", "close", "volume"):
                    row = by_column[("candles", name)]
                    assert (row.data_type, row.numeric_precision, row.numeric_scale) == (
                        "numeric",
                        24,
                        8,
                    )
                for name in ("bid", "ask"):
                    row = by_column[("market_quotes", name)]
                    assert (row.data_type, row.numeric_precision, row.numeric_scale) == (
                        "numeric",
                        24,
                        8,
                    )
                for table, name in (
                    ("candles", "open_time"),
                    ("market_quotes", "observed_at"),
                    ("market_quotes", "received_at"),
                ):
                    assert by_column[(table, name)].data_type == "timestamp with time zone"
                indexes = set(
                    (
                        await connection.execute(
                            text(
                                "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' "
                                "AND tablename IN ('candles', 'market_quotes')"
                            )
                        )
                    ).scalars()
                )
                assert {"ix_candles_symbol_time", "ix_market_quotes_observed_at"} <= indexes
                constraints = (
                    await connection.execute(
                        text(
                            "SELECT conname, contype::text AS contype, "
                            "confdeltype::text AS confdeltype FROM pg_constraint "
                            "WHERE conrelid = 'public.candles'::regclass"
                        )
                    )
                ).all()
                assert any(
                    row.conname == "uq_candle_series_time" and row.contype == "u"
                    for row in constraints
                )
                assert any(row.contype == "f" and row.confdeltype == "c" for row in constraints)

                await connection.rollback()  # End SQLAlchemy's read-only autobegin.
                transaction = await connection.begin()
                try:
                    symbol_id, candle_id = uuid4(), uuid4()
                    await connection.execute(
                        text(
                            "INSERT INTO symbols (id, name, description, digits, is_active, "
                            "volume_min, volume_step, volume_max, contract_size) VALUES "
                            "(:id, :name, '', 8, true, 0.01, 0.01, 99, 1)"
                        ),
                        {"id": symbol_id, "name": f"NIGHT_{symbol_id.hex[:16]}"},
                    )
                    await connection.execute(
                        text(
                            "INSERT INTO candles (id, symbol_id, timeframe, open_time, "
                            "open, high, low, close, volume, source) VALUES "
                            "(:id, :symbol_id, 'M1', :open_time, :price, :price, :price, "
                            ":price, 1, 'api')"
                        ),
                        {
                            "id": candle_id,
                            "symbol_id": symbol_id,
                            "open_time": datetime.fromisoformat("2026-09-30T06:00:00+03:00"),
                            "price": Decimal("123456789.12345678"),
                        },
                    )
                    row = (
                        await connection.execute(
                            text("SELECT open_time, open FROM candles WHERE id = :id"),
                            {"id": candle_id},
                        )
                    ).one()
                    assert row.open == Decimal("123456789.12345678")
                    assert row.open_time.astimezone(UTC) == datetime.fromisoformat(
                        "2026-09-30T03:00:00+00:00"
                    )
                finally:
                    await transaction.rollback()
        finally:
            await engine.dispose()

    asyncio.run(verify())
