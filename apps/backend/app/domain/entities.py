from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.domain.enums import (
    CandleSource,
    HistoricalDataRequestState,
    TradeSide,
    TradeStatus,
)


@dataclass(frozen=True, slots=True)
class Symbol:
    id: UUID
    name: str
    description: str
    digits: int
    is_active: bool
    volume_min: Decimal = Decimal("0.01")
    volume_step: Decimal = Decimal("0.01")
    volume_max: Decimal = Decimal("99")
    contract_size: Decimal = Decimal("1")


@dataclass(frozen=True, slots=True)
class Candle:
    id: UUID
    symbol_id: UUID
    timeframe: str
    open_time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal
    source: CandleSource


@dataclass(frozen=True, slots=True)
class MarketQuote:
    symbol_id: UUID
    terminal_id: str
    bid: Decimal
    ask: Decimal
    observed_at: datetime
    received_at: datetime
    source: CandleSource


@dataclass(frozen=True, slots=True)
class HistoricalDataRequest:
    id: UUID
    symbol_id: UUID
    symbol: str
    timeframe: str
    requested_start: datetime
    requested_end: datetime
    status: HistoricalDataRequestState
    requested_at: datetime
    claimed_at: datetime | None
    completed_at: datetime | None
    terminal_id: str | None
    candle_count: int
    error: str | None


@dataclass(frozen=True, slots=True)
class Account:
    id: UUID
    external_id: str
    name: str
    currency: str
    balance: Decimal
    created_at: datetime


@dataclass(frozen=True, slots=True)
class Trade:
    id: UUID
    account_id: UUID
    symbol_id: UUID
    external_id: str
    side: TradeSide
    volume: Decimal
    open_price: Decimal
    close_price: Decimal | None
    opened_at: datetime
    closed_at: datetime | None
    profit: Decimal
    commission: Decimal
    swap: Decimal
    status: TradeStatus
