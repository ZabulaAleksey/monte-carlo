from __future__ import annotations

import logging
from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.mt5 import (
    AccountSyncCommand,
    CandleCoverageCommand,
    CandleSyncCommand,
    HeartbeatCommand,
    PositionSyncCommand,
    QuoteSyncCommand,
    SymbolSyncCommand,
    SyncResult,
    TerminalSnapshot,
    TradeSyncCommand,
)
from app.domain.enums import CandleSource
from app.domain.exceptions import NotFoundError, SynchronizationError
from app.infrastructure.database.backtesting import SqlAlchemyHistoricalDataProvider
from app.infrastructure.database.models import (
    AccountModel,
    CandleModel,
    MarketQuoteModel,
    Mt5TerminalModel,
    PositionModel,
    SymbolModel,
    TradeModel,
)

logger = logging.getLogger(__name__)


def _datetime_key(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


class SqlAlchemyMt5SyncGateway:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _commit(self, operation: str, terminal_id: str) -> None:
        try:
            await self._session.commit()
        except SQLAlchemyError as exc:
            await self._session.rollback()
            logger.exception(
                "MT5 synchronization database error",
                extra={"operation": operation, "terminal_id": terminal_id},
            )
            raise SynchronizationError("MT5 synchronization could not be saved") from exc

    async def _terminal(self, terminal_id: str) -> Mt5TerminalModel:
        terminal = await self._session.scalar(
            select(Mt5TerminalModel).where(Mt5TerminalModel.terminal_id == terminal_id)
        )
        if terminal is None:
            terminal = Mt5TerminalModel(
                id=uuid4(),
                terminal_id=terminal_id,
                terminal_name=terminal_id,
                terminal_build=0,
                created_at=datetime.now(UTC),
            )
            self._session.add(terminal)
        return terminal

    async def _touch_sync(
        self, terminal_id: str, account_external_id: str | None = None
    ) -> Mt5TerminalModel:
        terminal = await self._terminal(terminal_id)
        terminal.last_sync_at = datetime.now(UTC)
        if account_external_id is not None:
            terminal.account_external_id = account_external_id
        return terminal

    async def record_heartbeat(self, command: HeartbeatCommand) -> SyncResult:
        terminal = await self._terminal(command.terminal_id)
        created = int(terminal.terminal_build == 0 and terminal.last_heartbeat_at is None)
        terminal.terminal_name = command.terminal_name
        terminal.terminal_build = command.terminal_build
        terminal.account_external_id = command.account_external_id
        terminal.terminal_time = command.sent_at
        terminal.last_heartbeat_at = datetime.now(UTC)
        await self._commit("heartbeat", command.terminal_id)
        return SyncResult(1, created, 1 - created)

    async def upsert_account(self, command: AccountSyncCommand) -> SyncResult:
        await self._touch_sync(command.terminal_id, command.external_id)
        account = await self._session.scalar(
            select(AccountModel).where(AccountModel.external_id == command.external_id)
        )
        created = account is None
        if account is None:
            account = AccountModel(
                id=uuid4(),
                external_id=command.external_id,
                created_at=datetime.now(UTC),
            )
            self._session.add(account)
        account.name = command.name
        account.currency = command.currency.upper()
        account.balance = command.balance
        account.equity = command.equity
        account.margin = command.margin
        account.free_margin = command.free_margin
        account.leverage = command.leverage
        account.company = command.company
        account.server = command.server
        account.updated_at = command.sent_at
        await self._commit("account", command.terminal_id)
        return SyncResult(1, int(created), int(not created))

    async def upsert_symbols(
        self, terminal_id: str, commands: list[SymbolSyncCommand]
    ) -> SyncResult:
        await self._touch_sync(terminal_id)
        names = {command.name.strip().upper() for command in commands}
        result = await self._session.scalars(select(SymbolModel).where(SymbolModel.name.in_(names)))
        existing = {model.name: model for model in result.all()}
        created = 0
        updated = 0
        for command in commands:
            name = command.name.strip().upper()
            model = existing.get(name)
            if model is None:
                model = SymbolModel(id=uuid4(), name=name)
                self._session.add(model)
                existing[name] = model
                created += 1
            else:
                updated += 1
            model.description = command.description.strip()
            model.digits = command.digits
            model.is_active = command.is_active
            model.volume_min = command.volume_min
            model.volume_step = command.volume_step
            model.volume_max = min(command.volume_max, Decimal("99"))
            model.contract_size = command.contract_size
        await self._commit("symbols", terminal_id)
        return SyncResult(len(commands), created, updated)

    async def upsert_candles(
        self, terminal_id: str, commands: list[CandleSyncCommand]
    ) -> SyncResult:
        await self._touch_sync(terminal_id)
        symbol_names = {command.symbol.strip().upper() for command in commands}
        symbol_result = await self._session.scalars(
            select(SymbolModel).where(SymbolModel.name.in_(symbol_names))
        )
        symbols = {model.name: model for model in symbol_result.all()}
        missing = symbol_names.difference(symbols)
        if missing:
            raise NotFoundError(f"Unknown symbols: {', '.join(sorted(missing))}")

        keys = [
            (
                symbols[command.symbol.strip().upper()].id,
                command.timeframe.upper(),
                command.open_time,
            )
            for command in commands
        ]
        candle_result = await self._session.scalars(
            select(CandleModel).where(
                tuple_(
                    CandleModel.symbol_id,
                    CandleModel.timeframe,
                    CandleModel.open_time,
                ).in_(keys)
            )
        )
        existing = {
            (model.symbol_id, model.timeframe, _datetime_key(model.open_time)): model
            for model in candle_result.all()
        }
        created = 0
        updated = 0
        for command in commands:
            symbol_id = symbols[command.symbol.strip().upper()].id
            key = (
                symbol_id,
                command.timeframe.upper(),
                _datetime_key(command.open_time),
            )
            model = existing.get(key)
            if model is None:
                model = CandleModel(
                    id=uuid4(),
                    symbol_id=symbol_id,
                    timeframe=command.timeframe.upper(),
                    open_time=command.open_time,
                    source=CandleSource.MT5.value,
                )
                self._session.add(model)
                existing[key] = model
                created += 1
            else:
                updated += 1
            model.open = command.open
            model.high = command.high
            model.low = command.low
            model.close = command.close
            model.volume = command.volume
            model.source = CandleSource.MT5.value
        await self._commit("candles", terminal_id)
        return SyncResult(len(commands), created, updated)

    async def record_candle_coverage(
        self, terminal_id: str, command: CandleCoverageCommand
    ) -> SyncResult:
        await self._touch_sync(terminal_id)
        symbol_name = command.symbol.strip().upper()
        symbol = await self._session.scalar(
            select(SymbolModel).where(SymbolModel.name == symbol_name)
        )
        if symbol is None:
            raise NotFoundError(f"Unknown symbol: {symbol_name}")
        stored_count = int(
            await self._session.scalar(
                select(func.count())
                .select_from(CandleModel)
                .where(
                    CandleModel.symbol_id == symbol.id,
                    CandleModel.timeframe == command.timeframe.upper(),
                    CandleModel.open_time >= command.covered_start,
                    CandleModel.open_time <= command.covered_end,
                    CandleModel.source == CandleSource.MT5.value,
                )
            )
            or 0
        )
        if stored_count < command.expected_candles:
            raise SynchronizationError(
                "Historical candle coverage cannot be confirmed before all "
                "reported candles are stored"
            )
        provider = SqlAlchemyHistoricalDataProvider(self._session)
        await provider.record_coverage(
            symbol.id,
            command.timeframe,
            command.covered_start,
            command.covered_end,
            CandleSource.MT5.value,
        )
        await self._commit("candle_coverage", terminal_id)
        return SyncResult(stored_count, 0, 1)

    async def upsert_quotes(
        self, terminal_id: str, commands: list[QuoteSyncCommand]
    ) -> SyncResult:
        await self._touch_sync(terminal_id)
        symbol_names = {command.symbol.strip().upper() for command in commands}
        symbol_result = await self._session.scalars(
            select(SymbolModel).where(SymbolModel.name.in_(symbol_names))
        )
        symbols = {model.name: model for model in symbol_result.all()}
        missing = symbol_names.difference(symbols)
        if missing:
            raise NotFoundError(f"Unknown symbols: {', '.join(sorted(missing))}")

        symbol_ids = {model.id for model in symbols.values()}
        quote_result = await self._session.scalars(
            select(MarketQuoteModel).where(MarketQuoteModel.symbol_id.in_(symbol_ids))
        )
        existing = {model.symbol_id: model for model in quote_result.all()}
        now = datetime.now(UTC)
        created = 0
        updated = 0
        for command in commands:
            symbol_id = symbols[command.symbol.strip().upper()].id
            model = existing.get(symbol_id)
            if model is not None and _datetime_key(command.observed_at) < _datetime_key(
                model.observed_at
            ):
                continue
            if model is None:
                model = MarketQuoteModel(symbol_id=symbol_id)
                self._session.add(model)
                existing[symbol_id] = model
                created += 1
            else:
                updated += 1
            model.terminal_id = terminal_id
            model.bid = command.bid
            model.ask = command.ask
            model.observed_at = command.observed_at
            model.received_at = now
            model.source = CandleSource.MT5.value
        await self._commit("quotes", terminal_id)
        return SyncResult(len(commands), created, updated)

    async def replace_positions(
        self,
        terminal_id: str,
        account_external_id: str,
        commands: list[PositionSyncCommand],
    ) -> SyncResult:
        await self._touch_sync(terminal_id, account_external_id)
        account = await self._session.scalar(
            select(AccountModel).where(AccountModel.external_id == account_external_id)
        )
        if account is None:
            raise NotFoundError("Account must be synchronized before positions")
        symbol_names = {command.symbol.strip().upper() for command in commands}
        symbol_result = await self._session.scalars(
            select(SymbolModel).where(SymbolModel.name.in_(symbol_names))
        )
        symbols = {model.name: model for model in symbol_result.all()}
        missing = symbol_names.difference(symbols)
        if missing:
            raise NotFoundError(f"Unknown symbols: {', '.join(sorted(missing))}")

        position_result = await self._session.scalars(
            select(PositionModel).where(PositionModel.account_id == account.id)
        )
        existing = {model.external_id: model for model in position_result.all()}
        incoming_ids = {command.external_id for command in commands}
        created = 0
        updated = 0
        for command in commands:
            model = existing.get(command.external_id)
            if model is None:
                model = PositionModel(
                    id=uuid4(),
                    account_id=account.id,
                    external_id=command.external_id,
                )
                self._session.add(model)
                created += 1
            else:
                updated += 1
            model.symbol_id = symbols[command.symbol.strip().upper()].id
            model.side = command.side.value
            model.volume = command.volume
            model.open_price = command.open_price
            model.current_price = command.current_price
            model.stop_loss = command.stop_loss
            model.take_profit = command.take_profit
            model.profit = command.profit
            model.swap = command.swap
            model.opened_at = command.opened_at
            model.observed_at = command.observed_at

        stale_ids = set(existing).difference(incoming_ids)
        if stale_ids:
            await self._session.execute(
                delete(PositionModel).where(
                    PositionModel.account_id == account.id,
                    PositionModel.external_id.in_(stale_ids),
                )
            )
        await self._commit("positions", terminal_id)
        return SyncResult(len(commands), created, updated, len(stale_ids))

    async def upsert_trades(
        self,
        terminal_id: str,
        account_external_id: str,
        commands: list[TradeSyncCommand],
    ) -> SyncResult:
        await self._touch_sync(terminal_id, account_external_id)
        account = await self._session.scalar(
            select(AccountModel).where(AccountModel.external_id == account_external_id)
        )
        if account is None:
            raise NotFoundError("Account must be synchronized before trades")
        symbol_names = {command.symbol.strip().upper() for command in commands}
        symbol_result = await self._session.scalars(
            select(SymbolModel).where(SymbolModel.name.in_(symbol_names))
        )
        symbols = {model.name: model for model in symbol_result.all()}
        missing = symbol_names.difference(symbols)
        if missing:
            raise NotFoundError(f"Unknown symbols: {', '.join(sorted(missing))}")

        external_ids = {command.external_id for command in commands}
        trade_result = await self._session.scalars(
            select(TradeModel).where(
                TradeModel.account_id == account.id,
                TradeModel.external_id.in_(external_ids),
            )
        )
        existing = {model.external_id: model for model in trade_result.all()}
        created = 0
        updated = 0
        for command in commands:
            model = existing.get(command.external_id)
            if model is None:
                model = TradeModel(
                    id=uuid4(),
                    account_id=account.id,
                    external_id=command.external_id,
                )
                self._session.add(model)
                existing[command.external_id] = model
                created += 1
            else:
                updated += 1
            model.symbol_id = symbols[command.symbol.strip().upper()].id
            model.side = command.side.value
            model.volume = command.volume
            model.open_price = command.open_price
            model.close_price = command.close_price
            model.opened_at = command.opened_at
            model.closed_at = command.closed_at
            model.profit = command.profit
            model.commission = command.commission
            model.swap = command.swap
            model.status = command.status.value
        await self._commit("trades", terminal_id)
        return SyncResult(len(commands), created, updated)

    async def get_terminal_status(self, terminal_id: str | None) -> TerminalSnapshot | None:
        query = select(Mt5TerminalModel)
        if terminal_id is not None:
            query = query.where(Mt5TerminalModel.terminal_id == terminal_id)
        else:
            query = query.order_by(
                Mt5TerminalModel.last_heartbeat_at.desc(),
                Mt5TerminalModel.created_at.desc(),
            )
        terminal = await self._session.scalar(query.limit(1))
        if terminal is None:
            return None
        return TerminalSnapshot(
            terminal_id=terminal.terminal_id,
            terminal_name=terminal.terminal_name,
            terminal_build=terminal.terminal_build,
            account_external_id=terminal.account_external_id,
            last_heartbeat_at=terminal.last_heartbeat_at,
            terminal_time=terminal.terminal_time,
            last_sync_at=terminal.last_sync_at,
        )
