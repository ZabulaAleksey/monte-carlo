from __future__ import annotations

from decimal import Decimal

from app.domain.backtesting.execution import quantize_decimal

HUNDRED = Decimal("100")


def unrealized_drawdown_absolute(balance: Decimal, equity: Decimal) -> Decimal:
    """Return only the adverse open-position gap below realized balance."""

    return quantize_decimal(max(balance - equity, Decimal("0")))


def unrealized_drawdown_pct(balance: Decimal, equity: Decimal) -> Decimal:
    drawdown = unrealized_drawdown_absolute(balance, equity)
    if balance <= 0:
        return Decimal("0")
    return quantize_decimal(drawdown / balance * HUNDRED)
