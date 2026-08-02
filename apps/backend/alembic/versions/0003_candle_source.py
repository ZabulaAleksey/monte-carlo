"""Identify candle data provenance.

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "candles",
        sa.Column("source", sa.String(length=16), server_default="api", nullable=False),
    )
    # Records predating provenance belong to the original MVP demo/API dataset.
    # A repeated MT5 batch promotes matching records to source=mt5.
    op.execute("UPDATE candles SET source = 'demo'")


def downgrade() -> None:
    op.drop_column("candles", "source")
