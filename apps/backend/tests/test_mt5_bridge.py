from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models import PositionModel
from tests.conftest import MT5_TEST_API_KEY

HEADERS = {"X-MT5-API-Key": MT5_TEST_API_KEY}
TERMINAL_ID = "terminal-test-01"
ACCOUNT_ID = "100001"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


async def sync_account_and_symbol(client: AsyncClient) -> None:
    account = await client.post(
        "/api/v1/mt5/account",
        headers=HEADERS,
        json={
            "terminal_id": TERMINAL_ID,
            "sent_at": now_iso(),
            "external_id": ACCOUNT_ID,
            "name": "MetaTrader Demo",
            "currency": "USD",
            "balance": "10000",
            "equity": "10025",
            "margin": "125",
            "free_margin": "9900",
            "leverage": 100,
            "company": "MetaQuotes",
            "server": "Demo-Server",
        },
    )
    assert account.status_code == 200
    symbols = await client.post(
        "/api/v1/mt5/symbols",
        headers=HEADERS,
        json={
            "terminal_id": TERMINAL_ID,
            "sent_at": now_iso(),
            "symbols": [
                {
                    "name": "EURUSD",
                    "description": "Euro / US Dollar",
                    "digits": 5,
                    "is_active": True,
                    "volume_min": "0.01",
                    "volume_step": "0.01",
                    "volume_max": "100",
                    "contract_size": "100000",
                }
            ],
        },
    )
    assert symbols.status_code == 200


@pytest.mark.asyncio
async def test_symbol_sync_persists_mt5_lot_spec_and_caps_platform_maximum(
    client: AsyncClient,
) -> None:
    await sync_account_and_symbol(client)

    symbols = await client.get("/api/v1/symbols")

    assert symbols.status_code == 200
    symbol = symbols.json()[0]
    assert symbol["volume_min"] == "0.01000000"
    assert symbol["volume_step"] == "0.01000000"
    assert symbol["volume_max"] == "99.00000000"
    assert symbol["contract_size"] == "100000.00000000"


