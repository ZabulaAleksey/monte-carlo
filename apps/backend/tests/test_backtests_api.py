import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.backtest_dependencies import (
    get_backtest_job_manager,
    get_backtest_service,
)
from app.application.backtest_jobs import BacktestJobManager
from app.application.backtesting import BacktestRunRequest
from app.domain.backtesting.interfaces import BacktestControl
from app.domain.backtesting.models import StoredBacktestResult
from app.main import app
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
    assert strategies.json()[0]["version"] == "1.2.0"
    assert any(
        parameter["name"] == "position_size"
        and parameter["value_type"] == "decimal"
        for parameter in strategies.json()[0]["parameters"]
    )
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
    assert result["strategy_version"] == "1.2.0"
    assert result["settings"]["contract_size"] == "1.00000000"
    assert result["settings"]["swap_per_lot_per_day"] == "-0.10000000"
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

    other_payload = {**payload, "commission_per_fill": "2"}
    other = await client.post("/api/v1/backtests", json=other_payload)
    assert other.status_code == 201
    assert other.json()["trades"] != result["trades"]

    first_run_trades = await client.get(
        f"/api/v1/backtests/{result['id']}/trades"
    )
    other_run_trades = await client.get(
        f"/api/v1/backtests/{other.json()['id']}/trades"
    )
    assert first_run_trades.status_code == 200
    assert other_run_trades.status_code == 200
    assert first_run_trades.json() == result["trades"]
    assert other_run_trades.json() == other.json()["trades"]

    deleted = await client.delete(f"/api/v1/backtests/{result['id']}")
    assert deleted.status_code == 204
    missing = await client.get(f"/api/v1/backtests/{result['id']}")
    assert missing.status_code == 404
    missing_trades = await client.get(f"/api/v1/backtests/{result['id']}/trades")
    assert missing_trades.status_code == 404


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


@pytest.mark.asyncio
async def test_backtest_enforces_mt5_lot_minimum_and_step(client: AsyncClient) -> None:
    symbol_response = await client.post(
        "/api/v1/symbols",
        json={
            "name": "SP500",
            "description": "S&P 500",
            "digits": 1,
            "is_active": True,
            "volume_min": "0.1",
            "volume_step": "0.1",
            "volume_max": "99",
            "contract_size": "50",
        },
    )
    assert symbol_response.status_code == 201
    symbol = symbol_response.json()
    base_payload = {
        "strategy_name": "moving_average_cross",
        "symbol_id": symbol["id"],
        "timeframe": "H1",
        "start_at": "2026-01-01T00:00:00Z",
        "end_at": "2026-01-02T00:00:00Z",
        "parameters": {
            "short_window": 2,
            "long_window": 3,
            "position_size": "0.01",
        },
    }

    below_minimum = await client.post("/api/v1/backtests", json=base_payload)
    wrong_step = await client.post(
        "/api/v1/backtests",
        json={
            **base_payload,
            "parameters": {**base_payload["parameters"], "position_size": "0.15"},
        },
    )

    assert below_minimum.status_code == 400
    assert "between 0.10000000 and 99" in below_minimum.json()["error"]["message"]
    assert wrong_step.status_code == 400
    assert "0.10000000 lot step" in wrong_step.json()["error"]["message"]


@pytest.mark.asyncio
async def test_backtest_job_api_reports_progress_and_result(
    client: AsyncClient,
    session: AsyncSession,
) -> None:
    symbol = await create_symbol(client, "GBPUSD")
    start = datetime(2026, 2, 1, tzinfo=UTC)
    for index, close in enumerate(["5", "4", "3", "4", "5", "4", "3", "2"]):
        response = await client.post(
            "/api/v1/candles",
            json={
                "symbol_id": symbol["id"],
                "timeframe": "H1",
                "open_time": (start + timedelta(hours=index)).isoformat(),
                "open": close,
                "high": str(Decimal(close) + Decimal("0.2")),
                "low": str(Decimal(close) - Decimal("0.2")),
                "close": close,
                "volume": "100",
            },
        )
        assert response.status_code == 201

    async def runner(
        request: BacktestRunRequest,
        control: BacktestControl,
    ) -> StoredBacktestResult:
        return await get_backtest_service(session).run(request, control)

    manager = BacktestJobManager(runner)
    app.dependency_overrides[get_backtest_job_manager] = lambda: manager
    started = await client.post(
        "/api/v1/backtests/jobs",
        json={
            "strategy_name": "moving_average_cross",
            "symbol_id": symbol["id"],
            "timeframe": "H1",
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=7)).isoformat(),
            "parameters": {
                "short_window": 2,
                "long_window": 3,
                "position_size": "1",
                "stop_loss_pct": "1",
                "take_profit_pct": "2",
            },
        },
    )
    assert started.status_code == 202

    snapshot = started.json()
    for _ in range(100):
        status_response = await client.get(
            f"/api/v1/backtests/jobs/{snapshot['id']}"
        )
        assert status_response.status_code == 200
        snapshot = status_response.json()
        if snapshot["state"] in {"completed", "failed", "stopped"}:
            break
        await asyncio.sleep(0)

    assert snapshot["state"] == "completed", snapshot
    assert snapshot["progress_pct"] == "100.00"
    result = await client.get(f"/api/v1/backtests/{snapshot['result_id']}")
    assert result.status_code == 200
    assert result.json()["settings"]["position_size"] == "1.00000000"
