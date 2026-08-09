from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient

from tests.test_trading_data import create_symbol


@pytest.mark.asyncio
async def test_demo_strategy_run_is_persisted_with_trades_and_equity(
    client: AsyncClient,
) -> None:
    symbol = await create_symbol(client)
    start = datetime(2026, 1, 1, tzinfo=UTC)
    closes = ["5", "4", "3", "4", "5", "4", "3", "2"]
    for index, close in enumerate(closes):
        price = float(close)
        response = await client.post(
            "/api/v1/candles",
            json={
                "symbol_id": symbol["id"],
                "timeframe": "H1",
                "open_time": (start + timedelta(hours=index)).isoformat(),
                "open": close,
                "high": str(price + 0.2),
                "low": str(price - 0.2),
                "close": close,
                "volume": "100",
            },
        )
        assert response.status_code == 201

    strategies = await client.get("/api/v1/backtests/strategies")
    assert strategies.status_code == 200
    assert strategies.json()[0]["name"] == "moving_average_cross"
    assert "not presented as profitable" in strategies.json()[0]["description"]

    payload = {
        "strategy_name": "moving_average_cross",
        "symbol_id": symbol["id"],
        "timeframe": "H1",
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=7)).isoformat(),
        "initial_capital": "1000",
        "position_size": "1",
        "stop_loss_pct": None,
        "take_profit_pct": None,
        "commission_per_fill": "0.1",
        "swap_per_day": "-0.1",
        "slippage_mode": "fixed",
        "slippage_value": "0",
        "parameters": {"short_window": 2, "long_window": 3},
    }
    created = await client.post("/api/v1/backtests", json=payload)
    assert created.status_code == 201, created.text
    result = created.json()
    assert result["strategy_version"] == "1.0.0"
    assert result["candle_count"] == 8
    assert len(result["trades"]) == 2
    assert len(result["equity_curve"]) == 8
    assert all(not Decimal(trade["swap"]).is_signed() for trade in result["trades"])

    listed = await client.get("/api/v1/backtests")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == result["id"]
    assert listed.json()[0]["total_trades"] == 2

    fetched = await client.get(f"/api/v1/backtests/{result['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == result

    trades = await client.get(f"/api/v1/backtests/{result['id']}/trades")
    assert trades.status_code == 200
    assert trades.json() == fetched.json()["trades"]

    repeated = await client.post("/api/v1/backtests", json=payload)
    assert repeated.status_code == 201
    assert repeated.json()["metrics"] == result["metrics"]
    assert repeated.json()["trades"] == result["trades"]


@pytest.mark.asyncio
async def test_backtest_rejects_range_without_candles(client: AsyncClient) -> None:
    symbol = await create_symbol(client, "XAUUSD")
    response = await client.post(
        "/api/v1/backtests",
        json={
            "strategy_name": "moving_average_cross",
            "symbol_id": symbol["id"],
            "timeframe": "H1",
            "start_at": "2026-01-01T00:00:00Z",
            "end_at": "2026-01-02T00:00:00Z",
            "parameters": {"short_window": 2, "long_window": 3},
        },
    )
    assert response.status_code == 400
    assert response.json()["error"]["message"] == (
        "No historical candles found for the requested range"
    )
