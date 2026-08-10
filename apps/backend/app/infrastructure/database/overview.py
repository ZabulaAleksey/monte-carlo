from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.database_admin import (
    CandleDatasetStats,
    DatabaseOverview,
    DatabaseTableStats,
)
from app.infrastructure.database.models import (
    AccountModel,
    BacktestEquityPointModel,
    BacktestRunModel,
    BacktestTradeModel,
    CandleModel,
    HistoricalDataCoverageModel,
    MarketQuoteModel,
    PositionModel,
    SymbolModel,
    TradeModel,
)


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


class SqlAlchemyDatabaseOverviewReader:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def overview(self) -> DatabaseOverview:
        bind = self._session.get_bind()
        engine_name = bind.dialect.name
        counts = (
            await self._session.execute(
                select(
                    select(func.count()).select_from(SymbolModel).scalar_subquery().label("symbols"),
                    select(func.count()).select_from(CandleModel).scalar_subquery().label("candles"),
                    select(func.count()).select_from(MarketQuoteModel).scalar_subquery().label("market_quotes"),
                    select(func.count()).select_from(AccountModel).scalar_subquery().label("accounts"),
                    select(func.count()).select_from(PositionModel).scalar_subquery().label("positions"),
                    select(func.count()).select_from(TradeModel).scalar_subquery().label("trades"),
                    select(func.count()).select_from(BacktestRunModel).scalar_subquery().label("backtest_runs"),
                    select(func.count()).select_from(BacktestTradeModel).scalar_subquery().label("backtest_trades"),
                    select(func.count()).select_from(BacktestEquityPointModel).scalar_subquery().label("backtest_equity_points"),
                    select(func.count()).select_from(HistoricalDataCoverageModel).scalar_subquery().label("historical_data_coverage"),
                )
            )
        ).one()._mapping
        table_names = (
            "symbols",
            "candles",
            "market_quotes",
            "accounts",
            "positions",
            "trades",
            "backtest_runs",
            "backtest_trades",
            "backtest_equity_points",
            "historical_data_coverage",
        )
        tables = tuple(
            DatabaseTableStats(name=name, row_count=int(counts[name] or 0))
            for name in table_names
        )

        dataset_rows = (
            await self._session.execute(
                select(
                    SymbolModel.id,
                    SymbolModel.name,
                    CandleModel.timeframe,
                    CandleModel.source,
                    func.count(CandleModel.id),
                    func.min(CandleModel.open_time),
                    func.max(CandleModel.open_time),
                )
                .join(SymbolModel, SymbolModel.id == CandleModel.symbol_id)
                .group_by(
                    SymbolModel.id,
                    SymbolModel.name,
                    CandleModel.timeframe,
                    CandleModel.source,
                )
                .order_by(func.count(CandleModel.id).desc())
                .limit(200)
            )
        ).all()
        datasets = tuple(
            CandleDatasetStats(
                symbol_id=row[0],
                symbol=row[1],
                timeframe=row[2],
                source=row[3],
                candle_count=int(row[4]),
                first_at=_utc(row[5]),
                last_at=_utc(row[6]),
            )
            for row in dataset_rows
        )

        server_time = _utc(
            await self._session.scalar(select(func.current_timestamp()))
            or datetime.now(UTC)
        )
        database_name = engine_name
        server_version = engine_name
        revision: str | None = None
        size_bytes: int | None = None
        if engine_name == "postgresql":
            system = (
                await self._session.execute(
                    text(
                        "SELECT current_database(), version(), "
                        "pg_database_size(current_database())"
                    )
                )
            ).one()
            database_name = str(system[0])
            server_version = str(system[1]).split(",")[0]
            size_bytes = int(system[2])
            revision_value = await self._session.scalar(
                text("SELECT version_num FROM alembic_version LIMIT 1")
            )
            revision = str(revision_value) if revision_value is not None else None

        return DatabaseOverview(
            connected=True,
            read_only=True,
            engine=engine_name,
            database_name=database_name,
            server_version=server_version,
            schema_revision=revision,
            database_size_bytes=size_bytes,
            server_time=server_time,
            tables=tables,
            candle_datasets=datasets,
        )
