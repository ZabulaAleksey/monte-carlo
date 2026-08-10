from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DatabaseTableStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    row_count: int


class CandleDatasetStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    symbol_id: UUID
    symbol: str
    timeframe: str
    source: str
    candle_count: int
    first_at: datetime
    last_at: datetime


class DatabaseOverviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    connected: bool
    read_only: bool
    engine: str
    database_name: str
    server_version: str
    schema_revision: str | None
    database_size_bytes: int | None
    server_time: datetime
    tables: list[DatabaseTableStatsResponse]
    candle_datasets: list[CandleDatasetStatsResponse]
