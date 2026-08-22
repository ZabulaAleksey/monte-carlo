TESTER_API_DOCUMENTATION = """# MonteCarlo Tester API

The tester API is independent from the website and is available under
`/api/v1/tester/backtests`.

## Before a run

Check the historical range:

```http
GET /api/v1/tester/backtests/history/coverage
    ?symbol_id=<uuid>&timeframe=H1&start_at=<iso>&end_at=<iso>
```

The response includes `complete`, `candle_count`, `cached_intervals` and
`missing_intervals`.

If coverage is incomplete, queue an exact read request for the connected MT5
terminal:

```http
POST /api/v1/tester/backtests/history/requests
Content-Type: application/json

{
  "symbol_id": "<uuid>",
  "timeframe": "H1",
  "start_at": "2026-01-01T00:00:00Z",
  "end_at": "2026-02-01T00:00:00Z"
}
```

Poll `GET /api/v1/tester/backtests/history/requests/{request_id}` until its
state is `completed` or `failed`, then check coverage again. Broker history may
cover only part of the requested period.

## Synchronous run

```http
POST /api/v1/tester/backtests
Content-Type: application/json

{
  "strategy_name": "moving_average_cross",
  "symbol_id": "<uuid>",
  "timeframe": "H1",
  "start_at": "2026-01-01T00:00:00Z",
  "end_at": "2026-02-01T00:00:00Z",
  "initial_capital": "10000",
  "commission_pct_per_fill": "0.002",
  "swap_pct_per_lot_per_day": "-0.001",
  "slippage_points": "2",
  "allow_partial_data": true,
  "parameters": {
    "short_window": 5,
    "long_window": 20,
    "position_size": "0.10",
    "stop_loss_pct": "1",
    "take_profit_pct": "2"
  }
}
```

When `allow_partial_data=true` and the requested range is incomplete, the
engine uses the largest confirmed continuous interval. The response keeps the
original requested dates, returns the actual `data_start`/`data_end`, sets
`data_complete=false` and includes `warnings`.

## Background jobs

- `POST /api/v1/tester/backtests/jobs`
- `GET /api/v1/tester/backtests/jobs/{job_id}`
- `POST /api/v1/tester/backtests/jobs/{job_id}/pause`
- `POST /api/v1/tester/backtests/jobs/{job_id}/resume`
- `POST /api/v1/tester/backtests/jobs/{job_id}/stop`

## Stored results

- `GET /api/v1/tester/backtests`
- `GET /api/v1/tester/backtests/{run_id}`
- `GET /api/v1/tester/backtests/{run_id}/trades`
- `DELETE /api/v1/tester/backtests/{run_id}`

Prices, money, percentages and volume are serialized as decimal strings.
Timestamps use ISO 8601 with an explicit timezone. Interactive OpenAPI is
available at `/docs`; the machine-readable schema is `/openapi.json`.
"""
