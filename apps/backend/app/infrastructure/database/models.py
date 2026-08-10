from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import CandleSource
from app.infrastructure.database.base import Base


class SymbolModel(Base):
    __tablename__ = "symbols"
    __table_args__ = (
        CheckConstraint("volume_min > 0", name="ck_symbols_volume_min_positive"),
        CheckConstraint("volume_step > 0", name="ck_symbols_volume_step_positive"),
        CheckConstraint("volume_max >= volume_min", name="ck_symbols_volume_range"),
        CheckConstraint("contract_size > 0", name="ck_symbols_contract_size_positive"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(32), unique=True)
    description: Mapped[str] = mapped_column(String(255), default="")
    digits: Mapped[int]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    volume_min: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=Decimal("0.01"))
    volume_step: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=Decimal("0.01"))
    volume_max: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=Decimal("99"))
    contract_size: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=Decimal("1"))

    candles: Mapped[list[CandleModel]] = relationship(back_populates="symbol")
    positions: Mapped[list[PositionModel]] = relationship(back_populates="symbol")
    trades: Mapped[list[TradeModel]] = relationship(back_populates="symbol")
    backtest_runs: Mapped[list[BacktestRunModel]] = relationship(back_populates="symbol")
    quote: Mapped[MarketQuoteModel | None] = relationship(
        back_populates="symbol", uselist=False
    )


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


class HistoricalDataCoverageModel(Base):
    __tablename__ = "historical_data_coverage"
    __table_args__ = (
        CheckConstraint(
            "covered_end >= covered_start",
            name="ck_historical_coverage_valid_range",
        ),
        Index(
            "ix_historical_coverage_lookup",
            "symbol_id",
            "timeframe",
            "covered_start",
            "covered_end",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    symbol_id: Mapped[UUID] = mapped_column(
        ForeignKey("symbols.id", ondelete="CASCADE")
    )
    timeframe: Mapped[str] = mapped_column(String(16))
    covered_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    covered_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(16))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MarketQuoteModel(Base):
    __tablename__ = "market_quotes"
    __table_args__ = (
        CheckConstraint("ask >= bid", name="ck_market_quotes_ask_gte_bid"),
        Index("ix_market_quotes_observed_at", "observed_at"),
    )

    symbol_id: Mapped[UUID] = mapped_column(
        ForeignKey("symbols.id", ondelete="CASCADE"), primary_key=True
    )
    terminal_id: Mapped[str] = mapped_column(String(128))
    bid: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    ask: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(16))

    symbol: Mapped[SymbolModel] = relationship(back_populates="quote")


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


class BacktestRunModel(Base):
    __tablename__ = "backtest_runs"
    __table_args__ = (Index("ix_backtest_runs_created_at", "created_at"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    symbol_id: Mapped[UUID] = mapped_column(ForeignKey("symbols.id", ondelete="RESTRICT"))
    strategy_name: Mapped[str] = mapped_column(String(64))
    strategy_version: Mapped[str] = mapped_column(String(32))
    timeframe: Mapped[str] = mapped_column(String(16))
    requested_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    requested_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    data_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    data_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    candle_count: Mapped[int] = mapped_column(Integer)
    initial_capital: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    final_balance: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    settings: Mapped[dict[str, object]] = mapped_column(JSON)
    parameters: Mapped[dict[str, object]] = mapped_column(JSON)
    metrics: Mapped[dict[str, object]] = mapped_column(JSON)
    data_complete: Mapped[bool] = mapped_column(Boolean, default=True)
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="completed")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    symbol: Mapped[SymbolModel] = relationship(back_populates="backtest_runs")
    trades: Mapped[list[BacktestTradeModel]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="BacktestTradeModel.sequence",
    )
    equity_points: Mapped[list[BacktestEquityPointModel]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="BacktestEquityPointModel.sequence",
    )


class BacktestTradeModel(Base):
    __tablename__ = "backtest_trades"
    __table_args__ = (Index("ix_backtest_trades_run_sequence", "run_id", "sequence"),)

    run_id: Mapped[UUID] = mapped_column(
        ForeignKey("backtest_runs.id", ondelete="CASCADE"), primary_key=True
    )
    sequence: Mapped[int] = mapped_column(Integer, primary_key=True)
    side: Mapped[str] = mapped_column(String(8))
    volume: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    open_price: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    close_price: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    stop_loss: Mapped[Decimal | None] = mapped_column(Numeric(24, 8), nullable=True)
    take_profit: Mapped[Decimal | None] = mapped_column(Numeric(24, 8), nullable=True)
    exit_reason: Mapped[str] = mapped_column(String(24))
    gross_profit: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    commission: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    swap: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    net_profit: Mapped[Decimal] = mapped_column(Numeric(24, 8))

    run: Mapped[BacktestRunModel] = relationship(back_populates="trades")


class BacktestEquityPointModel(Base):
    __tablename__ = "backtest_equity_points"
    __table_args__ = (Index("ix_backtest_equity_run_sequence", "run_id", "sequence"),)

    run_id: Mapped[UUID] = mapped_column(
        ForeignKey("backtest_runs.id", ondelete="CASCADE"), primary_key=True
    )
    sequence: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    balance: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    equity: Mapped[Decimal] = mapped_column(Numeric(24, 8))
    drawdown_absolute: Mapped[Decimal] = mapped_column(Numeric(24, 8), default=0)
    drawdown_pct: Mapped[Decimal] = mapped_column(Numeric(16, 8))

    run: Mapped[BacktestRunModel] = relationship(back_populates="equity_points")
