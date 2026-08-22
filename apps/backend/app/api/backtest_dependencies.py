from typing import Annotated

from fastapi import Depends

from app.api.dependencies import SessionDependency
from app.application.backtest_jobs import BacktestJobManager
from app.application.backtesting import BacktestRunRequest, BacktestService
from app.domain.backtesting.interfaces import BacktestControl
from app.domain.backtesting.models import StoredBacktestResult
from app.infrastructure.database.backtesting import (
    SqlAlchemyBacktestRunRepository,
    SqlAlchemyHistoricalDataProvider,
)
from app.infrastructure.database.repositories import SqlAlchemySymbolRepository
from app.infrastructure.database.session import SessionFactory


def get_backtest_service(session: SessionDependency) -> BacktestService:
    return BacktestService(
        SqlAlchemyHistoricalDataProvider(session),
        SqlAlchemyBacktestRunRepository(session),
        SqlAlchemySymbolRepository(session),
    )


BacktestServiceDependency = Annotated[BacktestService, Depends(get_backtest_service)]


async def _run_backtest_job(
    request: BacktestRunRequest, control: BacktestControl
) -> StoredBacktestResult:
    async with SessionFactory() as session:
        service = get_backtest_service(session)
        return await service.run(request, control)


_job_manager = BacktestJobManager(_run_backtest_job)


def get_backtest_job_manager() -> BacktestJobManager:
    return _job_manager


BacktestJobManagerDependency = Annotated[
    BacktestJobManager, Depends(get_backtest_job_manager)
]
