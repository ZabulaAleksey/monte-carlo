from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID, uuid4

from app.application.backtesting import BacktestRunRequest
from app.domain.backtesting.interfaces import BacktestControl
from app.domain.backtesting.models import (
    BacktestJobSnapshot,
    BacktestJobState,
    StoredBacktestResult,
)
from app.domain.exceptions import NotFoundError

BacktestRunner = Callable[
    [BacktestRunRequest, BacktestControl], Awaitable[StoredBacktestResult]
]
TERMINAL_STATES = {
    BacktestJobState.COMPLETED,
    BacktestJobState.STOPPED,
    BacktestJobState.FAILED,
}


class BacktestStopped(Exception):
    pass


@dataclass(slots=True)
class _Job:
    id: UUID
    state: BacktestJobState
    stage: str
    processed_candles: int
    total_candles: int
    resume_event: asyncio.Event
    stop_requested: bool = False
    result_id: UUID | None = None
    error: str | None = None
    task: asyncio.Task[None] | None = None
    active_stage: str = "queued"


class _JobControl:
    def __init__(self, manager: BacktestJobManager, job_id: UUID) -> None:
        self._manager = manager
        self._job_id = job_id

    async def checkpoint(
        self, stage: str, completed: int = 0, total: int = 0
    ) -> None:
        await self._manager._checkpoint(self._job_id, stage, completed, total)


class BacktestJobManager:
    def __init__(self, runner: BacktestRunner, maximum_jobs: int = 100) -> None:
        self._runner = runner
        self._maximum_jobs = maximum_jobs
        self._jobs: dict[UUID, _Job] = {}

    def start(self, request: BacktestRunRequest) -> BacktestJobSnapshot:
        self._prune()
        job_id = uuid4()
        resume_event = asyncio.Event()
        resume_event.set()
        job = _Job(
            id=job_id,
            state=BacktestJobState.QUEUED,
            stage="queued",
            processed_candles=0,
            total_candles=0,
            resume_event=resume_event,
        )
        self._jobs[job_id] = job
        job.task = asyncio.create_task(self._execute(job, request))
        return self._snapshot(job)

    def get(self, job_id: UUID) -> BacktestJobSnapshot:
        return self._snapshot(self._get(job_id))

    def pause(self, job_id: UUID) -> BacktestJobSnapshot:
        job = self._get(job_id)
        if job.state not in TERMINAL_STATES and job.state != BacktestJobState.PAUSED:
            job.resume_event.clear()
            job.active_stage = job.stage
            job.state = BacktestJobState.PAUSED
            job.stage = "paused"
        return self._snapshot(job)

    def resume(self, job_id: UUID) -> BacktestJobSnapshot:
        job = self._get(job_id)
        if job.state == BacktestJobState.PAUSED:
            job.stage = job.active_stage
            job.state = self._state_for_stage(job.active_stage)
            job.resume_event.set()
        return self._snapshot(job)

    def stop(self, job_id: UUID) -> BacktestJobSnapshot:
        job = self._get(job_id)
        if job.state not in TERMINAL_STATES:
            job.stop_requested = True
            job.state = BacktestJobState.STOPPED
            job.stage = "stopped"
            job.resume_event.set()
        return self._snapshot(job)

    async def _execute(self, job: _Job, request: BacktestRunRequest) -> None:
        try:
            stored = await self._runner(request, _JobControl(self, job.id))
        except BacktestStopped:
            job.state = BacktestJobState.STOPPED
            job.stage = "stopped"
        except Exception as exc:
            job.state = BacktestJobState.FAILED
            job.stage = "failed"
            job.error = str(exc)
        else:
            if job.stop_requested:
                job.state = BacktestJobState.STOPPED
                job.stage = "stopped"
                return
            job.state = BacktestJobState.COMPLETED
            job.stage = "completed"
            job.processed_candles = job.total_candles
            job.result_id = stored.id

    async def _checkpoint(
        self, job_id: UUID, stage: str, completed: int, total: int
    ) -> None:
        job = self._get(job_id)
        if job.stop_requested:
            raise BacktestStopped
        job.active_stage = stage
        if job.state != BacktestJobState.PAUSED:
            job.stage = stage
            job.state = self._state_for_stage(stage)
        job.processed_candles = max(completed, 0)
        job.total_candles = max(total, 0)
        await job.resume_event.wait()
        if job.stop_requested:
            raise BacktestStopped
        await asyncio.sleep(0)

    def _get(self, job_id: UUID) -> _Job:
        job = self._jobs.get(job_id)
        if job is None:
            raise NotFoundError("Backtest job not found")
        return job

    def _prune(self) -> None:
        if len(self._jobs) < self._maximum_jobs:
            return
        for job_id, job in tuple(self._jobs.items()):
            if job.state in TERMINAL_STATES:
                self._jobs.pop(job_id)
                if len(self._jobs) < self._maximum_jobs:
                    return

    @staticmethod
    def _state_for_stage(stage: str) -> BacktestJobState:
        if stage == "loading_data":
            return BacktestJobState.LOADING_DATA
        return BacktestJobState.SIMULATING

    @staticmethod
    def _snapshot(job: _Job) -> BacktestJobSnapshot:
        progress = (
            Decimal(job.processed_candles) / Decimal(job.total_candles) * Decimal("100")
            if job.total_candles
            else Decimal("0")
        )
        return BacktestJobSnapshot(
            id=job.id,
            state=job.state,
            stage=job.stage,
            progress_pct=progress.quantize(Decimal("0.01")),
            processed_candles=job.processed_candles,
            total_candles=job.total_candles,
            result_id=job.result_id,
            error=job.error,
        )
