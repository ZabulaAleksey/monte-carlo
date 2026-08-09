from typing import Annotated

from fastapi import Depends

from app.api.dependencies import SessionDependency
from app.application.backtesting import BacktestService
from app.infrastructure.database.backtesting import (
    SqlAlchemyBacktestRunRepository,
    SqlAlchemyHistoricalDataProvider,
)
from app.infrastructure.database.repositories import SqlAlchemySymbolRepository


def get_backtest_service(session: SessionDependency) -> BacktestService:
    return BacktestService(
        SqlAlchemyHistoricalDataProvider(session),
        SqlAlchemyBacktestRunRepository(session),
        SqlAlchemySymbolRepository(session),
    )


BacktestServiceDependency = Annotated[BacktestService, Depends(get_backtest_service)]
