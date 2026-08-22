"""Add MT5 symbol volume and contract specifications.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "symbols",
        sa.Column(
            "volume_min",
            sa.Numeric(24, 8),
            nullable=False,
            server_default=sa.text("0.01"),
        ),
    )
    op.add_column(
        "symbols",
        sa.Column(
            "volume_step",
            sa.Numeric(24, 8),
            nullable=False,
            server_default=sa.text("0.01"),
        ),
    )
    op.add_column(
        "symbols",
        sa.Column(
            "volume_max",
            sa.Numeric(24, 8),
            nullable=False,
            server_default=sa.text("99"),
        ),
    )
    op.add_column(
        "symbols",
        sa.Column(
            "contract_size",
            sa.Numeric(24, 8),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )
    op.create_check_constraint(
        "ck_symbols_volume_min_positive", "symbols", "volume_min > 0"
    )
    op.create_check_constraint(
        "ck_symbols_volume_step_positive", "symbols", "volume_step > 0"
    )
    op.create_check_constraint(
        "ck_symbols_volume_range", "symbols", "volume_max >= volume_min"
    )
    op.create_check_constraint(
        "ck_symbols_contract_size_positive", "symbols", "contract_size > 0"
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_symbols_contract_size_positive", "symbols", type_="check"
    )
    op.drop_constraint("ck_symbols_volume_range", "symbols", type_="check")
    op.drop_constraint(
        "ck_symbols_volume_step_positive", "symbols", type_="check"
    )
    op.drop_constraint(
        "ck_symbols_volume_min_positive", "symbols", type_="check"
    )
    op.drop_column("symbols", "contract_size")
    op.drop_column("symbols", "volume_max")
    op.drop_column("symbols", "volume_step")
    op.drop_column("symbols", "volume_min")
