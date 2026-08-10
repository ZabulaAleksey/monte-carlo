from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.mt5_auth import Mt5AuthDependency
from app.api.mt5_dependencies import Mt5SyncServiceDependency
from app.api.mt5_schemas import (
    Mt5AccountRequest,
    Mt5CandleCoverageRequest,
    Mt5CandlesRequest,
    Mt5HeartbeatRequest,
    Mt5PositionsRequest,
    Mt5QuotesRequest,
    Mt5StatusResponse,
    Mt5SymbolsRequest,
    Mt5TradesRequest,
    SyncResultResponse,
)
from app.application.mt5 import (
    AccountSyncCommand,
    CandleCoverageCommand,
    CandleSyncCommand,
    HeartbeatCommand,
    PositionSyncCommand,
    QuoteSyncCommand,
    SymbolSyncCommand,
    TradeSyncCommand,
)

router = APIRouter(tags=["mt5"])


@router.post("/heartbeat", response_model=SyncResultResponse)
async def heartbeat(
    payload: Mt5HeartbeatRequest,
    service: Mt5SyncServiceDependency,
    _auth: Mt5AuthDependency,
) -> SyncResultResponse:
    result = await service.heartbeat(HeartbeatCommand(**payload.model_dump()))
    return SyncResultResponse.model_validate(result, from_attributes=True)


@router.post("/account", response_model=SyncResultResponse)
async def account(
    payload: Mt5AccountRequest,
    service: Mt5SyncServiceDependency,
    _auth: Mt5AuthDependency,
) -> SyncResultResponse:
    result = await service.account(AccountSyncCommand(**payload.model_dump()))
    return SyncResultResponse.model_validate(result, from_attributes=True)


@router.post("/symbols", response_model=SyncResultResponse)
async def symbols(
    payload: Mt5SymbolsRequest,
    service: Mt5SyncServiceDependency,
    _auth: Mt5AuthDependency,
) -> SyncResultResponse:
    commands = [SymbolSyncCommand(**item.model_dump()) for item in payload.symbols]
    result = await service.symbols(payload.terminal_id, commands)
    return SyncResultResponse.model_validate(result, from_attributes=True)


@router.post("/candles/batch", response_model=SyncResultResponse)
async def candles(
    payload: Mt5CandlesRequest,
    service: Mt5SyncServiceDependency,
    _auth: Mt5AuthDependency,
) -> SyncResultResponse:
    commands = [CandleSyncCommand(**item.model_dump()) for item in payload.candles]
    result = await service.candles(payload.terminal_id, commands)
    return SyncResultResponse.model_validate(result, from_attributes=True)


@router.post("/candles/coverage", response_model=SyncResultResponse)
async def candle_coverage(
    payload: Mt5CandleCoverageRequest,
    service: Mt5SyncServiceDependency,
    _auth: Mt5AuthDependency,
) -> SyncResultResponse:
    command = CandleCoverageCommand(
        symbol=payload.symbol,
        timeframe=payload.timeframe,
        covered_start=payload.covered_start,
        covered_end=payload.covered_end,
        expected_candles=payload.expected_candles,
    )
    result = await service.candle_coverage(payload.terminal_id, command)
    return SyncResultResponse.model_validate(result, from_attributes=True)


@router.post("/quotes", response_model=SyncResultResponse)
async def quotes(
    payload: Mt5QuotesRequest,
    service: Mt5SyncServiceDependency,
    _auth: Mt5AuthDependency,
) -> SyncResultResponse:
    commands = [QuoteSyncCommand(**item.model_dump()) for item in payload.quotes]
    result = await service.quotes(payload.terminal_id, commands)
    return SyncResultResponse.model_validate(result, from_attributes=True)


@router.post("/positions", response_model=SyncResultResponse)
async def positions(
    payload: Mt5PositionsRequest,
    service: Mt5SyncServiceDependency,
    _auth: Mt5AuthDependency,
) -> SyncResultResponse:
    commands = [PositionSyncCommand(**item.model_dump()) for item in payload.positions]
    result = await service.positions(payload.terminal_id, payload.account_external_id, commands)
    return SyncResultResponse.model_validate(result, from_attributes=True)


@router.post("/trades/batch", response_model=SyncResultResponse)
async def trades(
    payload: Mt5TradesRequest,
    service: Mt5SyncServiceDependency,
    _auth: Mt5AuthDependency,
) -> SyncResultResponse:
    commands = [TradeSyncCommand(**item.model_dump()) for item in payload.trades]
    result = await service.trades(payload.terminal_id, payload.account_external_id, commands)
    return SyncResultResponse.model_validate(result, from_attributes=True)


@router.get("/status", response_model=Mt5StatusResponse)
async def connection_status(
    service: Mt5SyncServiceDependency,
    terminal_id: str | None = Query(default=None, max_length=128),
) -> Mt5StatusResponse:
    result = await service.status(terminal_id)
    return Mt5StatusResponse.model_validate(result, from_attributes=True)
