from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.domain.enums import TradeSide, TradeStatus

MAX_CLOCK_SKEW = timedelta(minutes=5)


def _validate_timestamp(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timestamp must include a timezone")
    normalized = value.astimezone(UTC)
    if normalized > datetime.now(UTC) + MAX_CLOCK_SKEW:
        raise ValueError("Timestamp is too far in the future")
    return normalized


class Mt5RequestBase(BaseModel):
    terminal_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")
    sent_at: datetime

    @field_validator("sent_at")
    @classmethod
    def validate_sent_at(cls, value: datetime) -> datetime:
        return _validate_timestamp(value)


class Mt5HeartbeatRequest(Mt5RequestBase):
    terminal_name: str = Field(min_length=1, max_length=128)
    terminal_build: int = Field(ge=1)
    account_external_id: str | None = Field(default=None, max_length=64)


class Mt5AccountRequest(Mt5RequestBase):
    external_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    currency: str = Field(min_length=3, max_length=8)
    balance: Decimal = Field(ge=0)
    equity: Decimal = Field(ge=0)
    margin: Decimal = Field(ge=0)
    free_margin: Decimal
    leverage: int = Field(ge=1, le=10000)
    company: str = Field(default="", max_length=128)
    server: str = Field(default="", max_length=128)


class Mt5SymbolItem(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    description: str = Field(default="", max_length=255)
    digits: int = Field(ge=0, le=12)
    is_active: bool = True
    volume_min: Decimal = Field(default=Decimal("0.01"), gt=0, le=99)
    volume_step: Decimal = Field(default=Decimal("0.01"), gt=0, le=99)
    volume_max: Decimal = Field(default=Decimal("99"), gt=0)
    contract_size: Decimal = Field(default=Decimal("1"), gt=0)

    @model_validator(mode="after")
    def validate_volume_range(self) -> Mt5SymbolItem:
        if self.volume_min > min(self.volume_max, Decimal("99")):
            raise ValueError("volume_min must not exceed the platform volume maximum")
        return self


class Mt5SymbolsRequest(Mt5RequestBase):
    symbols: list[Mt5SymbolItem] = Field(min_length=1, max_length=2000)


class Mt5CandleItem(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    timeframe: str = Field(min_length=1, max_length=16)
    open_time: datetime
    open: Decimal = Field(gt=0)
    high: Decimal = Field(gt=0)
    low: Decimal = Field(gt=0)
    close: Decimal = Field(gt=0)
    volume: Decimal = Field(ge=0)

    @field_validator("open_time")
    @classmethod
    def validate_open_time(cls, value: datetime) -> datetime:
        return _validate_timestamp(value)

    @model_validator(mode="after")
    def validate_ohlc(self) -> Mt5CandleItem:
        if self.low > self.high:
            raise ValueError("Candle low cannot exceed high")
        if self.high < max(self.open, self.close):
            raise ValueError("Candle high is below open or close")
        if self.low > min(self.open, self.close):
            raise ValueError("Candle low is above open or close")
        return self


class Mt5CandlesRequest(Mt5RequestBase):
    candles: list[Mt5CandleItem] = Field(min_length=1, max_length=1000)


class Mt5CandleCoverageRequest(Mt5RequestBase):
    symbol: str = Field(min_length=1, max_length=32)
    timeframe: str = Field(min_length=1, max_length=16)
    covered_start: datetime
    covered_end: datetime
    expected_candles: int = Field(ge=1)

    @field_validator("covered_start", "covered_end")
    @classmethod
    def validate_coverage_times(cls, value: datetime) -> datetime:
        return _validate_timestamp(value)

    @model_validator(mode="after")
    def validate_coverage_range(self) -> Mt5CandleCoverageRequest:
        if self.covered_start > self.covered_end:
            raise ValueError("covered_start cannot exceed covered_end")
        return self


class Mt5QuoteItem(BaseModel):
    symbol: str = Field(min_length=1, max_length=32)
    bid: Decimal = Field(gt=0)
    ask: Decimal = Field(gt=0)
    observed_at: datetime

    @field_validator("observed_at")
    @classmethod
    def validate_observed_at(cls, value: datetime) -> datetime:
        return _validate_timestamp(value)

    @model_validator(mode="after")
    def validate_spread(self) -> Mt5QuoteItem:
        if self.ask < self.bid:
            raise ValueError("Quote ask cannot be below bid")
        return self


class Mt5QuotesRequest(Mt5RequestBase):
    quotes: list[Mt5QuoteItem] = Field(min_length=1, max_length=2000)


class Mt5PositionItem(BaseModel):
    external_id: str = Field(min_length=1, max_length=64)
    symbol: str = Field(min_length=1, max_length=32)
    side: TradeSide
    volume: Decimal = Field(gt=0)
    open_price: Decimal = Field(gt=0)
    current_price: Decimal = Field(gt=0)
    stop_loss: Decimal | None = Field(default=None, gt=0)
    take_profit: Decimal | None = Field(default=None, gt=0)
    profit: Decimal = Decimal("0")
    swap: Decimal = Decimal("0")
    opened_at: datetime
    observed_at: datetime

    @field_validator("opened_at", "observed_at")
    @classmethod
    def validate_times(cls, value: datetime) -> datetime:
        return _validate_timestamp(value)

    @model_validator(mode="after")
    def validate_time_order(self) -> Mt5PositionItem:
        if self.opened_at > self.observed_at:
            raise ValueError("Position opened_at cannot exceed observed_at")
        return self


class Mt5PositionsRequest(Mt5RequestBase):
    account_external_id: str = Field(min_length=1, max_length=64)
    positions: list[Mt5PositionItem] = Field(max_length=1000)


class Mt5TradeItem(BaseModel):
    external_id: str = Field(min_length=1, max_length=64)
    symbol: str = Field(min_length=1, max_length=32)
    side: TradeSide
    volume: Decimal = Field(gt=0)
    open_price: Decimal = Field(gt=0)
    close_price: Decimal | None = Field(default=None, gt=0)
    opened_at: datetime
    closed_at: datetime | None = None
    profit: Decimal = Decimal("0")
    commission: Decimal = Decimal("0")
    swap: Decimal = Decimal("0")
    status: TradeStatus

    @field_validator("opened_at", "closed_at")
    @classmethod
    def validate_times(cls, value: datetime | None) -> datetime | None:
        return _validate_timestamp(value) if value is not None else None

    @model_validator(mode="after")
    def validate_trade(self) -> Mt5TradeItem:
        if self.status == TradeStatus.CLOSED and (
            self.close_price is None or self.closed_at is None
        ):
            raise ValueError("Closed trade requires close_price and closed_at")
        if self.closed_at is not None and self.closed_at < self.opened_at:
            raise ValueError("Trade closed_at cannot precede opened_at")
        return self


class Mt5TradesRequest(Mt5RequestBase):
    account_external_id: str = Field(min_length=1, max_length=64)
    trades: list[Mt5TradeItem] = Field(min_length=1, max_length=1000)


class SyncResultResponse(BaseModel):
    received: int
    created: int
    updated: int
    removed: int = 0


class TerminalStatusResponse(BaseModel):
    terminal_id: str
    terminal_name: str
    terminal_build: int
    last_heartbeat_at: datetime | None
    terminal_time: datetime | None
    last_sync_at: datetime | None


class Mt5StatusResponse(BaseModel):
    configured: bool
    connected: bool
    stale: bool
    stale_after_seconds: int
    terminal: TerminalStatusResponse | None
