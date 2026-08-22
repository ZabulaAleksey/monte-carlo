"""Add latest live market quotes.

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "market_quotes",
        sa.Column("symbol_id", sa.Uuid(), nullable=False),
        sa.Column("terminal_id", sa.String(length=128), nullable=False),
        sa.Column("bid", sa.Numeric(24, 8), nullable=False),
        sa.Column("ask", sa.Numeric(24, 8), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.CheckConstraint("ask >= bid", name="ck_market_quotes_ask_gte_bid"),
        sa.ForeignKeyConstraint(["symbol_id"], ["symbols.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("symbol_id"),
    )
    op.create_index("ix_market_quotes_observed_at", "market_quotes", ["observed_at"])


def downgrade() -> None:
    op.drop_index("ix_market_quotes_observed_at", table_name="market_quotes")
    op.drop_table("market_quotes")
