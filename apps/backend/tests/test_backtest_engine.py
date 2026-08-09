from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

import pytest

from app.domain.backtesting.engine import BacktestEngine
from app.domain.backtesting.execution import (
    FixedCommissionModel,
    FixedSlippageModel,
    OrderSimulator,
    PositionManager,
    RelativeSlippageModel,
    RiskManager,
)
from app.domain.backtesting.models import (
    MAX_BACKTEST_CANDLES,
    BacktestSettings,
    ExitReason,
    Signal,
    SlippageMode,
    StrategyContext,
)
from app.domain.entities import Candle
from app.domain.enums import CandleSource
from app.domain.exceptions import DomainError

SYMBOL_ID = UUID("00000000-0000-0000-0000-000000000001")
START = datetime(2026, 1, 1, tzinfo=UTC)


class MemoryHistoricalDataProvider:
    def __init__(self, candles: list[Candle]) -> None:
        self.candles = candles

    async def get_candles(
        self,
        symbol_id: UUID,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> list[Candle]:
        del symbol_id, timeframe, start_at, end_at
        return list(self.candles)


class ScriptedStrategy:
    name = "scripted"
    version = "test-1"

    def __init__(self, signals: dict[int, Signal]) -> None:
        self._signals = signals
        self.contexts: list[StrategyContext] = []

    def validate_parameters(self, parameters: dict[str, object]) -> None:
        del parameters

    def on_candle(self, context: StrategyContext) -> Signal:
        self.contexts.append(context)
        return self._signals.get(len(context.history), Signal.HOLD)


def candle(
    sequence: int,
    *,
    open_price: str,
    high: str | None = None,
    low: str | None = None,
    close: str | None = None,
) -> Candle:
    opening = Decimal(open_price)
    closing = Decimal(close or open_price)
    return Candle(
        UUID(f"00000000-0000-0000-0001-{sequence:012d}"),
        SYMBOL_ID,
        "H1",
        START + timedelta(hours=sequence - 1),
        opening,
        Decimal(high) if high is not None else max(opening, closing),
        Decimal(low) if low is not None else min(opening, closing),
        closing,
        Decimal("100"),
        CandleSource.DEMO,
    )


def settings(
    *,
    commission: str = "0",
    stop_loss_pct: str | None = None,
    take_profit_pct: str | None = None,
    slippage_mode: SlippageMode = SlippageMode.FIXED,
    slippage_value: str = "0",
) -> BacktestSettings:
    return BacktestSettings(
        initial_capital=Decimal("1000"),
        position_size=Decimal("1"),
        stop_loss_pct=Decimal(stop_loss_pct) if stop_loss_pct else None,
        take_profit_pct=Decimal(take_profit_pct) if take_profit_pct else None,
        commission_per_fill=Decimal(commission),
        slippage_mode=slippage_mode,
        slippage_value=Decimal(slippage_value),
    )


async def run_engine(
    candles: list[Candle],
    strategy: ScriptedStrategy,
    configuration: BacktestSettings,
):
    slippage = (
        FixedSlippageModel(configuration.slippage_value)
        if configuration.slippage_mode == SlippageMode.FIXED
        else RelativeSlippageModel(configuration.slippage_value)
    )
    engine = BacktestEngine(
        MemoryHistoricalDataProvider(candles),
        PositionManager(),
        RiskManager(configuration.stop_loss_pct, configuration.take_profit_pct),
        OrderSimulator(
            FixedCommissionModel(configuration.commission_per_fill),
            slippage,
            configuration.swap_per_day,
        ),
    )
    return await engine.run(
        symbol_id=SYMBOL_ID,
        timeframe="H1",
        start_at=candles[0].open_time,
        end_at=candles[-1].open_time,
        strategy=strategy,
        parameters={},
        settings=configuration,
    )


@pytest.mark.asyncio
async def test_strategy_never_receives_future_candles() -> None:
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="101"),
        candle(3, open_price="102"),
        candle(4, open_price="999"),
    ]
    strategy = ScriptedStrategy({1: Signal.BUY})
    engine = BacktestEngine(
        MemoryHistoricalDataProvider(candles),
        PositionManager(),
        RiskManager(None, None),
        OrderSimulator(
            FixedCommissionModel(Decimal("0")),
            FixedSlippageModel(Decimal("0")),
            Decimal("0"),
        ),
    )
    result = await engine.run(
        symbol_id=SYMBOL_ID,
        timeframe="H1",
        start_at=candles[0].open_time,
        end_at=candles[2].open_time,
        strategy=strategy,
        parameters={},
        settings=settings(),
    )

    assert result.candle_count == 3
    assert [len(context.history) for context in strategy.contexts] == [1, 2, 3]
    assert all(
        all(item.open_time <= context.current_candle.open_time for item in context.history)
        for context in strategy.contexts
    )
    assert result.trades[0].opened_at == candles[1].open_time


