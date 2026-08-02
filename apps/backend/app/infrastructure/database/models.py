from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import CandleSource
from app.infrastructure.database.base import Base


class SymbolModel(Base):
    __tablename__ = "symbols"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(32), unique=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    digits: Mapped[int]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    candles: Mapped[list[CandleModel]] = relationship(back_populates="symbol")
    positions: Mapped[list[PositionModel]] = relationship(back_populates="symbol")
    trades: Mapped[list[TradeModel]] = relationship(back_populates="symbol")


class CandleModel(Base):
    __tablename__ = "candles"
    __table_args__ = (
        UniqueConstraint("symbol_id", "timeframe", "open_time", name="uq_candle_series_time"),
        Index("ix_candles_symbol_time", "symbol_id", "open_time"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    symbol_id: Mapped[UUID] = mapped_column(ForeignKey("symbols.id", ondelete="CASCADE"))
    timeframe: Mapped[str] = mapped_column(String(16))
    open_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    open: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    high: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    low: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    close: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    volume: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    source: Mapped[str] = mapped_column(
        String(16), default=CandleSource.API.value, server_default=CandleSource.API.value
    )

    symbol: Mapped[SymbolModel] = relationship(back_populates="candles")


class AccountModel(Base):
    __tablename__ = "accounts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    external_id: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    currency: Mapped[str] = mapped_column(String(8))
    balance: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    equity: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    margin: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    free_margin: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    leverage: Mapped[int] = mapped_column(default=1)
    company: Mapped[str] = mapped_column(String(128), default="")
    server: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    positions: Mapped[list[PositionModel]] = relationship(back_populates="account")
    trades: Mapped[list[TradeModel]] = relationship(back_populates="account")


class Mt5TerminalModel(Base):
    __tablename__ = "mt5_terminals"
    __table_args__ = (Index("ix_mt5_terminals_last_heartbeat", "last_heartbeat_at"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    terminal_id: Mapped[str] = mapped_column(String(128), unique=True)
    terminal_name: Mapped[str] = mapped_column(String(128))
    terminal_build: Mapped[int]
    account_external_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    terminal_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PositionModel(Base):
    __tablename__ = "positions"
    __table_args__ = (
        UniqueConstraint("account_id", "external_id", name="uq_position_account_external"),
        Index("ix_positions_account_observed", "account_id", "observed_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    symbol_id: Mapped[UUID] = mapped_column(ForeignKey("symbols.id", ondelete="RESTRICT"))
    external_id: Mapped[str] = mapped_column(String(64))
    side: Mapped[str] = mapped_column(String(8))
    volume: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    open_price: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    current_price: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    stop_loss: Mapped[Decimal | None] = mapped_column(Numeric(24, 8), nullable=True)
    take_profit: Mapped[Decimal | None] = mapped_column(Numeric(24, 8), nullable=True)
    profit: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    swap: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    account: Mapped[AccountModel] = relationship(back_populates="positions")
    symbol: Mapped[SymbolModel] = relationship(back_populates="positions")


class TradeModel(Base):
    __tablename__ = "trades"
    __table_args__ = (
        UniqueConstraint("account_id", "external_id", name="uq_trade_account_external"),
        Index("ix_trades_account_opened", "account_id", "opened_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    account_id: Mapped[UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    symbol_id: Mapped[UUID] = mapped_column(ForeignKey("symbols.id", ondelete="RESTRICT"))
    external_id: Mapped[str] = mapped_column(String(64))
    side: Mapped[str] = mapped_column(String(8))
    volume: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    open_price: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    close_price: Mapped[Decimal | None] = mapped_column(Numeric(24, 8), nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    profit: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    commission: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    swap: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    status: Mapped[str] = mapped_column(String(16))

    account: Mapped[AccountModel] = relationship(back_populates="trades")
    symbol: Mapped[SymbolModel] = relationship(back_populates="trades")
