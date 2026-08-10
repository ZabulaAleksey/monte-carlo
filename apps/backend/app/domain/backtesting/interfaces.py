from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Protocol
from uuid import UUID

from app.domain.backtesting.models import (
    BacktestResult,
    BacktestRunSummary,
    BacktestSettings,
    Signal,
    StoredBacktestResult,
    StrategyContext,
    VirtualTrade,
)
from app.domain.entities import Candle


class HistoricalDataProvider(Protocol):
    async def get_candles(
        self,
        symbol_id: UUID,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> list[Candle]: ...


class Strategy(Protocol):
    name: str
    version: str

    def validate_parameters(self, parameters: dict[str, object]) -> None: ...
    def configure(
        self, parameters: dict[str, object], settings: BacktestSettings
    ) -> BacktestSettings: ...
    def on_candle(self, context: StrategyContext) -> Signal: ...


class BacktestControl(Protocol):
    async def checkpoint(
        self, stage: str, completed: int = 0, total: int = 0
    ) -> None: ...


class CommissionModel(Protocol):
    def calculate(self, price: Decimal, quantity: Decimal) -> Decimal: ...


class SlippageModel(Protocol):
    def apply(self, price: Decimal, *, is_buy_order: bool) -> Decimal: ...


class BacktestRunRepository(Protocol):
    async def add(self, result: BacktestResult) -> StoredBacktestResult: ...
    async def list(self, limit: int = 100) -> list[BacktestRunSummary]: ...
    async def get(self, run_id: UUID) -> StoredBacktestResult | None: ...
    async def trades(self, run_id: UUID) -> tuple[VirtualTrade, ...] | None: ...
    async def delete(self, run_id: UUID) -> bool: ...
