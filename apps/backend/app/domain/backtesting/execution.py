from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from app.domain.backtesting.interfaces import CommissionModel, SlippageModel
from app.domain.backtesting.models import (
    ExitReason,
    OpenPosition,
    PositionSide,
    VirtualTrade,
)
from app.domain.entities import Candle
from app.domain.exceptions import DomainError

HUNDRED = Decimal("100")
DECIMAL_QUANTUM = Decimal("0.00000001")


def quantize_decimal(value: Decimal) -> Decimal:
    quantized = value.quantize(DECIMAL_QUANTUM)
    return abs(quantized) if quantized.is_zero() else quantized


class NotionalCommissionModel:
    """Commission percentage of traded notional, charged on every fill."""

    def __init__(self, percentage_per_fill: Decimal, contract_size: Decimal) -> None:
        if percentage_per_fill < 0:
            raise DomainError("Commission cannot be negative")
        if contract_size <= 0:
            raise DomainError("Contract size must be greater than zero")
        self._rate = percentage_per_fill / HUNDRED
        self._contract_size = contract_size

    def calculate(self, price: Decimal, quantity: Decimal) -> Decimal:
        return quantize_decimal(
            price * quantity * self._contract_size * self._rate
        )


class PointSlippageModel:
    """Slippage in quote points, capped at the sixth informative price digit."""

    def __init__(self, points: Decimal, price_digits: int) -> None:
        if points < 0:
            raise DomainError("Slippage cannot be negative")
        if price_digits < 0:
            raise DomainError("Price digits cannot be negative")
        self._amount = points * (Decimal("10") ** -min(price_digits, 6))

    def apply(self, price: Decimal, *, is_buy_order: bool) -> Decimal:
        adjusted = price + self._amount if is_buy_order else price - self._amount
        return quantize_decimal(adjusted)


class PositionManager:
    """Maintains one deterministic net position for the current backtest."""

    def __init__(self) -> None:
        self._position: OpenPosition | None = None
        self._next_position_id = 1

    @property
    def current(self) -> OpenPosition | None:
        return self._position

    @property
    def positions(self) -> tuple[OpenPosition, ...]:
        return (self._position,) if self._position is not None else ()

    def open(
        self,
        side: PositionSide,
        quantity: Decimal,
        opened_at: datetime,
        open_price: Decimal,
        stop_loss: Decimal | None,
        take_profit: Decimal | None,
        entry_commission: Decimal,
    ) -> OpenPosition:
        if self._position is not None:
            raise DomainError("Only one net position can be open")
        position = OpenPosition(
            position_id=self._next_position_id,
            side=side,
            quantity=quantity,
            opened_at=opened_at,
            open_price=open_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            entry_commission=entry_commission,
        )
        self._position = position
        self._next_position_id += 1
        return position

    def close(self) -> OpenPosition:
        if self._position is None:
            raise DomainError("No position is open")
        position = self._position
        self._position = None
        return position


class RiskManager:
    def __init__(
        self,
        stop_loss_pct: Decimal | None,
        take_profit_pct: Decimal | None,
    ) -> None:
        if stop_loss_pct is not None and stop_loss_pct <= 0:
            raise DomainError("Stop loss must be greater than zero")
        if take_profit_pct is not None and take_profit_pct <= 0:
            raise DomainError("Take profit must be greater than zero")
        self._stop_loss_rate = (
            stop_loss_pct / HUNDRED if stop_loss_pct is not None else None
        )
        self._take_profit_rate = (
            take_profit_pct / HUNDRED if take_profit_pct is not None else None
        )

    def levels(
        self, entry_price: Decimal, side: PositionSide
    ) -> tuple[Decimal | None, Decimal | None]:
        if side == PositionSide.BUY:
            stop = (
                entry_price * (Decimal("1") - self._stop_loss_rate)
                if self._stop_loss_rate is not None
                else None
            )
            take = (
                entry_price * (Decimal("1") + self._take_profit_rate)
                if self._take_profit_rate is not None
                else None
            )
        else:
            stop = (
                entry_price * (Decimal("1") + self._stop_loss_rate)
                if self._stop_loss_rate is not None
                else None
            )
            take = (
                entry_price * (Decimal("1") - self._take_profit_rate)
                if self._take_profit_rate is not None
                else None
            )
        return (
            quantize_decimal(stop) if stop is not None else None,
            quantize_decimal(take) if take is not None else None,
        )

    def exit_for_candle(
        self, position: OpenPosition, candle: Candle
    ) -> tuple[ExitReason, Decimal] | None:
        # With OHLC data the intrabar path is unknown. If both levels are touched,
        # the conservative and reproducible stop-first policy is used.
        if position.side == PositionSide.BUY:
            if position.stop_loss is not None and candle.low <= position.stop_loss:
                return ExitReason.STOP_LOSS, min(candle.open, position.stop_loss)
            if position.take_profit is not None and candle.high >= position.take_profit:
                return ExitReason.TAKE_PROFIT, max(candle.open, position.take_profit)
        else:
            if position.stop_loss is not None and candle.high >= position.stop_loss:
                return ExitReason.STOP_LOSS, max(candle.open, position.stop_loss)
            if position.take_profit is not None and candle.low <= position.take_profit:
                return ExitReason.TAKE_PROFIT, min(candle.open, position.take_profit)
        return None


