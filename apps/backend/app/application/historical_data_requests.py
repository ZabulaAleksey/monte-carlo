from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from app.application.ports import SymbolRepository
from app.domain.entities import HistoricalDataRequest, Symbol
from app.domain.exceptions import DomainError, NotFoundError


class HistoricalDataRequestGateway(Protocol):
    async def enqueue(
        self,
        symbol: Symbol,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> HistoricalDataRequest: ...

    async def get(self, request_id: UUID) -> HistoricalDataRequest | None: ...

    async def claim(self, terminal_id: str) -> HistoricalDataRequest | None: ...

    async def complete(
        self,
        request_id: UUID,
        terminal_id: str,
        candle_count: int,
        covered_start: datetime,
        covered_end: datetime,
    ) -> HistoricalDataRequest: ...

    async def fail(
        self,
        request_id: UUID,
        terminal_id: str,
        error: str,
    ) -> HistoricalDataRequest: ...


class HistoricalDataRequestService:
    def __init__(
        self,
        gateway: HistoricalDataRequestGateway,
        symbols: SymbolRepository,
    ) -> None:
        self._gateway = gateway
        self._symbols = symbols

    async def request(
        self,
        symbol_id: UUID,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> HistoricalDataRequest:
        if start_at.utcoffset() is None or end_at.utcoffset() is None:
            raise DomainError("Historical request timestamps must include a timezone")
        start_at = start_at.astimezone(UTC)
        end_at = end_at.astimezone(UTC)
        if start_at >= end_at:
            raise DomainError("Historical request start must precede end")
        symbol = await self._symbols.get(symbol_id)
        if symbol is None:
            raise NotFoundError("Symbol not found")
        return await self._gateway.enqueue(
            symbol,
            timeframe.strip().upper(),
            start_at,
            end_at,
        )

    async def get(self, request_id: UUID) -> HistoricalDataRequest:
        request = await self._gateway.get(request_id)
        if request is None:
            raise NotFoundError("Historical data request not found")
        return request

    async def claim(self, terminal_id: str) -> HistoricalDataRequest | None:
        return await self._gateway.claim(terminal_id)

    async def complete(
        self,
        request_id: UUID,
        terminal_id: str,
        candle_count: int,
        covered_start: datetime,
        covered_end: datetime,
    ) -> HistoricalDataRequest:
        if covered_start > covered_end:
            raise DomainError("Covered range start cannot exceed end")
        return await self._gateway.complete(
            request_id,
            terminal_id,
            candle_count,
            covered_start,
            covered_end,
        )

    async def fail(
        self,
        request_id: UUID,
        terminal_id: str,
        error: str,
    ) -> HistoricalDataRequest:
        return await self._gateway.fail(request_id, terminal_id, error.strip())
