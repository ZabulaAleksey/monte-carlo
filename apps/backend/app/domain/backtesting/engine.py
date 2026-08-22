from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta
from decimal import Decimal
from types import MappingProxyType
from uuid import UUID

from app.domain.backtesting.drawdown import (
    unrealized_drawdown_absolute,
    unrealized_drawdown_pct,
)
from app.domain.backtesting.execution import (
    OrderSimulator,
    PositionManager,
    RiskManager,
    quantize_decimal,
)
from app.domain.backtesting.interfaces import BacktestControl, HistoricalDataProvider, Strategy
from app.domain.backtesting.models import (
    MAX_BACKTEST_CANDLES,
    BacktestMetrics,
    BacktestResult,
    BacktestSettings,
    CandleHistory,
    EquityPoint,
    ExitReason,
    PositionSide,
    Signal,
    StrategyContext,
    VirtualTrade,
)
from app.domain.exceptions import DomainError

HUNDRED = Decimal("100")


class BacktestEngine:
    def __init__(
        self,
        data_provider: HistoricalDataProvider,
        position_manager: PositionManager,
        risk_manager: RiskManager,
        order_simulator: OrderSimulator,
    ) -> None:
        self._data_provider = data_provider
        self._positions = position_manager
        self._risk = risk_manager
        self._orders = order_simulator

    async def run(
        self,
        *,
        symbol_id: UUID,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
        strategy: Strategy,
        parameters: dict[str, object],
        settings: BacktestSettings,
        control: BacktestControl | None = None,
    ) -> BacktestResult:
        self._validate_request(start_at, end_at, settings)
        strategy.validate_parameters(parameters)
        normalized_timeframe = timeframe.strip().upper()
        candle_duration = self._timeframe_duration(normalized_timeframe)
        settings = replace(
            settings,
            initial_capital=quantize_decimal(settings.initial_capital),
            position_size=quantize_decimal(settings.position_size),
            contract_size=quantize_decimal(settings.contract_size),
            commission_pct_per_fill=quantize_decimal(
                settings.commission_pct_per_fill
            ),
            swap_pct_per_lot_per_day=quantize_decimal(
                settings.swap_pct_per_lot_per_day
            ),
            slippage_points=quantize_decimal(settings.slippage_points),
        )
        if control is not None:
            await control.checkpoint("loading_data")
        coverage = await self._data_provider.get_coverage(
            symbol_id, normalized_timeframe, start_at, end_at
        )
        if not coverage.complete:
            missing = ", ".join(
                f"{item.start_at.isoformat()}..{item.end_at.isoformat()}"
                for item in coverage.missing_intervals
            )
            raise DomainError(
                "Historical data cache is incomplete for the requested range"
                + (f": {missing}" if missing else "")
            )
        supplied = await self._data_provider.get_candles(
            symbol_id, normalized_timeframe, start_at, end_at
        )
        candles = tuple(
            sorted(
                (
                    candle
                    for candle in supplied
                    if candle.symbol_id == symbol_id
                    and candle.timeframe.upper() == normalized_timeframe
                    and start_at <= candle.open_time <= end_at
                ),
                key=lambda candle: candle.open_time,
            )
        )
        if not candles:
            raise DomainError("No historical candles found for the requested range")
        if len(candles) > MAX_BACKTEST_CANDLES:
            raise DomainError(
                f"Backtest range exceeds the {MAX_BACKTEST_CANDLES}-candle limit"
            )
        if len({candle.open_time for candle in candles}) != len(candles):
            raise DomainError("Historical data contains duplicate candle timestamps")
        if control is not None:
            await control.checkpoint("simulating", 0, len(candles))

        immutable_parameters = MappingProxyType(dict(parameters))
        trades: list[VirtualTrade] = []
        equity_curve: list[EquityPoint] = []
        balance = settings.initial_capital
        pending_signal = Signal.HOLD
        processed_candles = 0
        account_depleted = False

        for candle_index, candle in enumerate(candles, start=1):
            processed_candles = candle_index
            candle_close_time = candle.open_time + candle_duration
            balance = self._execute_pending_signal(
                pending_signal,
                candle.open_time,
                candle.open,
                settings,
                balance,
                trades,
            )

            position = self._positions.current
            if position is not None:
                triggered = self._risk.exit_for_candle(position, candle)
                if triggered is not None:
                    reason, market_price = triggered
                    balance = self._close_position(
                        candle_close_time, market_price, reason, balance, trades
                    )

            position = self._positions.current
            equity = balance
            if position is not None:
                equity += self._orders.unrealized_profit(position, candle.close)
                equity += self._orders.accrued_swap(position, candle_close_time)
            equity = quantize_decimal(equity)

            if equity <= 0:
                if self._positions.current is not None:
                    balance = self._close_position(
                        candle_close_time,
                        candle.close,
                        ExitReason.BANKRUPTCY,
                        balance,
                        trades,
                    )
                equity = balance
                equity_curve.append(
                    EquityPoint(
                        sequence=len(equity_curve) + 1,
                        timestamp=candle_close_time,
                        balance=balance,
                        equity=equity,
                        drawdown_absolute=unrealized_drawdown_absolute(balance, equity),
                        drawdown_pct=unrealized_drawdown_pct(balance, equity),
                    )
                )
                if control is not None:
                    await control.checkpoint(
                        "simulating", candle_index, len(candles)
                    )
                account_depleted = True
                break

            context = StrategyContext(
                current_candle=candle,
                history=CandleHistory(candles, candle_index),
                balance=balance,
                equity=equity,
                open_positions=self._positions.positions,
                parameters=immutable_parameters,
            )
            pending_signal = strategy.on_candle(context)
            if not isinstance(pending_signal, Signal):
                raise DomainError("Strategy returned an invalid signal")

            equity_curve.append(
                EquityPoint(
                    sequence=len(equity_curve) + 1,
                    timestamp=candle_close_time,
                    balance=balance,
                    equity=equity,
                    drawdown_absolute=unrealized_drawdown_absolute(balance, equity),
                    drawdown_pct=unrealized_drawdown_pct(balance, equity),
                )
            )
            if control is not None:
                await control.checkpoint("simulating", candle_index, len(candles))

        last_candle = candles[processed_candles - 1]
        if not account_depleted and self._positions.current is not None:
            balance = self._close_position(
                last_candle.open_time + candle_duration,
                last_candle.close,
                ExitReason.END_OF_DATA,
                balance,
                trades,
            )
            equity_curve[-1] = replace(
                equity_curve[-1],
                balance=balance,
                equity=balance,
                drawdown_absolute=unrealized_drawdown_absolute(balance, balance),
                drawdown_pct=unrealized_drawdown_pct(balance, balance),
            )

        metrics = self._metrics(settings.initial_capital, balance, trades, equity_curve)
        return BacktestResult(
            symbol_id=symbol_id,
            timeframe=normalized_timeframe,
            requested_start=start_at,
            requested_end=end_at,
            data_start=candles[0].open_time,
            data_end=last_candle.open_time,
            candle_count=processed_candles,
            strategy_name=strategy.name,
            strategy_version=strategy.version,
            parameters=immutable_parameters,
            settings=settings,
            trades=tuple(trades),
            equity_curve=tuple(equity_curve),
            metrics=metrics,
        )

    @staticmethod
    def _validate_request(
        start_at: datetime, end_at: datetime, settings: BacktestSettings
    ) -> None:
        if start_at >= end_at:
            raise DomainError("Backtest start must be before end")
        if settings.initial_capital <= 0:
            raise DomainError("Initial capital must be greater than zero")
        if settings.position_size <= 0:
            raise DomainError("Position size must be greater than zero")
        if settings.contract_size <= 0:
            raise DomainError("Contract size must be greater than zero")
        if settings.price_digits < 0:
            raise DomainError("Price digits cannot be negative")

    @staticmethod
    def _timeframe_duration(timeframe: str) -> timedelta:
        if len(timeframe) < 2 or timeframe.startswith("MN"):
            raise DomainError(f"Unsupported backtest timeframe: {timeframe}")
        try:
            amount = int(timeframe[1:])
        except ValueError as exc:
            raise DomainError(f"Unsupported backtest timeframe: {timeframe}") from exc
        if amount <= 0:
            raise DomainError(f"Unsupported backtest timeframe: {timeframe}")
        units = {
            "M": timedelta(minutes=amount),
            "H": timedelta(hours=amount),
            "D": timedelta(days=amount),
            "W": timedelta(weeks=amount),
        }
        duration = units.get(timeframe[0])
        if duration is None:
            raise DomainError(f"Unsupported backtest timeframe: {timeframe}")
        return duration

    def _execute_pending_signal(
        self,
        signal: Signal,
        timestamp: datetime,
        market_price: Decimal,
        settings: BacktestSettings,
        balance: Decimal,
        trades: list[VirtualTrade],
    ) -> Decimal:
        position = self._positions.current
        if signal == Signal.HOLD:
            return balance
        if signal == Signal.CLOSE:
            if position is not None:
                return self._close_position(
                    timestamp, market_price, ExitReason.SIGNAL, balance, trades
                )
            return balance

        requested_side = PositionSide.BUY if signal == Signal.BUY else PositionSide.SELL
        if position is not None and position.side == requested_side:
            return balance
        if position is not None:
            balance = self._close_position(
                timestamp, market_price, ExitReason.REVERSE, balance, trades
            )

        opened = self._orders.open_position(
            self._positions,
            self._risk,
            requested_side,
            settings.position_size,
            timestamp,
            market_price,
        )
        return quantize_decimal(balance - opened.entry_commission)

    def _close_position(
        self,
        timestamp: datetime,
        market_price: Decimal,
        reason: ExitReason,
        balance: Decimal,
        trades: list[VirtualTrade],
    ) -> Decimal:
        position = self._positions.current
        if position is None:
            raise DomainError("No position is open")
        entry_commission = position.entry_commission
        trade = self._orders.close_position(
            self._positions,
            len(trades) + 1,
            timestamp,
            market_price,
            reason,
        )
        trades.append(trade)
        exit_commission = trade.commission - entry_commission
        return quantize_decimal(
            balance + trade.gross_profit + trade.swap - exit_commission
        )

    @staticmethod
    def _metrics(
        initial_capital: Decimal,
        final_balance: Decimal,
        trades: list[VirtualTrade],
        equity_curve: list[EquityPoint],
    ) -> BacktestMetrics:
        winning = [trade.net_profit for trade in trades if trade.net_profit > 0]
        losing = [trade.net_profit for trade in trades if trade.net_profit < 0]
        total_trades = len(trades)
        gross_wins = sum(winning, Decimal("0"))
        gross_losses = abs(sum(losing, Decimal("0")))
        profit_factor = gross_wins / gross_losses if gross_losses > 0 else None
        return BacktestMetrics(
            initial_capital=initial_capital,
            final_balance=final_balance,
            final_equity=final_balance,
            total_net_profit=quantize_decimal(final_balance - initial_capital),
            return_pct=quantize_decimal(
                (final_balance - initial_capital) / initial_capital * HUNDRED
            ),
            max_drawdown_absolute=max(
                (point.drawdown_absolute for point in equity_curve),
                default=Decimal("0"),
            ),
            max_drawdown_pct=max(
                (point.drawdown_pct for point in equity_curve), default=Decimal("0")
            ),
            total_trades=total_trades,
            winning_trades=len(winning),
            losing_trades=len(losing),
            win_rate_pct=quantize_decimal(
                Decimal(len(winning)) / Decimal(total_trades) * HUNDRED
                if total_trades
                else Decimal("0")
            ),
            profit_factor=(
                quantize_decimal(profit_factor) if profit_factor is not None else None
            ),
            total_commission=quantize_decimal(
                sum((trade.commission for trade in trades), Decimal("0"))
            ),
            total_swap=quantize_decimal(
                sum((trade.swap for trade in trades), Decimal("0"))
            ),
        )
