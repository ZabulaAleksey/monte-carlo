from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import Select

from app.domain.entities import HistoricalDataRequest, Symbol
from app.domain.enums import CandleSource, HistoricalDataRequestState
from app.domain.exceptions import (
    ConflictError,
    NotFoundError,
    SynchronizationError,
)
from app.infrastructure.database.backtesting import SqlAlchemyHistoricalDataProvider
from app.infrastructure.database.models import (
    CandleModel,
    HistoricalDataRequestModel,
)

ACTIVE_STATES = (
    HistoricalDataRequestState.PENDING.value,
    HistoricalDataRequestState.CLAIMED.value,
)
CLAIM_LEASE = timedelta(minutes=15)


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _entity(model: HistoricalDataRequestModel) -> HistoricalDataRequest:
    return HistoricalDataRequest(
        id=model.id,
        symbol_id=model.symbol_id,
        symbol=model.symbol.name,
        timeframe=model.timeframe,
        requested_start=_utc(model.requested_start),
        requested_end=_utc(model.requested_end),
        status=HistoricalDataRequestState(model.status),
        requested_at=_utc(model.requested_at),
        claimed_at=_utc(model.claimed_at) if model.claimed_at else None,
        completed_at=_utc(model.completed_at) if model.completed_at else None,
        terminal_id=model.terminal_id,
        candle_count=model.candle_count,
        error=model.error,
    )


