from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True, slots=True)
class DatabaseTableStats:
    name: str
    row_count: int


@dataclass(frozen=True, slots=True)
class CandleDatasetStats:
    symbol_id: UUID
    symbol: str
    timeframe: str
    source: str
    candle_count: int
    first_at: datetime
    last_at: datetime


@dataclass(frozen=True, slots=True)
class DatabaseOverview:
    connected: bool
    read_only: bool
    engine: str
    database_name: str
    server_version: str
    schema_revision: str | None
    database_size_bytes: int | None
    server_time: datetime
    tables: tuple[DatabaseTableStats, ...]
    candle_datasets: tuple[CandleDatasetStats, ...]


class DatabaseOverviewReader(Protocol):
    async def overview(self) -> DatabaseOverview: ...


class DatabaseAdminService:
    def __init__(self, reader: DatabaseOverviewReader) -> None:
        self._reader = reader

    async def overview(self) -> DatabaseOverview:
        return await self._reader.overview()
