from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database.base import Base


class SymbolModel(Base):
    __tablename__ = "symbols"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(32), unique=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    digits: Mapped[int]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    candles: Mapped[list[CandleModel]] = relationship(back_populates="symbol")
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

    symbol: Mapped[SymbolModel] = relationship(back_populates="candles")


class AccountModel(Base):
    __tablename__ = "accounts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    external_id: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(String(128))
    currency: Mapped[str] = mapped_column(String(8))
    balance: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    trades: Mapped[list[TradeModel]] = relationship(back_populates="account")


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
