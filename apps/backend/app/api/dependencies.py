from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services import AccountService, CandleService, SymbolService, TradeService
from app.infrastructure.database.repositories import (
    SqlAlchemyAccountRepository,
    SqlAlchemyCandleRepository,
    SqlAlchemySymbolRepository,
    SqlAlchemyTradeRepository,
)
from app.infrastructure.database.session import get_session

SessionDependency = Annotated[AsyncSession, Depends(get_session)]


def get_symbol_service(session: SessionDependency) -> SymbolService:
    return SymbolService(SqlAlchemySymbolRepository(session))


def get_candle_service(session: SessionDependency) -> CandleService:
    return CandleService(SqlAlchemyCandleRepository(session), SqlAlchemySymbolRepository(session))


def get_account_service(session: SessionDependency) -> AccountService:
    return AccountService(SqlAlchemyAccountRepository(session))


def get_trade_service(session: SessionDependency) -> TradeService:
    return TradeService(
        SqlAlchemyTradeRepository(session),
        SqlAlchemyAccountRepository(session),
        SqlAlchemySymbolRepository(session),
    )


SymbolServiceDependency = Annotated[SymbolService, Depends(get_symbol_service)]
CandleServiceDependency = Annotated[CandleService, Depends(get_candle_service)]
AccountServiceDependency = Annotated[AccountService, Depends(get_account_service)]
TradeServiceDependency = Annotated[TradeService, Depends(get_trade_service)]