@pytest.mark.asyncio
async def test_position_opens_and_closes_on_next_candle_open() -> None:
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="101"),
        candle(3, open_price="105"),
    ]
    result = await run_engine(
        candles,
        ScriptedStrategy({1: Signal.BUY, 2: Signal.CLOSE}),
        settings(),
    )

    assert len(result.trades) == 1
    trade = result.trades[0]
    assert trade.open_price == Decimal("101")
    assert trade.close_price == Decimal("105")
    assert trade.exit_reason == ExitReason.SIGNAL
    assert trade.net_profit == Decimal("4")
    assert result.metrics.final_balance == Decimal("1004")


@pytest.mark.asyncio
async def test_commission_is_charged_on_entry_and_exit() -> None:
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="101"),
        candle(3, open_price="105"),
    ]
    result = await run_engine(
        candles,
        ScriptedStrategy({1: Signal.BUY, 2: Signal.CLOSE}),
        settings(commission="2"),
    )

    assert result.trades[0].commission == Decimal("4")
    assert result.trades[0].net_profit == Decimal("0")
    assert result.metrics.final_balance == Decimal("1000")
    assert result.metrics.total_commission == Decimal("4")


@pytest.mark.asyncio
async def test_stop_loss_closes_position_with_stop_first_policy() -> None:
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="100", high="103", low="98", close="101"),
    ]
    result = await run_engine(
        candles,
        ScriptedStrategy({1: Signal.BUY}),
        settings(stop_loss_pct="1", take_profit_pct="2"),
    )

    trade = result.trades[0]
    assert trade.exit_reason == ExitReason.STOP_LOSS
    assert trade.close_price == Decimal("99")
    assert trade.net_profit == Decimal("-1")
    assert trade.closed_at == candles[1].open_time + timedelta(hours=1)


@pytest.mark.asyncio
async def test_take_profit_closes_position() -> None:
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="100", high="103", low="99.5", close="101"),
    ]
    result = await run_engine(
        candles,
        ScriptedStrategy({1: Signal.BUY}),
        settings(take_profit_pct="2"),
    )

    trade = result.trades[0]
    assert trade.exit_reason == ExitReason.TAKE_PROFIT
    assert trade.close_price == Decimal("102")
    assert trade.net_profit == Decimal("2")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("mode", "value", "expected_open", "expected_close", "expected_profit"),
    [
        (SlippageMode.FIXED, "0.5", "101.5", "104.5", "3.0"),
        (SlippageMode.RELATIVE, "100", "102.01", "103.95", "1.94"),
    ],
)
async def test_fixed_and_relative_slippage(
    mode: SlippageMode,
    value: str,
    expected_open: str,
    expected_close: str,
    expected_profit: str,
) -> None:
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="101"),
        candle(3, open_price="105"),
    ]
    result = await run_engine(
        candles,
        ScriptedStrategy({1: Signal.BUY, 2: Signal.CLOSE}),
        settings(slippage_mode=mode, slippage_value=value),
    )

    trade = result.trades[0]
    assert trade.open_price == Decimal(expected_open)
    assert trade.close_price == Decimal(expected_close)
    assert trade.net_profit == Decimal(expected_profit)


@pytest.mark.asyncio
async def test_remaining_position_is_closed_and_result_is_reproducible() -> None:
    candles = [
        candle(1, open_price="100", close="101"),
        candle(2, open_price="102", close="104"),
        candle(3, open_price="105", close="106"),
    ]
    configuration = settings(commission="0.25", slippage_value="0.1")
    first = await run_engine(candles, ScriptedStrategy({1: Signal.BUY}), configuration)
    second = await run_engine(candles, ScriptedStrategy({1: Signal.BUY}), configuration)

    assert first.trades[-1].exit_reason == ExitReason.END_OF_DATA
    assert first.trades[-1].closed_at == candles[-1].open_time + timedelta(hours=1)
    assert first.equity_curve[-1].timestamp == candles[-1].open_time + timedelta(hours=1)
    assert first.trades == second.trades
    assert first.equity_curve == second.equity_curve
    assert first.metrics == second.metrics


@pytest.mark.asyncio
async def test_backtest_rejects_more_than_the_candle_limit() -> None:
    candles = [
        candle(index, open_price="100")
        for index in range(1, MAX_BACKTEST_CANDLES + 2)
    ]

    with pytest.raises(DomainError, match="candle limit"):
        await run_engine(candles, ScriptedStrategy({}), settings())
