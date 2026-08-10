from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.backtesting.models import (
    MAX_BACKTEST_CANDLES,
    BacktestMetrics,
    BacktestResult,
    BacktestRunSummary,
    BacktestSettings,
    EquityPoint,
    ExitReason,
    PositionSide,
    SlippageMode,
    StoredBacktestResult,
    VirtualTrade,
)
from app.domain.entities import Candle
from app.domain.enums import CandleSource
from app.infrastructure.database.models import (
    BacktestEquityPointModel,
    BacktestRunModel,
    BacktestTradeModel,
    CandleModel,
)


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


class SqlAlchemyHistoricalDataProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_candles(
        self,
        symbol_id: UUID,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> list[Candle]:
        result = await self._session.scalars(
            select(CandleModel)
            .where(
                CandleModel.symbol_id == symbol_id,
                CandleModel.timeframe == timeframe.upper(),
                CandleModel.open_time >= start_at,
                CandleModel.open_time <= end_at,
            )
            .order_by(CandleModel.open_time.asc())
            .limit(MAX_BACKTEST_CANDLES + 1)
        )
        return [
            Candle(
                item.id,
                item.symbol_id,
                item.timeframe,
                _utc(item.open_time),
                item.open,
                item.high,
                item.low,
                item.close,
                item.volume,
                CandleSource(item.source),
            )
            for item in result.all()
        ]


class SqlAlchemyBacktestRunRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, result: BacktestResult) -> StoredBacktestResult:
        run_id = uuid4()
        created_at = datetime.now(UTC)
        model = BacktestRunModel(
            id=run_id,
            symbol_id=result.symbol_id,
            strategy_name=result.strategy_name,
            strategy_version=result.strategy_version,
            timeframe=result.timeframe,
            requested_start=result.requested_start,
            requested_end=result.requested_end,
            data_start=result.data_start,
            data_end=result.data_end,
            candle_count=result.candle_count,
            initial_capital=result.settings.initial_capital,
            final_balance=result.metrics.final_balance,
            settings=self._settings_json(result.settings),
            parameters=dict(result.parameters),
            metrics=self._metrics_json(result.metrics),
            status="completed",
            created_at=created_at,
        )
        model.trades = [
            BacktestTradeModel(
                run_id=run_id,
                sequence=trade.sequence,
                side=trade.side.value,
                volume=trade.volume,
                opened_at=trade.opened_at,
                closed_at=trade.closed_at,
                open_price=trade.open_price,
                close_price=trade.close_price,
                stop_loss=trade.stop_loss,
                take_profit=trade.take_profit,
                exit_reason=trade.exit_reason.value,
                gross_profit=trade.gross_profit,
                commission=trade.commission,
                swap=trade.swap,
                net_profit=trade.net_profit,
            )
            for trade in result.trades
        ]
        model.equity_points = [
            BacktestEquityPointModel(
                run_id=run_id,
                sequence=point.sequence,
                timestamp=point.timestamp,
                balance=point.balance,
                equity=point.equity,
                drawdown_pct=point.drawdown_pct,
            )
            for point in result.equity_curve
        ]
        self._session.add(model)
        try:
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            raise
        self._session.expire_all()
        stored = await self.get(run_id)
        if stored is None:
            raise RuntimeError("Persisted backtest run could not be reloaded")
        return stored

    async def list(self, limit: int = 100) -> list[BacktestRunSummary]:
        rows = await self._session.scalars(
            select(BacktestRunModel)
            .order_by(BacktestRunModel.created_at.desc())
            .limit(limit)
        )
        return [
            BacktestRunSummary(
                id=row.id,
                created_at=_utc(row.created_at),
                symbol_id=row.symbol_id,
                timeframe=row.timeframe,
                strategy_name=row.strategy_name,
                strategy_version=row.strategy_version,
                data_start=_utc(row.data_start),
                data_end=_utc(row.data_end),
                total_trades=int(str(row.metrics["total_trades"])),
                final_balance=row.final_balance,
                return_pct=Decimal(str(row.metrics["return_pct"])),
            )
            for row in rows.all()
        ]

    async def get(self, run_id: UUID) -> StoredBacktestResult | None:
        model = await self._session.scalar(
            select(BacktestRunModel)
            .where(BacktestRunModel.id == run_id)
            .options(
                selectinload(BacktestRunModel.trades),
                selectinload(BacktestRunModel.equity_points),
            )
        )
        if model is None:
            return None
        return StoredBacktestResult(model.id, _utc(model.created_at), self._result(model))

    async def trades(self, run_id: UUID) -> tuple[VirtualTrade, ...] | None:
        run_exists = await self._session.scalar(
            select(BacktestRunModel.id).where(BacktestRunModel.id == run_id)
        )
        if run_exists is None:
            return None
        rows = await self._session.scalars(
            select(BacktestTradeModel)
            .where(BacktestTradeModel.run_id == run_id)
            .order_by(BacktestTradeModel.sequence.asc())
        )
        return tuple(self._trade(item) for item in rows.all())

    async def delete(self, run_id: UUID) -> bool:
        model = await self._session.get(BacktestRunModel, run_id)
        if model is None:
            return False
        await self._session.delete(model)
        try:
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            raise
        return True

    def _result(self, model: BacktestRunModel) -> BacktestResult:
        settings = BacktestSettings(
            initial_capital=Decimal(str(model.settings["initial_capital"])),
            position_size=Decimal(str(model.settings["position_size"])),
            contract_size=Decimal(str(model.settings.get("contract_size", "1"))),
            stop_loss_pct=self._optional_decimal(model.settings.get("stop_loss_pct")),
            take_profit_pct=self._optional_decimal(model.settings.get("take_profit_pct")),
            commission_per_fill=Decimal(str(model.settings["commission_per_fill"])),
            swap_per_lot_per_day=Decimal(
                str(
                    model.settings.get(
                        "swap_per_lot_per_day",
                        model.settings.get("swap_per_day", "0"),
                    )
                )
            ),
            slippage_mode=SlippageMode(str(model.settings["slippage_mode"])),
            slippage_value=Decimal(str(model.settings["slippage_value"])),
        )
        metrics = BacktestMetrics(
            initial_capital=Decimal(str(model.metrics["initial_capital"])),
            final_balance=Decimal(str(model.metrics["final_balance"])),
            final_equity=Decimal(str(model.metrics["final_equity"])),
            total_net_profit=Decimal(str(model.metrics["total_net_profit"])),
            return_pct=Decimal(str(model.metrics["return_pct"])),
            max_drawdown_pct=Decimal(str(model.metrics["max_drawdown_pct"])),
            total_trades=int(str(model.metrics["total_trades"])),
            winning_trades=int(str(model.metrics["winning_trades"])),
            losing_trades=int(str(model.metrics["losing_trades"])),
            win_rate_pct=Decimal(str(model.metrics["win_rate_pct"])),
            profit_factor=self._optional_decimal(model.metrics.get("profit_factor")),
            total_commission=Decimal(str(model.metrics["total_commission"])),
            total_swap=Decimal(str(model.metrics["total_swap"])),
        )
        trades = tuple(self._trade(item) for item in model.trades)
        equity_curve = tuple(
            EquityPoint(
                sequence=item.sequence,
                timestamp=_utc(item.timestamp),
                balance=item.balance,
                equity=item.equity,
                drawdown_pct=item.drawdown_pct,
            )
            for item in model.equity_points
        )
        return BacktestResult(
            symbol_id=model.symbol_id,
            timeframe=model.timeframe,
            requested_start=_utc(model.requested_start),
            requested_end=_utc(model.requested_end),
            data_start=_utc(model.data_start),
            data_end=_utc(model.data_end),
            candle_count=model.candle_count,
            strategy_name=model.strategy_name,
            strategy_version=model.strategy_version,
            parameters=dict(model.parameters),
            settings=settings,
            trades=trades,
            equity_curve=equity_curve,
            metrics=metrics,
        )

    @staticmethod
    def _trade(item: BacktestTradeModel) -> VirtualTrade:
        return VirtualTrade(
            sequence=item.sequence,
            side=PositionSide(item.side),
            volume=item.volume,
            opened_at=_utc(item.opened_at),
            closed_at=_utc(item.closed_at),
            open_price=item.open_price,
            close_price=item.close_price,
            stop_loss=item.stop_loss,
            take_profit=item.take_profit,
            exit_reason=ExitReason(item.exit_reason),
            gross_profit=item.gross_profit,
            commission=item.commission,
            swap=item.swap,
            net_profit=item.net_profit,
        )

    @staticmethod
    def _settings_json(settings: BacktestSettings) -> dict[str, object]:
        return {
            "initial_capital": str(settings.initial_capital),
            "position_size": str(settings.position_size),
            "contract_size": str(settings.contract_size),
            "stop_loss_pct": (
                str(settings.stop_loss_pct) if settings.stop_loss_pct is not None else None
            ),
            "take_profit_pct": (
                str(settings.take_profit_pct) if settings.take_profit_pct is not None else None
            ),
            "commission_per_fill": str(settings.commission_per_fill),
            "swap_per_lot_per_day": str(settings.swap_per_lot_per_day),
            "slippage_mode": settings.slippage_mode.value,
            "slippage_value": str(settings.slippage_value),
        }

    @staticmethod
    def _metrics_json(metrics: BacktestMetrics) -> dict[str, object]:
        return {
            "initial_capital": str(metrics.initial_capital),
            "final_balance": str(metrics.final_balance),
            "final_equity": str(metrics.final_equity),
            "total_net_profit": str(metrics.total_net_profit),
            "return_pct": str(metrics.return_pct),
            "max_drawdown_pct": str(metrics.max_drawdown_pct),
            "total_trades": metrics.total_trades,
            "winning_trades": metrics.winning_trades,
            "losing_trades": metrics.losing_trades,
            "win_rate_pct": str(metrics.win_rate_pct),
            "profit_factor": (
                str(metrics.profit_factor) if metrics.profit_factor is not None else None
            ),
            "total_commission": str(metrics.total_commission),
            "total_swap": str(metrics.total_swap),
        }

    @staticmethod
    def _optional_decimal(value: object) -> Decimal | None:
        return Decimal(str(value)) if value is not None else None
