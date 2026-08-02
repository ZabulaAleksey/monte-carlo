from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import Mt5TerminalModel


@pytest.mark.asyncio
async def test_status_marks_old_heartbeat_as_stale(
    client: AsyncClient, session: AsyncSession
) -> None:
    session.add(
        Mt5TerminalModel(
            id=uuid4(),
            terminal_id="stale-terminal",
            terminal_name="MetaTrader 5",
            terminal_build=5000,
            account_external_id="100001",
            last_heartbeat_at=datetime.now(UTC) - timedelta(minutes=10),
            terminal_time=datetime.now(UTC) - timedelta(minutes=10),
            last_sync_at=datetime.now(UTC) - timedelta(minutes=10),
            created_at=datetime.now(UTC) - timedelta(days=1),
        )
    )
    await session.commit()

    response = await client.get("/api/v1/mt5/status?terminal_id=stale-terminal")

    assert response.status_code == 200
    assert response.json()["connected"] is False
    assert response.json()["stale"] is True
