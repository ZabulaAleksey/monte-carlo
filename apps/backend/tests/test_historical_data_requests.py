from __future__ import annotations

from datetime import UTC, datetime

from httpx import AsyncClient

from tests.conftest import MT5_TEST_API_KEY


def _auth() -> dict[str, str]:
    return {"X-MT5-API-Key": MT5_TEST_API_KEY}


async def _symbol(client: AsyncClient) -> str:
    response = await client.post(
        "/api/v1/symbols",
        json={
            "name": "EURUSD",
            "description": "Euro / US dollar",
            "digits": 5,
            "is_active": True,
        },
    )
    assert response.status_code == 201
    return str(response.json()["id"])


async def test_site_request_is_claimed_and_completed_by_mt5(
    client: AsyncClient,
) -> None:
    symbol_id = await _symbol(client)
    requested = {
        "symbol_id": symbol_id,
        "timeframe": "H1",
        "start_at": "2024-01-01T00:00:00Z",
        "end_at": "2024-01-01T01:00:00Z",
    }

    created = await client.post("/api/v1/backtests/history/requests", json=requested)
    duplicate = await client.post("/api/v1/backtests/history/requests", json=requested)

    assert created.status_code == 202
    assert duplicate.status_code == 202
    assert duplicate.json()["id"] == created.json()["id"]
    assert created.json()["status"] == "pending"

    unauthenticated = await client.get(
        "/api/v1/mt5/history/requests/next?terminal_id=terminal-1"
    )
    assert unauthenticated.status_code == 401

    claimed = await client.get(
        "/api/v1/mt5/history/requests/next?terminal_id=terminal-1",
        headers=_auth(),
    )
    assert claimed.status_code == 200
    assert claimed.json()["status"] == "claimed"
    assert claimed.json()["symbol"] == "EURUSD"

    candle_payload = {
        "terminal_id": "terminal-1",
        "sent_at": datetime.now(UTC).isoformat(),
        "candles": [
            {
                "symbol": "EURUSD",
                "timeframe": "H1",
                "open_time": open_time,
                "open": "1.10000",
                "high": "1.11000",
                "low": "1.09000",
                "close": "1.10500",
                "volume": "100",
            }
            for open_time in (
                "2024-01-01T00:00:00Z",
                "2024-01-01T01:00:00Z",
            )
        ],
    }
    candles = await client.post(
        "/api/v1/mt5/candles/batch",
        headers=_auth(),
        json=candle_payload,
    )
    assert candles.status_code == 200

    request_id = created.json()["id"]
    completed = await client.post(
        f"/api/v1/mt5/history/requests/{request_id}/complete",
        headers=_auth(),
        json={
            "terminal_id": "terminal-1",
            "sent_at": datetime.now(UTC).isoformat(),
            "candle_count": 2,
            "covered_start": requested["start_at"],
            "covered_end": requested["end_at"],
        },
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["candle_count"] == 2

    coverage = await client.get(
        "/api/v1/backtests/history/coverage",
        params={
            "symbol_id": symbol_id,
            "timeframe": "H1",
            "start_at": requested["start_at"],
            "end_at": requested["end_at"],
        },
    )
    assert coverage.status_code == 200
    assert coverage.json()["complete"] is True

    empty = await client.get(
        "/api/v1/mt5/history/requests/next?terminal_id=terminal-1",
        headers=_auth(),
    )
    assert empty.status_code == 204


async def test_mt5_can_report_unavailable_history(client: AsyncClient) -> None:
    symbol_id = await _symbol(client)
    created = await client.post(
        "/api/v1/backtests/history/requests",
        json={
            "symbol_id": symbol_id,
            "timeframe": "D1",
            "start_at": "2010-01-01T00:00:00Z",
            "end_at": "2010-02-01T00:00:00Z",
        },
    )
    request_id = created.json()["id"]
    await client.get(
        "/api/v1/mt5/history/requests/next?terminal_id=terminal-1",
        headers=_auth(),
    )

    failed = await client.post(
        f"/api/v1/mt5/history/requests/{request_id}/fail",
        headers=_auth(),
        json={
            "terminal_id": "terminal-1",
            "sent_at": datetime.now(UTC).isoformat(),
            "error": "Broker history is unavailable for the requested range",
        },
    )

    assert failed.status_code == 200
    assert failed.json()["status"] == "failed"
    assert "unavailable" in failed.json()["error"]
