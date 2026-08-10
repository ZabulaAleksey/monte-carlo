# API тестера

API тестера не зависит от frontend и доступен сторонним сервисам через
стабильный namespace `/api/v1/tester`. Те же контракты остаются доступны по
историческому пути `/api/v1/backtests`.

Интерактивная документация OpenAPI: `GET /docs`; машинная схема:
`GET /openapi.json`.

## Проверка исторического кэша

Перед запуском проверьте покрытие выбранного инструмента, таймфрейма и периода:

```http
GET /api/v1/tester/backtests/history/coverage
    ?symbol_id=<uuid>
    &timeframe=H1
    &start_at=2025-01-01T00:00:00Z
    &end_at=2025-01-31T23:00:00Z
```

Ответ содержит `complete`, количество сохранённых свечей,
`cached_intervals` и `missing_intervals`. Запуск разрешён только при
`complete=true`. Проверка повторяется внутри движка, поэтому клиентская
preflight-проверка не может создать race condition.

Свечи хранятся в PostgreSQL с уникальным ключом
`(symbol_id, timeframe, open_time)`. Перекрывающиеся и соседние подтверждённые
интервалы объединяются. При изменении дат backend переиспользует общую часть
уже сохранённого диапазона.

MT5 подтверждает покрытие автоматически после успешной отправки всех batch.
Другой доверенный загрузчик может сначала сохранить свечи через candle API,
затем подтвердить завершённый диапазон:

```http
PUT /api/v1/tester/backtests/history/coverage
Content-Type: application/json

{
  "symbol_id": "<uuid>",
  "timeframe": "H1",
  "start_at": "2025-01-01T00:00:00Z",
  "end_at": "2025-01-31T23:00:00Z"
}
```

Подтверждать следует только диапазон, полностью прочитанный исходным
провайдером. Рыночные выходные входят в подтверждённый интервал и не считаются
пропущенными свечами.

## Синхронный запуск

```http
POST /api/v1/tester/backtests
Content-Type: application/json

{
  "strategy_name": "moving_average_cross",
  "symbol_id": "<uuid>",
  "timeframe": "H1",
  "start_at": "2025-01-01T00:00:00Z",
  "end_at": "2025-01-31T23:00:00Z",
  "initial_capital": "10000",
  "commission_pct_per_fill": "0.002",
  "swap_pct_per_lot_per_day": "-0.001",
  "slippage_points": "3",
  "parameters": {
    "short_window": 5,
    "long_window": 20,
    "position_size": "0.10",
    "stop_loss_pct": "1",
    "take_profit_pct": "2"
  }
}
```

- `commission_pct_per_fill` — процент от номинала позиции за каждое
  исполнение: `price × lots × contract_size × percent / 100`.
- `swap_pct_per_lot_per_day` — подписанный дневной процент от номинала
  открытого лота; отрицательное значение является расходом.
- `slippage_points` — число пунктов. Размер пункта равен
  `10^-min(symbol.digits, 6)`.

Ответ `201` сразу содержит настройки, фактический диапазон, версию и параметры
стратегии, сделки, equity/drawdown points и итоговые метрики.

## Фоновый запуск

- `POST /api/v1/tester/backtests/jobs` — создать job, ответ `202`.
- `GET /api/v1/tester/backtests/jobs/{job_id}` — состояние и прогресс.
- `POST .../{job_id}/pause|resume|stop` — управление job.
- `GET /api/v1/tester/backtests/{run_id}` — полный сохранённый результат.
- `GET /api/v1/tester/backtests/{run_id}/trades` — сделки только этого run.
- `GET /api/v1/tester/backtests` — список сохранённых запусков.
- `DELETE /api/v1/tester/backtests/{run_id}` — удалить запуск.

Цены, денежные значения, проценты и объёмы сериализуются decimal-строками.
Времена передаются в ISO 8601 с часовым поясом.
