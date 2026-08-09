from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.backtesting.models import ExitReason, PositionSide, SlippageMode

StrategyValue = int | float | str | bool


class BacktestCreate(BaseModel):
    strategy_name: str = Field(min_length=1, max_length=64)
    symbol_id: UUID
    timeframe: str = Field(min_length=1, max_length=16)
    start_at: datetime
    end_at: datetime
    initial_capital: Decimal = Field(
        default=Decimal("10000"), gt=0, max_digits=24, decimal_places=8
    )
    position_size: Decimal = Field(
        default=Decimal("10000"), gt=0, max_digits=24, decimal_places=8
    )
    stop_loss_pct: Decimal | None = Field(
        default=Decimal("1"), gt=0, max_digits=16, decimal_places=8
    )
    take_profit_pct: Decimal | None = Field(
        default=Decimal("2"), gt=0, max_digits=16, decimal_places=8
    )
    commission_per_fill: Decimal = Field(
        default=Decimal("0"), ge=0, max_digits=24, decimal_places=8
    )
    swap_per_day: Decimal = Field(
        default=Decimal("0"), max_digits=24, decimal_places=8
    )
    slippage_mode: SlippageMode = SlippageMode.FIXED
    slippage_value: Decimal = Field(
        default=Decimal("0"), ge=0, max_digits=24, decimal_places=8
    )
    parameters: dict[str, StrategyValue] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_period(self) -> Self:
        if self.start_at >= self.end_at:
            raise ValueError("start_at must be before end_at")
        if self.start_at.utcoffset() is None or self.end_at.utcoffset() is None:
            raise ValueError("start_at and end_at must include a timezone")
        return self


class BacktestSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    initial_capital: Decimal
    position_size: Decimal
    stop_loss_pct: Decimal | None
    take_profit_pct: Decimal | None
    commission_per_fill: Decimal
    swap_per_day: Decimal
    slippage_mode: SlippageMode
    slippage_value: Decimal


class VirtualTradeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class EquityPointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sequence: int
    timestamp: datetime
    balance: Decimal
    equity: Decimal
    drawdown_pct: Decimal


class BacktestMetricsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class BacktestResultResponse(BaseModel):
    id: UUID
    created_at: datetime
    symbol_id: UUID
    timeframe: str
    requested_start: datetime
    requested_end: datetime
    data_start: datetime
    data_end: datetime
    candle_count: int
    strategy_name: str
    strategy_version: str
    parameters: dict[str, object]
    settings: BacktestSettingsResponse
    trades: list[VirtualTradeResponse]
    equity_curve: list[EquityPointResponse]
    metrics: BacktestMetricsResponse


class BacktestRunSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class StrategyParameterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    label: str
    value_type: str
    default: object
    minimum: int | None
    maximum: int | None


class StrategyDefinitionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    version: str
    title: str
    description: str
    parameters: list[StrategyParameterResponse]
