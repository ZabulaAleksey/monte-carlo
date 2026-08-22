# MonteCarlo Tester API

The framework-independent tester API is available at `/api/v1/tester/backtests`.

## Coverage

`GET /api/v1/tester/backtests/history/coverage?symbol_id={uuid}&timeframe=H1&start_at={iso}&end_at={iso}`

Inspect `complete`, `candle_count`, `cached_intervals`, and `missing_intervals`
before starting a test.

When coverage is incomplete, queue an exact read-only request for the connected
MT5 terminal:

```http
POST /api/v1/tester/backtests/history/requests
Content-Type: application/json

{
  "symbol_id": "00000000-0000-0000-0000-000000000000",
  "timeframe": "H1",
  "start_at": "2026-01-01T00:00:00Z",
  "end_at": "2026-02-01T00:00:00Z"
}
```

The `202` response has a request `id` and a `pending`, `claimed`, `completed`,
or `failed` state. Poll
`GET /api/v1/tester/backtests/history/requests/{request_id}`, then recheck
coverage because broker history may cover only part of the requested period.

## Run a backtest

```http
POST /api/v1/tester/backtests
Content-Type: application/json

{
  "strategy_name": "moving_average_cross",
  "symbol_id": "00000000-0000-0000-0000-000000000000",
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

With `allow_partial_data=true`, the engine uses the largest confirmed continuous
interval when the requested range is incomplete. The response returns
`data_complete=false`, the actual `data_start`/`data_end`, and `warnings`.

## Background execution

- `POST /api/v1/tester/backtests/jobs`
- `GET /api/v1/tester/backtests/jobs/{job_id}`
- `POST /api/v1/tester/backtests/jobs/{job_id}/pause`
- `POST /api/v1/tester/backtests/jobs/{job_id}/resume`
- `POST /api/v1/tester/backtests/jobs/{job_id}/stop`

## Results

- `GET /api/v1/tester/backtests`
- `GET /api/v1/tester/backtests/{run_id}`
- `GET /api/v1/tester/backtests/{run_id}/trades`
- `DELETE /api/v1/tester/backtests/{run_id}`

OpenAPI UI: `/docs`. OpenAPI schema: `/openapi.json`.
