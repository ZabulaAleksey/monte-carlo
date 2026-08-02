"""Create trading data tables.

Revision ID: 0001
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "symbols",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=32), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("digits", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("balance", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id"),
    )
    op.create_table(
        "candles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("symbol_id", sa.Uuid(), nullable=False),
        sa.Column("timeframe", sa.String(length=16), nullable=False),
        sa.Column("open_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("high", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("low", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("close", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("volume", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.ForeignKeyConstraint(["symbol_id"], ["symbols.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("symbol_id", "timeframe", "open_time", name="uq_candle_series_time"),
    )
    op.create_index("ix_candles_symbol_time", "candles", ["symbol_id", "open_time"])
    op.create_table(
        "trades",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("symbol_id", sa.Uuid(), nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=False),
        sa.Column("side", sa.String(length=8), nullable=False),
        sa.Column("volume", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("open_price", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("close_price", sa.Numeric(precision=24, scale=8), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("profit", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("commission", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("swap", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["symbol_id"], ["symbols.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "external_id", name="uq_trade_account_external"),
    )
    op.create_index("ix_trades_account_opened", "trades", ["account_id", "opened_at"])


def downgrade() -> None:
    op.drop_index("ix_trades_account_opened", table_name="trades")
    op.drop_table("trades")
    op.drop_index("ix_candles_symbol_time", table_name="candles")
    op.drop_table("candles")
    op.drop_table("accounts")
    op.drop_table("symbols")
