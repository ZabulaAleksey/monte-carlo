from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import overload
from uuid import UUID

from app.domain.entities import Candle

MAX_BACKTEST_CANDLES = 20_000


class CandleHistory(Sequence[Candle]):
    """Read-only prefix of one shared candle tuple.

    A new lightweight view is created for every strategy call. The view keeps
    future candles inaccessible without copying the complete history.
    """

    __slots__ = ("__candles", "__end")

    def __init__(self, candles: tuple[Candle, ...], end: int) -> None:
        self.__candles = candles
        self.__end = min(max(end, 0), len(candles))

    def __len__(self) -> int:
        return self.__end

    @overload
    def __getitem__(self, index: int) -> Candle: ...

    @overload
    def __getitem__(self, index: slice) -> tuple[Candle, ...]: ...

    def __getitem__(self, index: int | slice) -> Candle | tuple[Candle, ...]:
        if isinstance(index, slice):
            start, stop, step = index.indices(self.__end)
            return tuple(self.__candles[position] for position in range(start, stop, step))
        position = index if index >= 0 else self.__end + index
        if position < 0 or position >= self.__end:
            raise IndexError("candle history index out of range")
        return self.__candles[position]

    def __iter__(self) -> Iterator[Candle]:
        for index in range(self.__end):
            yield self.__candles[index]


class Signal(StrEnum):
    BUY = "buy"
    SELL = "sell"
    CLOSE = "close"
    HOLD = "hold"


class PositionSide(StrEnum):
    BUY = "buy"
    SELL = "sell"


class ExitReason(StrEnum):
    BANKRUPTCY = "bankruptcy"
    SIGNAL = "signal"
    REVERSE = "reverse"
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    END_OF_DATA = "end_of_data"


class BacktestJobState(StrEnum):
    QUEUED = "queued"
    LOADING_DATA = "loading_data"
    SIMULATING = "simulating"
    PAUSED = "paused"
    COMPLETED = "completed"
    STOPPED = "stopped"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class BacktestSettings:
    initial_capital: Decimal
    position_size: Decimal
    contract_size: Decimal = Decimal("1")
    stop_loss_pct: Decimal | None = None
    take_profit_pct: Decimal | None = None
    price_digits: int = 5
    commission_pct_per_fill: Decimal = Decimal("0")
    swap_pct_per_lot_per_day: Decimal = Decimal("0")
    slippage_points: Decimal = Decimal("0")


@dataclass(frozen=True, slots=True)
class HistoricalDataInterval:
    start_at: datetime
    end_at: datetime


@dataclass(frozen=True, slots=True)
class HistoricalDataCoverage:
    symbol_id: UUID
    timeframe: str
    requested_start: datetime
    requested_end: datetime
    candle_count: int
    complete: bool
    cached_intervals: tuple[HistoricalDataInterval, ...]
    missing_intervals: tuple[HistoricalDataInterval, ...]


@dataclass(frozen=True, slots=True)
class OpenPosition:
    position_id: int
    side: PositionSide
    quantity: Decimal
    opened_at: datetime
    open_price: Decimal
    stop_loss: Decimal | None
    take_profit: Decimal | None
    entry_commission: Decimal


@dataclass(frozen=True, slots=True)
class StrategyContext:
    current_candle: Candle
    history: Sequence[Candle]
    balance: Decimal
    equity: Decimal
    open_positions: tuple[OpenPosition, ...]
    parameters: Mapping[str, object]


@dataclass(frozen=True, slots=True)
class VirtualTrade:
    sequence: int
    side: PositionSide
    volume: Decimal
    opened_at: datetime
    closed_at: datetime
    open_price: Decimal
    close_price: Decimal
    stop_loss: Decimal | None
    take_profit: Decimal | None
    exit_reason: ExitReason
    gross_profit: Decimal
    commission: Decimal
    swap: Decimal
    net_profit: Decimal


@dataclass(frozen=True, slots=True)
class EquityPoint:
    sequence: int
    timestamp: datetime
    balance: Decimal
    equity: Decimal
    drawdown_absolute: Decimal
    drawdown_pct: Decimal


@dataclass(frozen=True, slots=True)
class BacktestMetrics:
    initial_capital: Decimal
    final_balance: Decimal
    final_equity: Decimal
    total_net_profit: Decimal
    return_pct: Decimal
    max_drawdown_absolute: Decimal
    max_drawdown_pct: Decimal
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate_pct: Decimal
    profit_factor: Decimal | None
    total_commission: Decimal
    total_swap: Decimal


@dataclass(frozen=True, slots=True)
class BacktestResult:
    symbol_id: UUID
    timeframe: str
    requested_start: datetime
    requested_end: datetime
    data_start: datetime
    data_end: datetime
    candle_count: int
    strategy_name: str
    strategy_version: str
    parameters: Mapping[str, object]
    settings: BacktestSettings
    trades: tuple[VirtualTrade, ...]
    equity_curve: tuple[EquityPoint, ...]
    metrics: BacktestMetrics
    data_complete: bool = True
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class StoredBacktestResult:
    id: UUID
    created_at: datetime
    result: BacktestResult


@dataclass(frozen=True, slots=True)
class BacktestRunSummary:
    id: UUID
    created_at: datetime
    symbol_id: UUID
    timeframe: str
    strategy_name: str
    strategy_version: str
    data_start: datetime
    data_end: datetime
    total_trades: int
    final_balance: Decimal
    return_pct: Decimal


@dataclass(frozen=True, slots=True)
class StrategyParameterDefinition:
    name: str
    label: str
    value_type: str
    default: object
    minimum: int | Decimal | None = None
    maximum: int | Decimal | None = None


@dataclass(frozen=True, slots=True)
class StrategyDefinition:
    name: str
    version: str
    title: str
    description: str
    parameters: tuple[StrategyParameterDefinition, ...]


@dataclass(frozen=True, slots=True)
class BacktestJobSnapshot:
    id: UUID
    state: BacktestJobState
    stage: str
    progress_pct: Decimal
    processed_candles: int
    total_candles: int
    result_id: UUID | None = None
    error: str | None = None
