from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.enums import CandleSource, TradeSide, TradeStatus


class ApiErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str | None = None


class ApiError(BaseModel):
    error: ApiErrorDetail


class SymbolCreate(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    description: str = Field(default="", max_length=255)
    digits: int = Field(default=5, ge=0, le=12)
    is_active: bool = True
    volume_min: Decimal = Field(default=Decimal("0.01"), gt=0, le=99)
    volume_step: Decimal = Field(default=Decimal("0.01"), gt=0, le=99)
    volume_max: Decimal = Field(default=Decimal("99"), gt=0, le=99)
    contract_size: Decimal = Field(default=Decimal("1"), gt=0)

    @model_validator(mode="after")
    def validate_volume_range(self) -> "SymbolCreate":
        if self.volume_min > self.volume_max:
            raise ValueError("volume_min must not exceed volume_max")
        return self


class SymbolResponse(SymbolCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class CandleCreate(BaseModel):
    symbol_id: UUID
    timeframe: str = Field(min_length=1, max_length=16)
    open_time: datetime
    open: Decimal = Field(gt=0)
    high: Decimal = Field(gt=0)
    low: Decimal = Field(gt=0)
    close: Decimal = Field(gt=0)
    volume: Decimal = Field(ge=0)


class CandleResponse(CandleCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    source: CandleSource


class QuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    symbol_id: UUID
    terminal_id: str
    bid: Decimal
    ask: Decimal
    observed_at: datetime
    received_at: datetime
    source: CandleSource


class AccountCreate(BaseModel):
    external_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    currency: str = Field(default="USD", min_length=3, max_length=8)
    balance: Decimal = Field(default=Decimal("0"))


class AccountResponse(AccountCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime


class TradeCreate(BaseModel):
    account_id: UUID
    symbol_id: UUID
    external_id: str = Field(min_length=1, max_length=64)
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

    @model_validator(mode="after")
    def validate_close_data(self) -> "TradeCreate":
        if self.status == TradeStatus.CLOSED and (
            self.close_price is None or self.closed_at is None
        ):
            raise ValueError("Closed trade requires close_price and closed_at")
        return self


class TradeResponse(TradeCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID


class HealthResponse(BaseModel):
    status: str


class InfoResponse(BaseModel):
    name: str
    version: str
    environment: str
