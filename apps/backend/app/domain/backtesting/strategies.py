from __future__ import annotations

from collections.abc import Mapping
from decimal import Decimal

from app.domain.backtesting.models import (
    Signal,
    StrategyContext,
    StrategyDefinition,
    StrategyParameterDefinition,
)
from app.domain.exceptions import DomainError


class MovingAverageCrossStrategy:
    """Infrastructure demo only; no profitability claim is made."""

    name = "moving_average_cross"
    version = "1.0.0"

    def validate_parameters(self, parameters: dict[str, object]) -> None:
        short_window = self._window(parameters, "short_window")
        long_window = self._window(parameters, "long_window")
        if short_window >= long_window:
            raise DomainError("short_window must be smaller than long_window")

    def on_candle(self, context: StrategyContext) -> Signal:
        short_window = self._window(context.parameters, "short_window")
        long_window = self._window(context.parameters, "long_window")
        history = context.history
        if len(history) < long_window + 1:
            return Signal.HOLD

        previous_short = self._average(
            [candle.close for candle in history[-short_window - 1 : -1]]
        )
        current_short = self._average(
            [candle.close for candle in history[-short_window:]]
        )
        previous_long = self._average(
            [candle.close for candle in history[-long_window - 1 : -1]]
        )
        current_long = self._average(
            [candle.close for candle in history[-long_window:]]
        )

        if previous_short <= previous_long and current_short > current_long:
            return Signal.BUY
        if previous_short >= previous_long and current_short < current_long:
            return Signal.SELL
        return Signal.HOLD

    @staticmethod
    def _average(values: list[Decimal]) -> Decimal:
        return sum(values, Decimal("0")) / Decimal(len(values))

    @staticmethod
    def _window(parameters: Mapping[str, object], name: str) -> int:
        value = parameters.get(name)
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise DomainError(f"{name} must be a positive integer")
        return value


MOVING_AVERAGE_CROSS_DEFINITION = StrategyDefinition(
    name=MovingAverageCrossStrategy.name,
    version=MovingAverageCrossStrategy.version,
    title="Moving average crossover",
    description=(
        "Demonstration strategy for infrastructure validation only; "
        "it is not presented as profitable."
    ),
    parameters=(
        StrategyParameterDefinition("short_window", "Fast MA period", "integer", 5, 1, 200),
        StrategyParameterDefinition("long_window", "Slow MA period", "integer", 20, 2, 500),
    ),
)


def strategy_catalog() -> tuple[StrategyDefinition, ...]:
    return (MOVING_AVERAGE_CROSS_DEFINITION,)


def create_strategy(name: str) -> MovingAverageCrossStrategy:
    if name == MovingAverageCrossStrategy.name:
        return MovingAverageCrossStrategy()
    raise DomainError(f"Unknown strategy: {name}")
