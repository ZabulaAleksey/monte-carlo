from datetime import UTC, datetime

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_closed_trade_validation_uses_error_envelope(client: AsyncClient) -> None:
    symbol_response = await client.post(
        "/api/v1/symbols",
        json={"name": "EURUSD", "description": "Euro / US Dollar", "digits": 5},
    )
    account_response = await client.post(
        "/api/v1/accounts",
        json={"external_id": "TEST-ERROR", "name": "Test account", "currency": "USD"},
    )

    response = await client.post(
        "/api/v1/trades",
        json={
            "account_id": account_response.json()["id"],
            "symbol_id": symbol_response.json()["id"],
            "external_id": "INVALID-001",
            "side": "buy",
            "volume": "0.1",
            "open_price": "1.08000",
            "opened_at": datetime.now(UTC).isoformat(),
            "status": "closed",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