class SqlAlchemyHistoricalDataRequestGateway:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _base_query(self) -> Select[tuple[HistoricalDataRequestModel]]:
        return select(HistoricalDataRequestModel).options(
            selectinload(HistoricalDataRequestModel.symbol)
        )

    async def enqueue(
        self,
        symbol: Symbol,
        timeframe: str,
        start_at: datetime,
        end_at: datetime,
    ) -> HistoricalDataRequest:
        normalized = timeframe.upper()
        existing = await self._session.scalar(
            self._base_query().where(
                HistoricalDataRequestModel.symbol_id == symbol.id,
                HistoricalDataRequestModel.timeframe == normalized,
                HistoricalDataRequestModel.requested_start == start_at,
                HistoricalDataRequestModel.requested_end == end_at,
                HistoricalDataRequestModel.status.in_(ACTIVE_STATES),
            )
        )
        if existing is not None:
            return _entity(existing)

        model = HistoricalDataRequestModel(
            id=uuid4(),
            symbol_id=symbol.id,
            timeframe=normalized,
            requested_start=start_at,
            requested_end=end_at,
            status=HistoricalDataRequestState.PENDING.value,
            requested_at=datetime.now(UTC),
            candle_count=0,
        )
        self._session.add(model)
        try:
            await self._session.commit()
        except IntegrityError:
            await self._session.rollback()
            concurrent = await self._session.scalar(
                self._base_query().where(
                    HistoricalDataRequestModel.symbol_id == symbol.id,
                    HistoricalDataRequestModel.timeframe == normalized,
                    HistoricalDataRequestModel.requested_start == start_at,
                    HistoricalDataRequestModel.requested_end == end_at,
                    HistoricalDataRequestModel.status.in_(ACTIVE_STATES),
                )
            )
            if concurrent is None:
                raise
            return _entity(concurrent)
        return await self._required(model.id)

    async def get(self, request_id: UUID) -> HistoricalDataRequest | None:
        model = await self._session.scalar(
            self._base_query().where(HistoricalDataRequestModel.id == request_id)
        )
        return _entity(model) if model else None

    async def claim(self, terminal_id: str) -> HistoricalDataRequest | None:
        now = datetime.now(UTC)
        model = await self._session.scalar(
            self._base_query()
            .where(
                or_(
                    HistoricalDataRequestModel.status
                    == HistoricalDataRequestState.PENDING.value,
                    and_(
                        HistoricalDataRequestModel.status
                        == HistoricalDataRequestState.CLAIMED.value,
                        or_(
                            HistoricalDataRequestModel.terminal_id == terminal_id,
                            HistoricalDataRequestModel.lease_expires_at < now,
                        ),
                    ),
                )
            )
            .order_by(HistoricalDataRequestModel.requested_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if model is None:
            return None
        model.status = HistoricalDataRequestState.CLAIMED.value
        model.terminal_id = terminal_id
        model.claimed_at = model.claimed_at or now
        model.lease_expires_at = now + CLAIM_LEASE
        model.error = None
        await self._commit("claim historical data request")
        return await self._required(model.id)

    async def complete(
        self,
        request_id: UUID,
        terminal_id: str,
        candle_count: int,
        covered_start: datetime,
        covered_end: datetime,
    ) -> HistoricalDataRequest:
        model = await self._locked(request_id)
        if model.status == HistoricalDataRequestState.COMPLETED.value:
            return await self._required(request_id)
        self._require_claim(model, terminal_id)
        start_at = max(_utc(model.requested_start), covered_start)
        end_at = min(_utc(model.requested_end), covered_end)
        if start_at > end_at:
            raise ConflictError("Reported candle range does not overlap the request")
        stored_count = int(
            await self._session.scalar(
                select(func.count())
                .select_from(CandleModel)
                .where(
                    CandleModel.symbol_id == model.symbol_id,
                    CandleModel.timeframe == model.timeframe,
                    CandleModel.open_time >= start_at,
                    CandleModel.open_time <= end_at,
                    CandleModel.source == CandleSource.MT5.value,
                )
            )
            or 0
        )
        if stored_count < candle_count:
            raise SynchronizationError(
                "Historical request cannot complete before its candles are stored"
            )

        provider = SqlAlchemyHistoricalDataProvider(self._session)
        await provider.record_coverage(
            model.symbol_id,
            model.timeframe,
            start_at,
            end_at,
            CandleSource.MT5.value,
        )
        model = await self._locked(request_id)
        model.status = HistoricalDataRequestState.COMPLETED.value
        model.completed_at = datetime.now(UTC)
        model.lease_expires_at = None
        model.candle_count = candle_count
        model.error = None
        await self._commit("complete historical data request")
        return await self._required(request_id)

    async def fail(
        self,
        request_id: UUID,
        terminal_id: str,
        error: str,
    ) -> HistoricalDataRequest:
        model = await self._locked(request_id)
        if model.status == HistoricalDataRequestState.FAILED.value:
            return await self._required(request_id)
        self._require_claim(model, terminal_id)
        model.status = HistoricalDataRequestState.FAILED.value
        model.completed_at = datetime.now(UTC)
        model.lease_expires_at = None
        model.error = error[:1000]
        await self._commit("fail historical data request")
        return await self._required(request_id)

    async def _locked(self, request_id: UUID) -> HistoricalDataRequestModel:
        model = await self._session.scalar(
            select(HistoricalDataRequestModel)
            .where(HistoricalDataRequestModel.id == request_id)
            .with_for_update()
        )
        if model is None:
            raise NotFoundError("Historical data request not found")
        return model

    async def _required(self, request_id: UUID) -> HistoricalDataRequest:
        model = await self._session.scalar(
            self._base_query().where(HistoricalDataRequestModel.id == request_id)
        )
        if model is None:
            raise NotFoundError("Historical data request not found")
        return _entity(model)

    @staticmethod
    def _require_claim(model: HistoricalDataRequestModel, terminal_id: str) -> None:
        if (
            model.status != HistoricalDataRequestState.CLAIMED.value
            or model.terminal_id != terminal_id
        ):
            raise ConflictError("Historical data request is not claimed by this terminal")

    async def _commit(self, operation: str) -> None:
        try:
            await self._session.commit()
        except SQLAlchemyError as exc:
            await self._session.rollback()
            raise SynchronizationError(f"Could not {operation}") from exc
