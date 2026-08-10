from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.application.ports import SymbolRepository
from app.domain.backtesting.engine import BacktestEngine
from app.domain.backtesting.execution import (
    FixedCommissionModel,
    FixedSlippageModel,
    OrderSimulator,
    PositionManager,
    RelativeSlippageModel,
    RiskManager,
)
from app.domain.backtesting.interfaces import (
    BacktestControl,
    BacktestRunRepository,
    HistoricalDataProvider,
)
from app.domain.backtesting.models import (
    BacktestRunSummary,
    BacktestSettings,
    SlippageMode,
    StoredBacktestResult,
    StrategyDefinition,
    VirtualTrade,
)
from app.domain.backtesting.strategies import create_strategy, strategy_catalog
from app.domain.exceptions import NotFoundError


@dataclass(frozen=True, slots=True)
class BacktestRunRequest:
    strategy_name: str
    symbol_id: UUID
    timeframe: str
    start_at: datetime
    end_at: datetime
    parameters: dict[str, object]
    settings: BacktestSettings


class BacktestService:
    def __init__(
        self,
        data_provider: HistoricalDataProvider,
        repository: BacktestRunRepository,
        symbols: SymbolRepository,
    ) -> None:
        self._data_provider = data_provider
        self._repository = repository
        self._symbols = symbols

    def strategies(self) -> tuple[StrategyDefinition, ...]:
        return strategy_catalog()

    async def run(
        self,
        request: BacktestRunRequest,
        control: BacktestControl | None = None,
    ) -> StoredBacktestResult:
        if await self._symbols.get(request.symbol_id) is None:
            raise NotFoundError("Symbol not found")
        strategy = create_strategy(request.strategy_name)
        strategy.validate_parameters(request.parameters)
        resolved_settings = strategy.configure(request.parameters, request.settings)
        slippage = (
            FixedSlippageModel(resolved_settings.slippage_value)
            if resolved_settings.slippage_mode == SlippageMode.FIXED
            else RelativeSlippageModel(resolved_settings.slippage_value)
        )
        engine = BacktestEngine(
            self._data_provider,
            PositionManager(),
            RiskManager(
                resolved_settings.stop_loss_pct,
                resolved_settings.take_profit_pct,
            ),
            OrderSimulator(
                FixedCommissionModel(resolved_settings.commission_per_fill),
                slippage,
                resolved_settings.swap_per_day,
            ),
        )
        result = await engine.run(
            symbol_id=request.symbol_id,
            timeframe=request.timeframe,
            start_at=request.start_at,
            end_at=request.end_at,
            strategy=strategy,
            parameters=request.parameters,
            settings=resolved_settings,
            control=control,
        )
        return await self._repository.add(result)

    async def list(self, limit: int = 100) -> list[BacktestRunSummary]:
        return await self._repository.list(limit)

    async def get(self, run_id: UUID) -> StoredBacktestResult:
        result = await self._repository.get(run_id)
        if result is None:
            raise NotFoundError("Backtest run not found")
        return result

    async def trades(self, run_id: UUID) -> tuple[VirtualTrade, ...]:
        trades = await self._repository.trades(run_id)
        if trades is None:
            raise NotFoundError("Backtest run not found")
        return trades

    async def delete(self, run_id: UUID) -> None:
        if not await self._repository.delete(run_id):
            raise NotFoundError("Backtest run not found")
