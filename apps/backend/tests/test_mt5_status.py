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


@pytest.mark.asyncio
async def test_status_accepts_recent_authenticated_sync_when_heartbeat_is_old(
    client: AsyncClient, session: AsyncSession
) -> None:
    session.add(
        Mt5TerminalModel(
            id=uuid4(),
            terminal_id="quotes-active-terminal",
            terminal_name="MetaTrader 5",
            terminal_build=5000,
            account_external_id="100001",
            last_heartbeat_at=datetime.now(UTC) - timedelta(minutes=10),
            terminal_time=datetime.now(UTC) - timedelta(minutes=10),
            last_sync_at=datetime.now(UTC),
            created_at=datetime.now(UTC) - timedelta(days=1),
        )
    )
    await session.commit()

    response = await client.get(
        "/api/v1/mt5/status?terminal_id=quotes-active-terminal"
    )

    assert response.status_code == 200
    assert response.json()["connected"] is True
    assert response.json()["stale"] is False
    assert response.json()["terminal"]["account_external_id"] == "100001"


@pytest.mark.asyncio
async def test_status_without_id_selects_terminal_with_freshest_activity(
    client: AsyncClient, session: AsyncSession
) -> None:
    now = datetime.now(UTC)
    session.add_all(
        [
            Mt5TerminalModel(
                id=uuid4(),
                terminal_id="heartbeat-terminal",
                terminal_name="MetaTrader 5",
                terminal_build=5000,
                account_external_id="100001",
                last_heartbeat_at=now - timedelta(seconds=10),
                terminal_time=now,
                last_sync_at=now - timedelta(minutes=5),
                created_at=now - timedelta(days=1),
            ),
            Mt5TerminalModel(
                id=uuid4(),
                terminal_id="data-active-terminal",
                terminal_name="MetaTrader 5",
                terminal_build=5000,
                account_external_id="100002",
                last_heartbeat_at=now - timedelta(minutes=5),
                terminal_time=now,
                last_sync_at=now,
                created_at=now - timedelta(days=2),
            ),
        ]
    )
    await session.commit()

    response = await client.get("/api/v1/mt5/status")

    assert response.status_code == 200
    assert response.json()["terminal"]["terminal_id"] == "data-active-terminal"
    assert response.json()["terminal"]["account_external_id"] == "100002"
