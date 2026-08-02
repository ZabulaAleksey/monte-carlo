from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.domain.enums import TradeSide, TradeStatus


@dataclass(frozen=True, slots=True)
class Symbol:
    id: UUID
    name: str
    description: str
    digits: int
    is_active: bool


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
