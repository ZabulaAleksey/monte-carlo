"""Add MetaTrader 5 bridge state and position snapshots.

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("equity", sa.Numeric(precision=24, scale=8), server_default="0", nullable=False),
    )
    op.add_column(
        "accounts",
        sa.Column("margin", sa.Numeric(precision=24, scale=8), server_default="0", nullable=False),
    )
    op.add_column(
        "accounts",
        sa.Column(
            "free_margin",
            sa.Numeric(precision=24, scale=8),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "accounts", sa.Column("leverage", sa.Integer(), server_default="1", nullable=False)
    )
    op.add_column(
        "accounts", sa.Column("company", sa.String(length=128), server_default="", nullable=False)
    )
    op.add_column(
        "accounts", sa.Column("server", sa.String(length=128), server_default="", nullable=False)
    )
    op.add_column("accounts", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "mt5_terminals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("terminal_id", sa.String(length=128), nullable=False),
        sa.Column("terminal_name", sa.String(length=128), nullable=False),
        sa.Column("terminal_build", sa.Integer(), nullable=False),
        sa.Column("account_external_id", sa.String(length=64), nullable=True),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terminal_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("terminal_id"),
    )
    op.create_index("ix_mt5_terminals_last_heartbeat", "mt5_terminals", ["last_heartbeat_at"])

    op.create_table(
        "positions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("symbol_id", sa.Uuid(), nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=False),
        sa.Column("side", sa.String(length=8), nullable=False),
        sa.Column("volume", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("open_price", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("current_price", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("stop_loss", sa.Numeric(precision=24, scale=8), nullable=True),
        sa.Column("take_profit", sa.Numeric(precision=24, scale=8), nullable=True),
        sa.Column("profit", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("swap", sa.Numeric(precision=24, scale=8), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["symbol_id"], ["symbols.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "external_id", name="uq_position_account_external"),
    )
    op.create_index("ix_positions_account_observed", "positions", ["account_id", "observed_at"])


def downgrade() -> None:
    op.drop_index("ix_positions_account_observed", table_name="positions")
    op.drop_table("positions")
    op.drop_index("ix_mt5_terminals_last_heartbeat", table_name="mt5_terminals")
    op.drop_table("mt5_terminals")
    op.drop_column("accounts", "updated_at")
    op.drop_column("accounts", "server")
    op.drop_column("accounts", "company")
    op.drop_column("accounts", "leverage")
    op.drop_column("accounts", "free_margin")
    op.drop_column("accounts", "margin")
    op.drop_column("accounts", "equity")
