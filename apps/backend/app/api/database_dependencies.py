from typing import Annotated

from fastapi import Depends

from app.api.dependencies import SessionDependency
from app.application.database_admin import DatabaseAdminService
from app.infrastructure.database.overview import SqlAlchemyDatabaseOverviewReader


def get_database_admin_service(session: SessionDependency) -> DatabaseAdminService:
    return DatabaseAdminService(SqlAlchemyDatabaseOverviewReader(session))


DatabaseAdminServiceDependency = Annotated[
    DatabaseAdminService,
    Depends(get_database_admin_service),
]
