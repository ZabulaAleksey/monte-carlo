"""Add two-way historical data request queue.

Revision ID: 0009
Revises: 0008
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "historical_data_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("symbol_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timeframe", sa.String(length=16), nullable=False),
        sa.Column("requested_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("requested_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terminal_id", sa.String(length=128), nullable=True),
        sa.Column("candle_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.String(length=1000), nullable=True),
        sa.CheckConstraint(
            "requested_end > requested_start",
            name="ck_historical_requests_valid_range",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'claimed', 'completed', 'failed')",
            name="ck_historical_requests_status",
        ),
        sa.CheckConstraint(
            "candle_count >= 0",
            name="ck_historical_requests_candle_count",
        ),
        sa.ForeignKeyConstraint(["symbol_id"], ["symbols.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_historical_requests_queue",
        "historical_data_requests",
        ["status", "requested_at"],
    )
    op.create_index(
        "ix_historical_requests_symbol",
        "historical_data_requests",
        ["symbol_id", "timeframe", "requested_start", "requested_end"],
    )
    op.create_index(
        "uq_historical_requests_active_range",
        "historical_data_requests",
        ["symbol_id", "timeframe", "requested_start", "requested_end"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending', 'claimed')"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_historical_requests_active_range",
        table_name="historical_data_requests",
    )
    op.drop_index(
        "ix_historical_requests_symbol",
        table_name="historical_data_requests",
    )
    op.drop_index(
        "ix_historical_requests_queue",
        table_name="historical_data_requests",
    )
    op.drop_table("historical_data_requests")
