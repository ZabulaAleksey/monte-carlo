from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.api.dependencies import (
    AccountServiceDependency,
    CandleServiceDependency,
    SymbolServiceDependency,
    TradeServiceDependency,
)
from app.api.schemas import (
    AccountCreate,
    AccountResponse,
    CandleCreate,
    CandleResponse,
    InfoResponse,
    SymbolCreate,
    SymbolResponse,
    TradeCreate,
    TradeResponse,
)
from app.infrastructure.config import get_settings

router = APIRouter()


@router.get("/info", response_model=InfoResponse, tags=["system"])
async def info() -> InfoResponse:
    settings = get_settings()
    return InfoResponse(
        name=settings.app_name, version=settings.app_version, environment=settings.environment
    )


@router.get("/symbols", response_model=list[SymbolResponse], tags=["symbols"])
async def list_symbols(service: SymbolServiceDependency) -> list[SymbolResponse]:
    return [SymbolResponse.model_validate(item) for item in await service.list()]


@router.post(
    "/symbols", response_model=SymbolResponse, status_code=status.HTTP_201_CREATED, tags=["symbols"]
)
async def create_symbol(payload: SymbolCreate, service: SymbolServiceDependency) -> SymbolResponse:
    symbol = await service.create(**payload.model_dump())
    return SymbolResponse.model_validate(symbol)


@router.get("/symbols/{symbol_id}", response_model=SymbolResponse, tags=["symbols"])
async def get_symbol(symbol_id: UUID, service: SymbolServiceDependency) -> SymbolResponse:
    return SymbolResponse.model_validate(await service.get(symbol_id))


@router.put("/symbols/{symbol_id}", response_model=SymbolResponse, tags=["symbols"])
async def update_symbol(
    symbol_id: UUID, payload: SymbolCreate, service: SymbolServiceDependency
) -> SymbolResponse:
    symbol = await service.update(symbol_id, **payload.model_dump())
    return SymbolResponse.model_validate(symbol)


@router.delete("/symbols/{symbol_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["symbols"])
async def delete_symbol(symbol_id: UUID, service: SymbolServiceDependency) -> Response:
    await service.delete(symbol_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/candles", response_model=list[CandleResponse], tags=["market-data"])
async def list_candles(
    service: CandleServiceDependency,
    symbol_id: UUID | None = None,
    timeframe: str | None = Query(default=None, min_length=1, max_length=16),
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    limit: int = Query(default=200, ge=1, le=2000),
) -> list[CandleResponse]:
    candles = await service.list(symbol_id, limit, timeframe, start_at, end_at)
    return [CandleResponse.model_validate(item) for item in candles]


@router.post(
    "/candles",
    response_model=CandleResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["market-data"],
)
async def save_candle(payload: CandleCreate, service: CandleServiceDependency) -> CandleResponse:
    candle = await service.save(
        symbol_id=payload.symbol_id,
        timeframe=payload.timeframe,
        open_time=payload.open_time,
        open_price=payload.open,
        high=payload.high,
        low=payload.low,
        close=payload.close,
        volume=payload.volume,
    )
    return CandleResponse.model_validate(candle)


@router.get("/accounts", response_model=list[AccountResponse], tags=["accounts"])
async def list_accounts(service: AccountServiceDependency) -> list[AccountResponse]:
    return [AccountResponse.model_validate(item) for item in await service.list()]


@router.post(
    "/accounts",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["accounts"],
)
async def create_account(
    payload: AccountCreate, service: AccountServiceDependency
) -> AccountResponse:
    account = await service.create(**payload.model_dump())
    return AccountResponse.model_validate(account)


@router.get("/trades", response_model=list[TradeResponse], tags=["trades"])
async def list_trades(
    service: TradeServiceDependency,
    account_id: UUID | None = None,
    limit: int = Query(default=200, ge=1, le=2000),
) -> list[TradeResponse]:
    return [TradeResponse.model_validate(item) for item in await service.list(account_id, limit)]


@router.post(
    "/trades", response_model=TradeResponse, status_code=status.HTTP_201_CREATED, tags=["trades"]
)
async def save_trade(payload: TradeCreate, service: TradeServiceDependency) -> TradeResponse:
    trade = await service.save(**payload.model_dump())
    return TradeResponse.model_validate(trade)
