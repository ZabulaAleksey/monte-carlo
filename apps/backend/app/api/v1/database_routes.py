from fastapi import APIRouter

from app.api.database_dependencies import DatabaseAdminServiceDependency
from app.api.database_schemas import DatabaseOverviewResponse

router = APIRouter(prefix="/database", tags=["database"])


@router.get("/overview", response_model=DatabaseOverviewResponse)
async def database_overview(
    service: DatabaseAdminServiceDependency,
) -> DatabaseOverviewResponse:
    return DatabaseOverviewResponse.model_validate(await service.overview())
