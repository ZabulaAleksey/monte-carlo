from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities import Account, Candle, Symbol, Trade
from app.domain.enums import CandleSource, TradeSide, TradeStatus
from app.infrastructure.database.models import AccountModel, CandleModel, SymbolModel, TradeModel


def _symbol(model: SymbolModel) -> Symbol:
    return Symbol(model.id, model.name, model.description, model.digits, model.is_active)


def _candle(model: CandleModel) -> Candle:
    return Candle(
        model.id,
        model.symbol_id,
        model.timeframe,
        model.open_time,
        model.open,
        model.high,
        model.low,
        model.close,
        model.volume,
        CandleSource(model.source),
    )


def _account(model: AccountModel) -> Account:
    return Account(
        model.id, model.external_id, model.name, model.currency, model.balance, model.created_at
    )


def _trade(model: TradeModel) -> Trade:
    return Trade(
        model.id,
        model.account_id,
        model.symbol_id,
        model.external_id,
        TradeSide(model.side),
        model.volume,
        model.open_price,
        model.close_price,
        model.opened_at,
        model.closed_at,
        model.profit,
        model.commission,
        model.swap,
        TradeStatus(model.status),
    )


class SqlAlchemySymbolRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> list[Symbol]:
        result = await self._session.scalars(select(SymbolModel).order_by(SymbolModel.name))
        return [_symbol(item) for item in result.all()]

    async def get(self, symbol_id: UUID) -> Symbol | None:
        model = await self._session.get(SymbolModel, symbol_id)
        return _symbol(model) if model else None

    async def get_by_name(self, name: str) -> Symbol | None:
        model = await self._session.scalar(select(SymbolModel).where(SymbolModel.name == name))
        return _symbol(model) if model else None

    async def add(self, symbol: Symbol) -> Symbol:
        self._session.add(
            SymbolModel(
                id=symbol.id,
                name=symbol.name,
                description=symbol.description,
                digits=symbol.digits,
                is_active=symbol.is_active,
            )
        )
        await self._session.commit()
        return symbol

    async def update(self, symbol: Symbol) -> Symbol:
        model = await self._session.get(SymbolModel, symbol.id)
        if model is not None:
            model.name = symbol.name
            model.description = symbol.description
            model.digits = symbol.digits
            model.is_active = symbol.is_active
            await self._session.commit()
        return symbol

    async def delete(self, symbol_id: UUID) -> None:
        await self._session.execute(delete(SymbolModel).where(SymbolModel.id == symbol_id))
        await self._session.commit()


class SqlAlchemyCandleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(
        self,
        symbol_id: UUID | None = None,
        limit: int = 200,
        timeframe: str | None = None,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
    ) -> list[Candle]:
        query = select(CandleModel).order_by(CandleModel.open_time.desc()).limit(limit)
        if symbol_id is not None:
            query = query.where(CandleModel.symbol_id == symbol_id)
        if timeframe is not None:
            query = query.where(CandleModel.timeframe == timeframe.upper())
        if start_at is not None:
            query = query.where(CandleModel.open_time >= start_at)
        if end_at is not None:
            query = query.where(CandleModel.open_time <= end_at)
        result = await self._session.scalars(query)
        return [_candle(item) for item in result.all()]

    async def add(self, candle: Candle) -> Candle:
        self._session.add(
            CandleModel(
                id=candle.id,
                symbol_id=candle.symbol_id,
                timeframe=candle.timeframe,
                open_time=candle.open_time,
                open=candle.open,
                high=candle.high,
                low=candle.low,
                close=candle.close,
                volume=candle.volume,
                source=candle.source.value,
            )
        )
        await self._session.commit()
        return candle


class SqlAlchemyAccountRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> list[Account]:
        result = await self._session.scalars(select(AccountModel).order_by(AccountModel.name))
        return [_account(item) for item in result.all()]

    async def get(self, account_id: UUID) -> Account | None:
        model = await self._session.get(AccountModel, account_id)
        return _account(model) if model else None

    async def get_by_external_id(self, external_id: str) -> Account | None:
        model = await self._session.scalar(
            select(AccountModel).where(AccountModel.external_id == external_id)
        )
        return _account(model) if model else None

    async def add(self, account: Account) -> Account:
        self._session.add(
            AccountModel(
                id=account.id,
                external_id=account.external_id,
                name=account.name,
                currency=account.currency,
                balance=account.balance,
                created_at=account.created_at,
            )
        )
        await self._session.commit()
        return account


class SqlAlchemyTradeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self, account_id: UUID | None = None, limit: int = 200) -> list[Trade]:
        query = select(TradeModel).order_by(TradeModel.opened_at.desc()).limit(limit)
        if account_id is not None:
            query = query.where(TradeModel.account_id == account_id)
        result = await self._session.scalars(query)
        return [_trade(item) for item in result.all()]

    async def add(self, trade: Trade) -> Trade:
        self._session.add(
            TradeModel(
                id=trade.id,
                account_id=trade.account_id,
                symbol_id=trade.symbol_id,
                external_id=trade.external_id,
                side=trade.side.value,
                volume=trade.volume,
                open_price=trade.open_price,
                close_price=trade.close_price,
                opened_at=trade.opened_at,
                closed_at=trade.closed_at,
                profit=trade.profit,
                commission=trade.commission,
                swap=trade.swap,
                status=trade.status.value,
            )
        )
        await self._session.commit()
        return trade
