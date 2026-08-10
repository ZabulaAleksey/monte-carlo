from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Query, Response, status

from app.api.backtest_dependencies import (
    BacktestJobManagerDependency,
    BacktestServiceDependency,
)
from app.api.backtest_schemas import (
    BacktestCreate,
    BacktestJobResponse,
    BacktestMetricsResponse,
    BacktestResultResponse,
    BacktestRunSummaryResponse,
    BacktestSettingsResponse,
    EquityPointResponse,
    StrategyDefinitionResponse,
    VirtualTradeResponse,
)
from app.application.backtesting import BacktestRunRequest
from app.domain.backtesting.models import BacktestSettings, StoredBacktestResult

router = APIRouter(prefix="/backtests", tags=["backtests"])


def _run_request(payload: BacktestCreate) -> BacktestRunRequest:
    return BacktestRunRequest(
        strategy_name=payload.strategy_name,
        symbol_id=payload.symbol_id,
        timeframe=payload.timeframe,
        start_at=payload.start_at,
        end_at=payload.end_at,
        parameters=dict(payload.parameters),
        settings=BacktestSettings(
            initial_capital=payload.initial_capital,
            position_size=payload.position_size,
            contract_size=Decimal("1"),
            stop_loss_pct=payload.stop_loss_pct,
            take_profit_pct=payload.take_profit_pct,
            commission_per_fill=payload.commission_per_fill,
            swap_per_lot_per_day=payload.swap_per_lot_per_day,
            slippage_mode=payload.slippage_mode,
            slippage_value=payload.slippage_value,
        ),
    )


def _result_response(stored: StoredBacktestResult) -> BacktestResultResponse:
    result = stored.result
    return BacktestResultResponse(
        id=stored.id,
        created_at=stored.created_at,
        symbol_id=result.symbol_id,
        timeframe=result.timeframe,
        requested_start=result.requested_start,
        requested_end=result.requested_end,
        data_start=result.data_start,
        data_end=result.data_end,
        candle_count=result.candle_count,
        strategy_name=result.strategy_name,
        strategy_version=result.strategy_version,
        parameters=dict(result.parameters),
        settings=BacktestSettingsResponse.model_validate(result.settings),
        trades=[VirtualTradeResponse.model_validate(item) for item in result.trades],
        equity_curve=[
            EquityPointResponse.model_validate(item) for item in result.equity_curve
        ],
        metrics=BacktestMetricsResponse.model_validate(result.metrics),
    )


@router.get("/strategies", response_model=list[StrategyDefinitionResponse])
async def list_strategies(
    service: BacktestServiceDependency,
) -> list[StrategyDefinitionResponse]:
    return [
        StrategyDefinitionResponse.model_validate(strategy)
        for strategy in service.strategies()
    ]


@router.post(
    "",
    response_model=BacktestResultResponse,
    status_code=status.HTTP_201_CREATED,
)
async def run_backtest(
    payload: BacktestCreate,
    service: BacktestServiceDependency,
) -> BacktestResultResponse:
    stored = await service.run(_run_request(payload))
    return _result_response(stored)


@router.post(
    "/jobs",
    response_model=BacktestJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_backtest_job(
    payload: BacktestCreate,
    manager: BacktestJobManagerDependency,
) -> BacktestJobResponse:
    return BacktestJobResponse.model_validate(manager.start(_run_request(payload)))


@router.get("/jobs/{job_id}", response_model=BacktestJobResponse)
async def get_backtest_job(
    job_id: UUID, manager: BacktestJobManagerDependency
) -> BacktestJobResponse:
    return BacktestJobResponse.model_validate(manager.get(job_id))


@router.post("/jobs/{job_id}/pause", response_model=BacktestJobResponse)
async def pause_backtest_job(
    job_id: UUID, manager: BacktestJobManagerDependency
) -> BacktestJobResponse:
    return BacktestJobResponse.model_validate(manager.pause(job_id))


@router.post("/jobs/{job_id}/resume", response_model=BacktestJobResponse)
async def resume_backtest_job(
    job_id: UUID, manager: BacktestJobManagerDependency
) -> BacktestJobResponse:
    return BacktestJobResponse.model_validate(manager.resume(job_id))


@router.post("/jobs/{job_id}/stop", response_model=BacktestJobResponse)
async def stop_backtest_job(
    job_id: UUID, manager: BacktestJobManagerDependency
) -> BacktestJobResponse:
    return BacktestJobResponse.model_validate(manager.stop(job_id))


@router.get("", response_model=list[BacktestRunSummaryResponse])
async def list_backtests(
    service: BacktestServiceDependency,
    limit: int = Query(default=100, ge=1, le=200),
) -> list[BacktestRunSummaryResponse]:
    return [
        BacktestRunSummaryResponse.model_validate(item)
        for item in await service.list(limit)
    ]


@router.get("/{run_id}", response_model=BacktestResultResponse)
async def get_backtest(
    run_id: UUID, service: BacktestServiceDependency
) -> BacktestResultResponse:
    return _result_response(await service.get(run_id))


@router.get("/{run_id}/trades", response_model=list[VirtualTradeResponse])
async def get_backtest_trades(
    run_id: UUID, service: BacktestServiceDependency
) -> list[VirtualTradeResponse]:
    return [
        VirtualTradeResponse.model_validate(item)
        for item in await service.trades(run_id)
    ]


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backtest(
    run_id: UUID, service: BacktestServiceDependency
) -> Response:
    await service.delete(run_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
