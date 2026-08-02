from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Protocol

from app.domain.enums import TradeSide, TradeStatus


@dataclass(frozen=True, slots=True)
class HeartbeatCommand:
    terminal_id: str
    sent_at: datetime
    terminal_name: str
    terminal_build: int
    account_external_id: str | None


@dataclass(frozen=True, slots=True)
class AccountSyncCommand:
    terminal_id: str
    sent_at: datetime
    external_id: str
    name: str
    currency: str
    balance: Decimal
    equity: Decimal
    margin: Decimal
    free_margin: Decimal
    leverage: int
    company: str
    server: str


@dataclass(frozen=True, slots=True)
class SymbolSyncCommand:
    name: str
    description: str
    digits: int
    is_active: bool


@dataclass(frozen=True, slots=True)
class CandleSyncCommand:
    symbol: str
    timeframe: str
    open_time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal


@dataclass(frozen=True, slots=True)
class PositionSyncCommand:
    external_id: str
    symbol: str
    side: TradeSide
    volume: Decimal
    open_price: Decimal
    current_price: Decimal
    stop_loss: Decimal | None
    take_profit: Decimal | None
    profit: Decimal
    swap: Decimal
    opened_at: datetime
    observed_at: datetime


@dataclass(frozen=True, slots=True)
class TradeSyncCommand:
    external_id: str
    symbol: str
    side: TradeSide
    volume: Decimal
    open_price: Decimal
    close_price: Decimal | None
    opened_at: datetime
    closed_at: datetime | None
    profit: Decimal
    commission: Decimal
    swap: Decimal
    status: TradeStatus


@dataclass(frozen=True, slots=True)
class SyncResult:
    received: int
    created: int
    updated: int
    removed: int = 0


@dataclass(frozen=True, slots=True)
class TerminalSnapshot:
    terminal_id: str
    terminal_name: str
    terminal_build: int
    account_external_id: str | None
    last_heartbeat_at: datetime | None
    terminal_time: datetime | None
    last_sync_at: datetime | None


@dataclass(frozen=True, slots=True)
class ConnectionStatus:
    configured: bool
    connected: bool
    stale: bool
    stale_after_seconds: int
    terminal: TerminalSnapshot | None


class Mt5SyncGateway(Protocol):
    async def record_heartbeat(self, command: HeartbeatCommand) -> SyncResult: ...

    async def upsert_account(self, command: AccountSyncCommand) -> SyncResult: ...

    async def upsert_symbols(
        self, terminal_id: str, commands: list[SymbolSyncCommand]
    ) -> SyncResult: ...

    async def upsert_candles(
        self, terminal_id: str, commands: list[CandleSyncCommand]
    ) -> SyncResult: ...

    async def replace_positions(
        self,
        terminal_id: str,
        account_external_id: str,
        commands: list[PositionSyncCommand],
    ) -> SyncResult: ...

    async def upsert_trades(
        self,
        terminal_id: str,
        account_external_id: str,
        commands: list[TradeSyncCommand],
    ) -> SyncResult: ...

    async def get_terminal_status(self, terminal_id: str | None) -> TerminalSnapshot | None: ...


class Mt5SyncService:
    def __init__(
        self,
        gateway: Mt5SyncGateway,
        stale_after_seconds: int,
        api_key_configured: bool,
    ) -> None:
        self._gateway = gateway
        self._stale_after_seconds = stale_after_seconds
        self._api_key_configured = api_key_configured

    async def heartbeat(self, command: HeartbeatCommand) -> SyncResult:
        return await self._gateway.record_heartbeat(command)

    async def account(self, command: AccountSyncCommand) -> SyncResult:
        return await self._gateway.upsert_account(command)

    async def symbols(self, terminal_id: str, commands: list[SymbolSyncCommand]) -> SyncResult:
        return await self._gateway.upsert_symbols(terminal_id, commands)

    async def candles(self, terminal_id: str, commands: list[CandleSyncCommand]) -> SyncResult:
        return await self._gateway.upsert_candles(terminal_id, commands)

    async def positions(
        self,
        terminal_id: str,
        account_external_id: str,
        commands: list[PositionSyncCommand],
    ) -> SyncResult:
        return await self._gateway.replace_positions(terminal_id, account_external_id, commands)

    async def trades(
        self,
        terminal_id: str,
        account_external_id: str,
        commands: list[TradeSyncCommand],
    ) -> SyncResult:
        return await self._gateway.upsert_trades(terminal_id, account_external_id, commands)

    async def status(self, terminal_id: str | None) -> ConnectionStatus:
        terminal = await self._gateway.get_terminal_status(terminal_id)
        if terminal is None or terminal.last_heartbeat_at is None:
            return ConnectionStatus(
                configured=self._api_key_configured,
                connected=False,
                stale=True,
                stale_after_seconds=self._stale_after_seconds,
                terminal=terminal,
            )
        heartbeat = terminal.last_heartbeat_at
        if heartbeat.tzinfo is None:
            heartbeat = heartbeat.replace(tzinfo=UTC)
        stale = datetime.now(UTC) - heartbeat > timedelta(seconds=self._stale_after_seconds)
        return ConnectionStatus(
            configured=self._api_key_configured,
            connected=not stale,
            stale=stale,
            stale_after_seconds=self._stale_after_seconds,
            terminal=terminal,
        )
