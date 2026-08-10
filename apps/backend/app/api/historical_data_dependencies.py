from typing import Annotated

from fastapi import Depends

from app.api.dependencies import SessionDependency
from app.application.historical_data_requests import HistoricalDataRequestService
from app.infrastructure.database.historical_data_requests import (
    SqlAlchemyHistoricalDataRequestGateway,
)
from app.infrastructure.database.repositories import SqlAlchemySymbolRepository


def get_historical_data_request_service(
    session: SessionDependency,
) -> HistoricalDataRequestService:
    return HistoricalDataRequestService(
        SqlAlchemyHistoricalDataRequestGateway(session),
        SqlAlchemySymbolRepository(session),
    )


HistoricalDataRequestServiceDependency = Annotated[
    HistoricalDataRequestService,
    Depends(get_historical_data_request_service),
]