class OrderSimulator:
    def __init__(
        self,
        commission_model: CommissionModel,
        slippage_model: SlippageModel,
        swap_pct_per_lot_per_day: Decimal,
        contract_size: Decimal = Decimal("1"),
    ) -> None:
        self._commission_model = commission_model
        self._slippage_model = slippage_model
        self._swap_rate_per_day = swap_pct_per_lot_per_day / HUNDRED
        self._contract_size = contract_size

    def open_position(
        self,
        manager: PositionManager,
        risk_manager: RiskManager,
        side: PositionSide,
        quantity: Decimal,
        timestamp: datetime,
        market_price: Decimal,
    ) -> OpenPosition:
        is_buy_order = side == PositionSide.BUY
        fill_price = self._slippage_model.apply(
            market_price, is_buy_order=is_buy_order
        )
        if fill_price <= 0:
            raise DomainError("Slippage produced a non-positive fill price")
        commission = self._commission_model.calculate(fill_price, quantity)
        stop_loss, take_profit = risk_manager.levels(fill_price, side)
        return manager.open(
            side,
            quantity,
            timestamp,
            fill_price,
            stop_loss,
            take_profit,
            commission,
        )

    def close_position(
        self,
        manager: PositionManager,
        sequence: int,
        timestamp: datetime,
        market_price: Decimal,
        reason: ExitReason,
    ) -> VirtualTrade:
        position = manager.close()
        is_buy_order = position.side == PositionSide.SELL
        fill_price = self._slippage_model.apply(
            market_price, is_buy_order=is_buy_order
        )
        if fill_price <= 0:
            raise DomainError("Slippage produced a non-positive fill price")
        exit_commission = self._commission_model.calculate(fill_price, position.quantity)
        direction = Decimal("1") if position.side == PositionSide.BUY else Decimal("-1")
        gross_profit = quantize_decimal(
            (fill_price - position.open_price)
            * position.quantity
            * self._contract_size
            * direction
        )
        swap = self.accrued_swap(position, timestamp)
        total_commission = quantize_decimal(position.entry_commission + exit_commission)
        net_profit = quantize_decimal(gross_profit + swap - total_commission)
        return VirtualTrade(
            sequence=sequence,
            side=position.side,
            volume=position.quantity,
            opened_at=position.opened_at,
            closed_at=timestamp,
            open_price=position.open_price,
            close_price=fill_price,
            stop_loss=position.stop_loss,
            take_profit=position.take_profit,
            exit_reason=reason,
            gross_profit=gross_profit,
            commission=total_commission,
            swap=swap,
            net_profit=net_profit,
        )

    def unrealized_profit(self, position: OpenPosition, price: Decimal) -> Decimal:
        direction = Decimal("1") if position.side == PositionSide.BUY else Decimal("-1")
        return quantize_decimal(
            (price - position.open_price)
            * position.quantity
            * self._contract_size
            * direction
        )

    def accrued_swap(self, position: OpenPosition, timestamp: datetime) -> Decimal:
        days = max((timestamp.date() - position.opened_at.date()).days, 0)
        return quantize_decimal(
            position.open_price
            * position.quantity
            * self._contract_size
            * self._swap_rate_per_day
            * Decimal(days)
        )
