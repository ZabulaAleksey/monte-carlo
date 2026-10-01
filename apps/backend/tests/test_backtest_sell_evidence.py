"""Independent hand-calculated SELL oracles for MC-REM-BT-02; no MT5 claim."""

from datetime import timedelta
from decimal import Decimal

import pytest
from test_backtest_engine import ScriptedStrategy, candle, run_engine, settings

from app.domain.backtesting.models import ExitReason, PositionSide, Signal


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("exit_price", "profit", "balance"), [("90", "200", "1200"), ("110", "-200", "800")]
)
async def test_short_next_open_profit_and_loss_have_correct_sign(exit_price, profit, balance):
    candles = [
        candle(1, open_price="999"),
        candle(2, open_price="100"),
        candle(3, open_price=exit_price),
    ]
    strategy = ScriptedStrategy({1: Signal.SELL, 2: Signal.CLOSE})
    result = await run_engine(candles, strategy, settings(position_size="2", contract_size="10"))
    trade = result.trades[0]
    # (100-exit)*2 lots*10 units, with zero costs. Never fill at signal candle999.
    assert len(result.trades) == 1
    assert trade.side is PositionSide.SELL
    assert trade.open_price == Decimal("100")
    assert trade.close_price == Decimal(exit_price)
    assert trade.opened_at == candles[1].open_time
    assert trade.closed_at == candles[2].open_time
    assert trade.exit_reason is ExitReason.SIGNAL
    assert trade.gross_profit == Decimal(profit)
    assert trade.net_profit == Decimal(profit)
    assert result.metrics.final_balance == Decimal(balance)
    assert [len(context.history) for context in strategy.contexts] == [1, 2, 3]


@pytest.mark.asyncio
async def test_short_slippage_and_two_fill_commission_are_hand_calculated():
    candles = [candle(1, open_price="100"), candle(2, open_price="100"), candle(3, open_price="90")]
    result = await run_engine(
        candles,
        ScriptedStrategy({1: Signal.SELL, 2: Signal.CLOSE}),
        settings(commission_pct="1", slippage_points="50"),
    )
    trade = result.trades[0]
    # 50 quote points at2digits=.50; entry99.50, exit90.50, gross9.
    # Fees=(99.50+90.50)*.01=1.90; net7.10, final1007.10.
    assert trade.open_price == Decimal("99.5")
    assert trade.close_price == Decimal("90.5")
    assert trade.gross_profit == Decimal("9")
    assert trade.commission == Decimal("1.9")
    assert trade.net_profit == Decimal("7.1")
    assert result.metrics.total_commission == Decimal("1.9")
    assert result.metrics.final_balance == Decimal("1007.1")


@pytest.mark.asyncio
async def test_sell_to_buy_reversal_closes_short_and_opens_long_on_next_open():
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="100"),
        candle(3, open_price="90"),
        candle(4, open_price="95"),
    ]
    result = await run_engine(
        candles, ScriptedStrategy({1: Signal.SELL, 2: Signal.BUY, 3: Signal.CLOSE}), settings()
    )
    short, long = result.trades
    assert short.side is PositionSide.SELL and long.side is PositionSide.BUY
    assert short.exit_reason is ExitReason.REVERSE and long.exit_reason is ExitReason.SIGNAL
    assert short.closed_at == long.opened_at == candles[2].open_time
    assert short.close_price == long.open_price == Decimal("90")
    assert short.net_profit == Decimal("10")  # 100-90
    assert long.net_profit == Decimal("5")  # 95-90
    assert result.metrics.final_balance == Decimal("1015")


@pytest.mark.asyncio
async def test_short_sl_is_above_entry_and_wins_ambiguous_ohlc_candle():
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="100", high="103", low="97", close="100"),
    ]
    result = await run_engine(
        candles,
        ScriptedStrategy({1: Signal.SELL}),
        settings(stop_loss_pct="1", take_profit_pct="2"),
    )
    trade = result.trades[0]
    assert trade.stop_loss == Decimal("101") and trade.take_profit == Decimal("98")
    assert trade.exit_reason is ExitReason.STOP_LOSS
    assert trade.close_price == Decimal("101")
    assert trade.net_profit == Decimal("-1")
    assert trade.closed_at == candles[1].open_time + timedelta(hours=1)
    assert result.metrics.final_balance == Decimal("999")


@pytest.mark.asyncio
async def test_short_tp_below_entry_pays_positive_profit():
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="100", high="100", low="97", close="99"),
    ]
    result = await run_engine(
        candles, ScriptedStrategy({1: Signal.SELL}), settings(take_profit_pct="2")
    )
    trade = result.trades[0]
    assert trade.take_profit == Decimal("98")
    assert trade.exit_reason is ExitReason.TAKE_PROFIT
    assert trade.close_price == Decimal("98")
    assert trade.net_profit == Decimal("2")
    assert result.metrics.final_balance == Decimal("1002")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("gap_open", "reason", "profit"),
    [("105", ExitReason.STOP_LOSS, "-5"), ("95", ExitReason.TAKE_PROFIT, "5")],
)
async def test_short_protective_exit_uses_real_gap_open(gap_open, reason, profit):
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="100"),
        candle(3, open_price=gap_open),
    ]
    result = await run_engine(
        candles,
        ScriptedStrategy({1: Signal.SELL}),
        settings(stop_loss_pct="1", take_profit_pct="2"),
    )
    trade = result.trades[0]
    assert trade.exit_reason is reason
    assert trade.close_price == Decimal(gap_open)
    assert trade.net_profit == Decimal(profit)


@pytest.mark.asyncio
async def test_short_unrealized_loss_drawdown_and_end_of_data_recovery():
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="100", high="111", close="110"),
        candle(3, open_price="90"),
    ]
    first = await run_engine(candles, ScriptedStrategy({1: Signal.SELL}), settings())
    second = await run_engine(candles, ScriptedStrategy({1: Signal.SELL}), settings())
    point = first.equity_curve[1]
    assert point.balance == Decimal("1000") and point.equity == Decimal("990")
    assert point.drawdown_absolute == Decimal("10") and point.drawdown_pct == Decimal("1")
    assert first.metrics.max_drawdown_absolute == Decimal("10")
    assert first.trades[0].exit_reason is ExitReason.END_OF_DATA
    assert first.trades[0].closed_at == candles[-1].open_time + timedelta(hours=1)
    assert first.trades[0].net_profit == Decimal("10")
    assert first.metrics.final_balance == Decimal("1010")
    assert first.equity_curve[-1].drawdown_absolute == Decimal("0")
    assert first.trades == second.trades and first.equity_curve == second.equity_curve
    assert first.metrics == second.metrics


@pytest.mark.asyncio
async def test_repeated_sell_signal_preserves_one_position_and_one_fee_pair():
    candles = [
        candle(1, open_price="100"),
        candle(2, open_price="100"),
        candle(3, open_price="90"),
        candle(4, open_price="80"),
    ]
    result = await run_engine(
        candles,
        ScriptedStrategy({1: Signal.SELL, 2: Signal.SELL, 3: Signal.CLOSE}),
        settings(commission_pct="1"),
    )
    assert len(result.trades) == 1
    trade = result.trades[0]
    assert trade.open_price == Decimal("100") and trade.close_price == Decimal("80")
    assert trade.commission == Decimal("1.8")  # Oneentry100 andoneexit80,1%each.
    assert trade.net_profit == Decimal("18.2")
    assert result.metrics.final_balance == Decimal("1018.2")
