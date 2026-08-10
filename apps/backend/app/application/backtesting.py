from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.application.ports import SymbolRepository
from app.domain.backtesting.engine import BacktestEngine
from app.domain.backtesting.execution import (
    NotionalCommissionModel,
    OrderSimulator,
    PointSlippageModel,
    PositionManager,
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
    HistoricalDataCoverage,
    StoredBacktestResult,
    StrategyDefinition,
    VirtualTrade,
)
from app.domain.backtesting.strategies import create_strategy, strategy_catalog
from app.domain.entities import Symbol
from app.domain.exceptions import DomainError, NotFoundError


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
        symbol = await self._symbols.get(request.symbol_id)
        if symbol is None:
            raise NotFoundError("Symbol not found")
        strategy = create_strategy(request.strategy_name)
        strategy.validate_parameters(request.parameters)
        resolved_settings = strategy.configure(request.parameters, request.settings)
        self._validate_lot_size(resolved_settings.position_size, symbol)
        resolved_settings = replace(
            resolved_settings,
            contract_size=symbol.contract_size,
            price_digits=symbol.digits,
        )
        engine = BacktestEngine(
            self._data_provider,
            PositionManager(),
            RiskManager(
                resolved_settings.stop_loss_pct,
                resolved_settings.take_profit_pct,
            ),
            OrderSimulator(
                NotionalCommissionModel(
                    resolved_settings.commission_pct_per_fill,
                    resolved_settings.contract_size,
                ),
                PointSlippageModel(
                    resolved_settings.slippage_points,
                    resolved_settings.price_digits,
                ),
                resolved_settings.swap_pct_per_lot_per_day,
                resolved_settings.contract_size,
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

    async def coverage(
        self,
        symbol_id: UUID,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> HistoricalDataCoverage:
        if await self._symbols.get(symbol_id) is None:
            raise NotFoundError("Symbol not found")
        if start_at > end_at:
            raise DomainError("Coverage start cannot exceed end")
        return await self._data_provider.get_coverage(
            symbol_id, timeframe.strip().upper(), start_at, end_at
        )

    async def record_coverage(
        self,
        symbol_id: UUID,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
        source: str = "api",
    ) -> HistoricalDataCoverage:
        if await self._symbols.get(symbol_id) is None:
            raise NotFoundError("Symbol not found")
        if start_at > end_at:
            raise DomainError("Coverage start cannot exceed end")
        coverage = await self._data_provider.record_coverage(
            symbol_id, timeframe.strip().upper(), start_at, end_at, source
        )
        return coverage

    @staticmethod
    def _validate_lot_size(position_size: Decimal, symbol: Symbol) -> None:
        maximum = min(symbol.volume_max, Decimal("99"))
        if position_size < symbol.volume_min or position_size > maximum:
            raise DomainError(
                f"Position size must be between {symbol.volume_min} and {maximum} lots"
            )
        if (position_size - symbol.volume_min) % symbol.volume_step != 0:
            raise DomainError(
                f"Position size must use the {symbol.volume_step} lot step"
            )

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
