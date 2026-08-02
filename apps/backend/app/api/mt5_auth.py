import logging
import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.infrastructure.config import Settings, get_settings

logger = logging.getLogger(__name__)


async def require_mt5_api_key(
    settings: Annotated[Settings, Depends(get_settings)],
    api_key: Annotated[str | None, Header(alias="X-MT5-API-Key")] = None,
) -> None:
    configured_key = settings.mt5_api_key
    if configured_key is None:
        logger.error("MT5 bridge authentication is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MT5 bridge is not configured",
        )
    if api_key is None or not secrets.compare_digest(api_key, configured_key.get_secret_value()):
        logger.warning("Rejected MT5 bridge authentication")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MT5 bridge credentials",
            headers={"WWW-Authenticate": "ApiKey"},
        )


Mt5AuthDependency = Annotated[None, Depends(require_mt5_api_key)]
