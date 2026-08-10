"""Add reusable historical-data coverage cache.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "historical_data_coverage",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("symbol_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timeframe", sa.String(length=16), nullable=False),
        sa.Column("covered_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("covered_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "covered_end >= covered_start",
            name="ck_historical_coverage_valid_range",
        ),
        sa.ForeignKeyConstraint(
            ["symbol_id"], ["symbols.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_historical_coverage_lookup",
        "historical_data_coverage",
        ["symbol_id", "timeframe", "covered_start", "covered_end"],
    )
    # Existing candles are already a persistent cache. Bootstrap one conservative
    # interval per series so upgrades do not invalidate previously usable data.
    op.execute(
        """
        INSERT INTO historical_data_coverage (
            id, symbol_id, timeframe, covered_start, covered_end, source, updated_at
        )
        SELECT
            md5(symbol_id::text || ':' || timeframe)::uuid,
            symbol_id,
            timeframe,
            min(open_time),
            max(open_time),
            'migration',
            now()
        FROM candles
        GROUP BY symbol_id, timeframe
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_historical_coverage_lookup",
        table_name="historical_data_coverage",
    )
    op.drop_table("historical_data_coverage")
