from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import pytest

from app.application.backtest_jobs import BacktestJobManager
from app.application.backtesting import BacktestRunRequest
from app.domain.backtesting.interfaces import BacktestControl
from app.domain.backtesting.models import BacktestJobState, StoredBacktestResult


@pytest.mark.asyncio
async def test_job_can_be_paused_resumed_and_completed() -> None:
    simulation_started = asyncio.Event()
    result_id = uuid4()

    async def runner(
        request: BacktestRunRequest, control: BacktestControl
    ) -> StoredBacktestResult:
        del request
        await control.checkpoint("loading_data")
        await control.checkpoint("simulating", 0, 20)
        simulation_started.set()
        for index in range(1, 21):
            await control.checkpoint("simulating", index, 20)
        return cast(StoredBacktestResult, SimpleNamespace(id=result_id))

    manager = BacktestJobManager(runner)
    started = manager.start(cast(BacktestRunRequest, object()))
    await simulation_started.wait()

    paused = manager.pause(started.id)
    assert paused.state == BacktestJobState.PAUSED
    await asyncio.sleep(0)
    assert manager.get(started.id).state == BacktestJobState.PAUSED

    manager.resume(started.id)
    for _ in range(50):
        snapshot = manager.get(started.id)
        if snapshot.state == BacktestJobState.COMPLETED:
            break
        await asyncio.sleep(0)

    assert snapshot.state == BacktestJobState.COMPLETED
    assert snapshot.result_id == result_id
    assert snapshot.progress_pct == 100


@pytest.mark.asyncio
async def test_job_can_be_stopped_while_paused() -> None:
    simulation_started = asyncio.Event()

    async def runner(
        request: BacktestRunRequest, control: BacktestControl
    ) -> StoredBacktestResult:
        del request
        await control.checkpoint("simulating", 0, 100)
        simulation_started.set()
        for index in range(1, 101):
            await control.checkpoint("simulating", index, 100)
        return cast(StoredBacktestResult, SimpleNamespace(id=uuid4()))

    manager = BacktestJobManager(runner)
    started = manager.start(cast(BacktestRunRequest, object()))
    await simulation_started.wait()
    manager.pause(started.id)
    stopped = manager.stop(started.id)
    await asyncio.sleep(0)

    assert stopped.state == BacktestJobState.STOPPED
    assert manager.get(started.id).result_id is None
