from __future__ import annotations

import asyncio
import math
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select

from app.application.services import AccountService, CandleService, SymbolService, TradeService
from app.domain.enums import CandleSource, TradeSide, TradeStatus
from app.infrastructure.config import get_settings
from app.infrastructure.database.models import CandleModel, TradeModel
from app.infrastructure.database.repositories import (
    SqlAlchemyAccountRepository,
    SqlAlchemyCandleRepository,
    SqlAlchemySymbolRepository,
    SqlAlchemyTradeRepository,
)
from app.infrastructure.database.session import SessionFactory


async def seed() -> None:
    if not get_settings().seed_demo_data:
        return
    async with SessionFactory() as session:
        symbol_repository = SqlAlchemySymbolRepository(session)
        account_repository = SqlAlchemyAccountRepository(session)
        candle_repository = SqlAlchemyCandleRepository(session)
        trade_repository = SqlAlchemyTradeRepository(session)
        symbol_service = SymbolService(symbol_repository)
        account_service = AccountService(account_repository)

        eurusd = await symbol_repository.get_by_name("EURUSD")
        if eurusd is None:
            eurusd = await symbol_service.create("EURUSD", "Euro / US Dollar", 5, True)
        xauusd = await symbol_repository.get_by_name("XAUUSD")
        if xauusd is None:
            xauusd = await symbol_service.create("XAUUSD", "Gold / US Dollar", 2, True)

        account = await account_repository.get_by_external_id("DEMO-001")
        if account is None:
            account = await account_service.create(
                "DEMO-001", "Demo Portfolio", "USD", Decimal("25000")
            )

        candle_count = await session.scalar(
            select(func.count()).select_from(CandleModel).where(CandleModel.symbol_id == eurusd.id)
        )
        if not candle_count:
            candle_service = CandleService(candle_repository, symbol_repository)
            start = datetime.now(UTC).replace(minute=0, second=0, microsecond=0) - timedelta(
                hours=47
            )
            previous = Decimal("1.08350")
            for index in range(48):
                movement = Decimal(str(round(math.sin(index / 4) * 0.0012 + index * 0.000015, 6)))
                close = previous + movement
                await candle_service.save(
                    eurusd.id,
                    "H1",
                    start + timedelta(hours=index),
                    previous,
                    max(previous, close) + Decimal("0.00035"),
                    min(previous, close) - Decimal("0.00028"),
                    close,
                    Decimal(820 + index * 13),
                    source=CandleSource.DEMO,
                )
                previous = close

        trade_count = await session.scalar(select(func.count()).select_from(TradeModel))
        if not trade_count:
            trade_service = TradeService(trade_repository, account_repository, symbol_repository)
            now = datetime.now(UTC)
            for index, profit in enumerate(("184.30", "-62.10", "241.80", "96.45"), start=1):
                opened = now - timedelta(days=5 - index, hours=3)
                await trade_service.save(
                    account.id,
                    eurusd.id if index < 4 else xauusd.id,
                    f"DEMO-TRADE-{index:03}",
                    TradeSide.BUY if index % 2 else TradeSide.SELL,
                    Decimal("0.30" if index < 4 else "0.10"),
                    Decimal("1.08200" if index < 4 else "2350.00"),
                    Decimal("1.08600" if index < 4 else "2361.50"),
                    opened,
                    opened + timedelta(hours=6 + index),
                    Decimal(profit),
                    Decimal("-2.40"),
                    Decimal("-0.55"),
                    TradeStatus.CLOSED,
                )


if __name__ == "__main__":
    asyncio.run(seed())