@pytest.mark.asyncio
async def test_mt5_bridge_requires_api_key(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/mt5/heartbeat",
        json={
            "terminal_id": TERMINAL_ID,
            "sent_at": now_iso(),
            "terminal_name": "MetaTrader 5",
            "terminal_build": 5000,
        },
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_error"


@pytest.mark.asyncio
async def test_heartbeat_is_idempotent_and_status_is_public(client: AsyncClient) -> None:
    payload = {
        "terminal_id": TERMINAL_ID,
        "sent_at": now_iso(),
        "terminal_name": "MetaTrader 5",
        "terminal_build": 5000,
        "account_external_id": ACCOUNT_ID,
    }

    first = await client.post("/api/v1/mt5/heartbeat", headers=HEADERS, json=payload)
    second = await client.post("/api/v1/mt5/heartbeat", headers=HEADERS, json=payload)
    status = await client.get("/api/v1/mt5/status")

    assert first.status_code == 200
    assert first.json()["created"] == 1
    assert second.status_code == 200
    assert second.json()["updated"] == 1
    assert status.status_code == 200
    assert status.json()["connected"] is True
    assert status.json()["terminal"]["terminal_id"] == TERMINAL_ID


@pytest.mark.asyncio
async def test_candle_and_trade_batches_are_idempotent(client: AsyncClient) -> None:
    await sync_account_and_symbol(client)
    opened_at = datetime.now(UTC) - timedelta(hours=2)
    candle_payload = {
        "terminal_id": TERMINAL_ID,
        "sent_at": now_iso(),
        "candles": [
            {
                "symbol": "EURUSD",
                "timeframe": "H1",
                "open_time": opened_at.isoformat(),
                "open": "1.08000",
                "high": "1.08600",
                "low": "1.07900",
                "close": "1.08400",
                "volume": "1200",
            }
        ],
    }
    trade_payload = {
        "terminal_id": TERMINAL_ID,
        "sent_at": now_iso(),
        "account_external_id": ACCOUNT_ID,
        "trades": [
            {
                "external_id": "DEAL-9001",
                "symbol": "EURUSD",
                "side": "buy",
                "volume": "0.10",
                "open_price": "1.08000",
                "close_price": "1.08400",
                "opened_at": opened_at.isoformat(),
                "closed_at": now_iso(),
                "profit": "40.00",
                "commission": "-1.00",
                "swap": "0",
                "status": "closed",
            }
        ],
    }

    first_candles = await client.post(
        "/api/v1/mt5/candles/batch", headers=HEADERS, json=candle_payload
    )
    second_candles = await client.post(
        "/api/v1/mt5/candles/batch", headers=HEADERS, json=candle_payload
    )
    coverage = await client.post(
        "/api/v1/mt5/candles/coverage",
        headers=HEADERS,
        json={
            "terminal_id": TERMINAL_ID,
            "sent_at": now_iso(),
            "symbol": "EURUSD",
            "timeframe": "H1",
            "covered_start": opened_at.isoformat(),
            "covered_end": opened_at.isoformat(),
            "expected_candles": 1,
        },
    )
    first_trades = await client.post(
        "/api/v1/mt5/trades/batch", headers=HEADERS, json=trade_payload
    )
    second_trades = await client.post(
        "/api/v1/mt5/trades/batch", headers=HEADERS, json=trade_payload
    )

    assert first_candles.json()["created"] == 1
    assert second_candles.json()["created"] == 0
    assert second_candles.json()["updated"] == 1
    assert coverage.status_code == 200
    assert coverage.json()["received"] == 1
    assert first_trades.json()["created"] == 1
    assert second_trades.json()["created"] == 0
    assert second_trades.json()["updated"] == 1
    stored_candles = (await client.get("/api/v1/candles")).json()
    mt5_candles = (await client.get("/api/v1/candles?source=mt5")).json()
    demo_candles = (await client.get("/api/v1/candles?source=demo")).json()
    assert len(stored_candles) == 1
    assert stored_candles[0]["source"] == "mt5"
    assert len(mt5_candles) == 1
    assert demo_candles == []
    assert len((await client.get("/api/v1/trades")).json()) == 1
    symbol_id = (await client.get("/api/v1/symbols")).json()[0]["id"]
    cached = await client.get(
        "/api/v1/backtests/history/coverage",
        params={
            "symbol_id": symbol_id,
            "timeframe": "H1",
            "start_at": opened_at.isoformat(),
            "end_at": opened_at.isoformat(),
        },
    )
    assert cached.status_code == 200
    assert cached.json()["complete"] is True


@pytest.mark.asyncio
async def test_live_quote_is_public_idempotent_and_rejects_older_updates(
    client: AsyncClient,
) -> None:
    await sync_account_and_symbol(client)
    observed_at = datetime.now(UTC) - timedelta(seconds=2)

    def quote_payload(bid: str, ask: str, timestamp: datetime) -> dict[str, object]:
        return {
            "terminal_id": TERMINAL_ID,
            "sent_at": now_iso(),
            "quotes": [
                {
                    "symbol": "EURUSD",
                    "bid": bid,
                    "ask": ask,
                    "observed_at": timestamp.isoformat(),
                }
            ],
        }

    first = await client.post(
        "/api/v1/mt5/quotes",
        headers=HEADERS,
        json=quote_payload("1.08300", "1.08312", observed_at),
    )
    second = await client.post(
        "/api/v1/mt5/quotes",
        headers=HEADERS,
        json=quote_payload("1.08310", "1.08322", observed_at),
    )
    older = await client.post(
        "/api/v1/mt5/quotes",
        headers=HEADERS,
        json=quote_payload("1.00000", "1.00010", observed_at - timedelta(seconds=1)),
    )
    public = await client.get("/api/v1/quotes")

    assert first.status_code == 200
    assert first.json()["created"] == 1
    assert second.json()["updated"] == 1
    assert older.status_code == 200
    assert older.json()["created"] == 0
    assert older.json()["updated"] == 0
    assert public.status_code == 200
    assert public.json()[0]["bid"] == "1.08310000"
    assert public.json()[0]["ask"] == "1.08322000"
    assert public.json()[0]["source"] == "mt5"


@pytest.mark.asyncio
async def test_live_quote_rejects_inverted_spread(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/mt5/quotes",
        headers=HEADERS,
        json={
            "terminal_id": TERMINAL_ID,
            "sent_at": now_iso(),
            "quotes": [
                {
                    "symbol": "EURUSD",
                    "bid": "1.08320",
                    "ask": "1.08310",
                    "observed_at": now_iso(),
                }
            ],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


@pytest.mark.asyncio
async def test_position_snapshot_replaces_stale_positions(
    client: AsyncClient, session: AsyncSession
) -> None:
    await sync_account_and_symbol(client)
    opened_at = datetime.now(UTC) - timedelta(hours=1)

    def payload(positions: list[dict[str, object]]) -> dict[str, object]:
        return {
            "terminal_id": TERMINAL_ID,
            "sent_at": now_iso(),
            "account_external_id": ACCOUNT_ID,
            "positions": positions,
        }

    position = {
        "external_id": "POSITION-1",
        "symbol": "EURUSD",
        "side": "buy",
        "volume": "0.20",
        "open_price": "1.08100",
        "current_price": "1.08300",
        "stop_loss": "1.07500",
        "take_profit": "1.09000",
        "profit": "40.00",
        "swap": "-0.20",
        "opened_at": opened_at.isoformat(),
        "observed_at": now_iso(),
    }
    first = await client.post("/api/v1/mt5/positions", headers=HEADERS, json=payload([position]))
    account_id = (await client.get("/api/v1/accounts")).json()[0]["id"]
    public = await client.get("/api/v1/positions", params={"account_id": account_id})
    empty = await client.post("/api/v1/mt5/positions", headers=HEADERS, json=payload([]))
    count = await session.scalar(select(func.count()).select_from(PositionModel))

    assert first.json()["created"] == 1
    assert public.status_code == 200
    assert public.json()[0]["external_id"] == "POSITION-1"
    assert public.json()[0]["profit"] == "40.00000000"
    assert public.json()[0]["swap"] == "-0.20000000"
    assert public.json()[0]["status"] == "open"
    assert empty.json()["removed"] == 1
    assert count == 0


@pytest.mark.asyncio
async def test_mt5_rejects_future_and_invalid_price_data(client: AsyncClient) -> None:
    future = datetime.now(UTC) + timedelta(hours=1)
    response = await client.post(
        "/api/v1/mt5/candles/batch",
        headers=HEADERS,
        json={
            "terminal_id": TERMINAL_ID,
            "sent_at": now_iso(),
            "candles": [
                {
                    "symbol": "EURUSD",
                    "timeframe": "H1",
                    "open_time": future.isoformat(),
                    "open": "1.08",
                    "high": "1.07",
                    "low": "1.09",
                    "close": "1.08",
                    "volume": "100",
                }
            ],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
