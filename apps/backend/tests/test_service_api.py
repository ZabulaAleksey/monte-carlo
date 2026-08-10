from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from tests.test_trading_data import create_symbol


@pytest.mark.asyncio
async def test_database_overview_is_read_only_and_reports_cached_data(
    client: AsyncClient,
) -> None:
    symbol = await create_symbol(client, "DBVIEW")
    candle = await client.post(
        "/api/v1/candles",
        json={
            "symbol_id": symbol["id"],
            "timeframe": "H1",
            "open_time": datetime(2026, 1, 1, tzinfo=UTC).isoformat(),
            "open": "1",
            "high": "2",
            "low": "0.5",
            "close": "1.5",
            "volume": "10",
        },
    )
    assert candle.status_code == 201

    response = await client.get("/api/v1/database/overview")

    assert response.status_code == 200, response.text
    overview = response.json()
    assert overview["connected"] is True
    assert overview["read_only"] is True
    assert overview["engine"] == "sqlite"
    assert next(
        table["row_count"]
        for table in overview["tables"]
        if table["name"] == "candles"
    ) == 1
    assert overview["candle_datasets"][0]["symbol"] == "DBVIEW"
    assert overview["candle_datasets"][0]["candle_count"] == 1


@pytest.mark.asyncio
async def test_tester_documentation_is_downloadable(client: AsyncClient) -> None:
    response = await client.get("/api/v1/tester/documentation")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert "attachment" in response.headers["content-disposition"]
    assert "allow_partial_data" in response.text
