"""Persist partial-data warnings and absolute drawdown.

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "backtest_runs",
        sa.Column(
            "data_complete",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.add_column(
        "backtest_runs",
        sa.Column(
            "warnings",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )
    op.add_column(
        "backtest_equity_points",
        sa.Column(
            "drawdown_absolute",
            sa.Numeric(precision=24, scale=8),
            nullable=False,
            server_default="0",
        ),
    )
    op.execute(
        """
        UPDATE backtest_equity_points
        SET drawdown_absolute = CASE
            WHEN drawdown_pct <= 0 OR drawdown_pct >= 100 THEN 0
            ELSE equity * drawdown_pct / (100 - drawdown_pct)
        END
        """
    )


def downgrade() -> None:
    op.drop_column("backtest_equity_points", "drawdown_absolute")
    op.drop_column("backtest_runs", "warnings")
    op.drop_column("backtest_runs", "data_complete")
