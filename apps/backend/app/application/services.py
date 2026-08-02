from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from app.application.ports import (
    AccountRepository,
    CandleRepository,
    SymbolRepository,
    TradeRepository,
)
from app.domain.entities import Account, Candle, Symbol, Trade
from app.domain.enums import CandleSource, TradeSide, TradeStatus
from app.domain.exceptions import ConflictError, DomainError, NotFoundError


class SymbolService:
    def __init__(self, repository: SymbolRepository) -> None:
        self._repository = repository

    async def list(self) -> list[Symbol]:
        return await self._repository.list()

    async def get(self, symbol_id: UUID) -> Symbol:
        symbol = await self._repository.get(symbol_id)
        if symbol is None:
            raise NotFoundError("Symbol not found")
        return symbol

    async def create(self, name: str, description: str, digits: int, is_active: bool) -> Symbol:
        normalized_name = name.strip().upper()
        if await self._repository.get_by_name(normalized_name) is not None:
            raise ConflictError(f"Symbol {normalized_name} already exists")
        symbol = Symbol(uuid4(), normalized_name, description.strip(), digits, is_active)
        return await self._repository.add(symbol)

    async def update(
        self, symbol_id: UUID, name: str, description: str, digits: int, is_active: bool
    ) -> Symbol:
        existing = await self.get(symbol_id)
        normalized_name = name.strip().upper()
        duplicate = await self._repository.get_by_name(normalized_name)
        if duplicate is not None and duplicate.id != symbol_id:
            raise ConflictError(f"Symbol {normalized_name} already exists")
        return await self._repository.update(
            replace(
                existing,
                name=normalized_name,
                description=description.strip(),
                digits=digits,
                is_active=is_active,
            )
        )

    async def delete(self, symbol_id: UUID) -> None:
        await self.get(symbol_id)
        await self._repository.delete(symbol_id)


class CandleService:
    def __init__(self, repository: CandleRepository, symbols: SymbolRepository) -> None:
        self._repository = repository
        self._symbols = symbols

    async def list(self, symbol_id: UUID | None, limit: int) -> list[Candle]:
        return await self._repository.list(symbol_id, limit)

    async def save(
        self,
        symbol_id: UUID,
        timeframe: str,
        open_time: datetime,
        open_price: Decimal,
        high: Decimal,
        low: Decimal,
        close: Decimal,
        volume: Decimal,
        source: CandleSource = CandleSource.API,
    ) -> Candle:
        if await self._symbols.get(symbol_id) is None:
            raise NotFoundError("Symbol not found")
        if high < max(open_price, close) or low > min(open_price, close) or low > high:
            raise DomainError("Invalid OHLC price range")
        candle = Candle(
            uuid4(),
            symbol_id,
            timeframe.upper(),
            open_time,
            open_price,
            high,
            low,
            close,
            volume,
            source,
        )
        return await self._repository.add(candle)


class AccountService:
    def __init__(self, repository: AccountRepository) -> None:
        self._repository = repository

    async def list(self) -> list[Account]:
        return await self._repository.list()

    async def create(self, external_id: str, name: str, currency: str, balance: Decimal) -> Account:
        if await self._repository.get_by_external_id(external_id) is not None:
            raise ConflictError(f"Account {external_id} already exists")
        return await self._repository.add(
            Account(
                uuid4(),
                external_id,
                name.strip(),
                currency.upper(),
                balance,
                datetime.now(UTC),
            )
        )


class TradeService:
    def __init__(
        self,
        repository: TradeRepository,
        accounts: AccountRepository,
        symbols: SymbolRepository,
    ) -> None:
        self._repository = repository
        self._accounts = accounts
        self._symbols = symbols

    async def list(self, account_id: UUID | None, limit: int) -> list[Trade]:
        return await self._repository.list(account_id, limit)

    async def save(
        self,
        account_id: UUID,
        symbol_id: UUID,
        external_id: str,
        side: TradeSide,
        volume: Decimal,
        open_price: Decimal,
        close_price: Decimal | None,
        opened_at: datetime,
        closed_at: datetime | None,
        profit: Decimal,
        commission: Decimal,
        swap: Decimal,
        status: TradeStatus,
    ) -> Trade:
        if await self._accounts.get(account_id) is None:
            raise NotFoundError("Account not found")
        if await self._symbols.get(symbol_id) is None:
            raise NotFoundError("Symbol not found")
        if status == TradeStatus.CLOSED and (close_price is None or closed_at is None):
            raise DomainError("Closed trade requires close price and close time")
        trade = Trade(
            uuid4(),
            account_id,
            symbol_id,
            external_id,
            side,
            volume,
            open_price,
            close_price,
            opened_at,
            closed_at,
            profit,
            commission,
            swap,
            status,
        )
        return await self._repository.add(trade)
