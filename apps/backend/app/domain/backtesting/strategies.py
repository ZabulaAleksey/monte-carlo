from __future__ import annotations

from collections.abc import Mapping
from dataclasses import replace
from decimal import Decimal

from app.domain.backtesting.models import (
    BacktestSettings,
    Signal,
    StrategyContext,
    StrategyDefinition,
    StrategyParameterDefinition,
)
from app.domain.exceptions import DomainError


class MovingAverageCrossStrategy:
    """Infrastructure demo only; no profitability claim is made."""

    name = "moving_average_cross"
    version = "1.2.0"

    def validate_parameters(self, parameters: dict[str, object]) -> None:
        short_window = self._window(parameters, "short_window")
        long_window = self._window(parameters, "long_window")
        if short_window >= long_window:
            raise DomainError("short_window must be smaller than long_window")
        if "position_size" in parameters:
            self._positive_decimal(parameters, "position_size")
        if "stop_loss_pct" in parameters:
            self._positive_decimal(parameters, "stop_loss_pct")
        if "take_profit_pct" in parameters:
            self._positive_decimal(parameters, "take_profit_pct")

    def configure(
        self, parameters: dict[str, object], settings: BacktestSettings
    ) -> BacktestSettings:
        position_size = (
            self._positive_decimal(parameters, "position_size")
            if "position_size" in parameters
            else settings.position_size
        )
        return replace(
            settings,
            position_size=position_size,
            stop_loss_pct=self._optional_setting(
                parameters, "stop_loss_pct", settings.stop_loss_pct
            ),
            take_profit_pct=self._optional_setting(
                parameters, "take_profit_pct", settings.take_profit_pct
            ),
        )

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

    @staticmethod
    def _positive_decimal(parameters: Mapping[str, object], name: str) -> Decimal:
        value = parameters.get(name)
        if isinstance(value, bool):
            raise DomainError(f"{name} must be greater than zero")
        try:
            converted = Decimal(str(value))
        except Exception as exc:
            raise DomainError(f"{name} must be greater than zero") from exc
        if converted <= 0:
            raise DomainError(f"{name} must be greater than zero")
        return converted

    @classmethod
    def _optional_setting(
        cls,
        parameters: Mapping[str, object],
        name: str,
        fallback: Decimal | None,
    ) -> Decimal | None:
        if name not in parameters:
            return fallback
        return cls._positive_decimal(parameters, name)


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
        StrategyParameterDefinition(
            "position_size", "Position size / lots", "decimal", Decimal("0.01"),
            Decimal("0.01"), Decimal("99")
        ),
        StrategyParameterDefinition(
            "stop_loss_pct", "Stop loss / %", "decimal", Decimal("1"),
            Decimal("0.0001"), Decimal("100")
        ),
        StrategyParameterDefinition(
            "take_profit_pct", "Take profit / %", "decimal", Decimal("2"),
            Decimal("0.0001"), Decimal("1000")
        ),
    ),
)


def strategy_catalog() -> tuple[StrategyDefinition, ...]:
    return (MOVING_AVERAGE_CROSS_DEFINITION,)


def create_strategy(name: str) -> MovingAverageCrossStrategy:
    if name == MovingAverageCrossStrategy.name:
        return MovingAverageCrossStrategy()
    raise DomainError(f"Unknown strategy: {name}")
