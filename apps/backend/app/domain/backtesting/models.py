from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from app.domain.entities import Candle

MAX_BACKTEST_CANDLES = 2000


class Signal(StrEnum):
    BUY = "buy"
    SELL = "sell"
    CLOSE = "close"
    HOLD = "hold"


class PositionSide(StrEnum):
    BUY = "buy"
    SELL = "sell"


class ExitReason(StrEnum):
    SIGNAL = "signal"
    REVERSE = "reverse"
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    END_OF_DATA = "end_of_data"


class SlippageMode(StrEnum):
    FIXED = "fixed"
    RELATIVE = "relative"


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
    stop_loss_pct: Decimal | None = None
    take_profit_pct: Decimal | None = None
    commission_per_fill: Decimal = Decimal("0")
    swap_per_day: Decimal = Decimal("0")
    slippage_mode: SlippageMode = SlippageMode.FIXED
    slippage_value: Decimal = Decimal("0")


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
    history: tuple[Candle, ...]
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
    drawdown_pct: Decimal


@dataclass(frozen=True, slots=True)
class BacktestMetrics:
    initial_capital: Decimal
    final_balance: Decimal
    final_equity: Decimal
    total_net_profit: Decimal
    return_pct: Decimal
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
