from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def create_symbol(client: AsyncClient, name: str = "EURUSD") -> dict[str, object]:
    response = await client.post(
        "/api/v1/symbols",
        json={"name": name, "description": "Euro / US Dollar", "digits": 5, "is_active": True},
    )
    assert response.status_code == 201
    return response.json()


async def create_account(client: AsyncClient) -> dict[str, object]:
    response = await client.post(
        "/api/v1/accounts",
        json={
            "external_id": "TEST-001",
            "name": "Test account",
            "currency": "USD",
            "balance": "10000",
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.asyncio
async def test_symbol_crud(client: AsyncClient) -> None:
    created = await create_symbol(client)
    symbol_id = created["id"]

    listed = await client.get("/api/v1/symbols")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    fetched = await client.get(f"/api/v1/symbols/{symbol_id}")
    assert fetched.json()["name"] == "EURUSD"
    assert fetched.json()["volume_min"] == "0.01000000"
    assert fetched.json()["volume_step"] == "0.01000000"
    assert fetched.json()["volume_max"] == "99.00000000"
    assert fetched.json()["contract_size"] == "1.00000000"

    updated = await client.put(
        f"/api/v1/symbols/{symbol_id}",
        json={"name": "EURUSD", "description": "Updated", "digits": 5, "is_active": False},
    )
    assert updated.status_code == 200
    assert updated.json()["is_active"] is False

    deleted = await client.delete(f"/api/v1/symbols/{symbol_id}")
    assert deleted.status_code == 204
    missing = await client.get(f"/api/v1/symbols/{symbol_id}")
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_save_candle(client: AsyncClient, session: AsyncSession) -> None:
    symbol = await create_symbol(client)
    response = await client.post(
        "/api/v1/candles",
        json={
            "symbol_id": symbol["id"],
            "timeframe": "H1",
            "open_time": datetime.now(UTC).isoformat(),
            "open": "1.08000",
            "high": "1.08600",
            "low": "1.07900",
            "close": "1.08400",
            "volume": "1200",
        },
    )
    assert response.status_code == 201
    session.expunge_all()
    candles = await client.get(f"/api/v1/candles?symbol_id={symbol['id']}")
    assert len(candles.json()) == 1
    assert candles.json()[0]["timeframe"] == "H1"
    assert candles.json()[0]["source"] == "api"
    assert candles.json()[0]["open_time"].endswith("Z")


@pytest.mark.asyncio
async def test_save_trade(client: AsyncClient) -> None:
    symbol = await create_symbol(client)
    account = await create_account(client)
    opened_at = datetime.now(UTC) - timedelta(hours=2)
    response = await client.post(
        "/api/v1/trades",
        json={
            "account_id": account["id"],
            "symbol_id": symbol["id"],
            "external_id": "TRADE-001",
            "side": "buy",
            "volume": "0.1",
            "open_price": "1.08000",
            "close_price": "1.08500",
            "opened_at": opened_at.isoformat(),
            "closed_at": datetime.now(UTC).isoformat(),
            "profit": "50.00",
            "commission": "-1.20",
            "swap": "0",
            "status": "closed",
        },
    )
    assert response.status_code == 201
    trades = await client.get(f"/api/v1/trades?account_id={account['id']}")
    assert len(trades.json()) == 1
    assert trades.json()[0]["external_id"] == "TRADE-001"
