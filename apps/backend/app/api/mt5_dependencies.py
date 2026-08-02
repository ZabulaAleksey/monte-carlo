from typing import Annotated

from fastapi import Depends

from app.api.dependencies import SessionDependency
from app.application.mt5 import Mt5SyncService
from app.infrastructure.config import Settings, get_settings
from app.infrastructure.database.mt5_gateway import SqlAlchemyMt5SyncGateway


def get_mt5_sync_service(
    session: SessionDependency,
    settings: Annotated[Settings, Depends(get_settings)],
) -> Mt5SyncService:
    key = settings.mt5_api_key
    configured = key is not None and bool(key.get_secret_value())
    return Mt5SyncService(
        SqlAlchemyMt5SyncGateway(session),
        settings.mt5_heartbeat_timeout_seconds,
        configured,
    )


Mt5SyncServiceDependency = Annotated[Mt5SyncService, Depends(get_mt5_sync_service)]
