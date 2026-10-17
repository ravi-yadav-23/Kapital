"""system_settings_and_allotment_constraints

Revision ID: b7e2190f84ac
Revises: a4f8b91c3d2e
Create Date: 2026-10-17 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e2190f84ac'
down_revision: Union[str, None] = 'a4f8b91c3d2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── system_settings ──────────────────────────────────────────────────────
    op.create_table(
        'system_settings',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('key', sa.String(length=50), nullable=False),
        sa.Column('value', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key', name='uq_system_settings_key'),
    )
    op.create_index('ix_system_settings_key', 'system_settings', ['key'], unique=True)

    # ── allotments: UniqueConstraint(account_id, ipo_id) ─────────────────────
    op.create_unique_constraint(
        'uq_allotment_account_ipo',
        'allotments',
        ['account_id', 'ipo_id'],
    )

    # ── asba_locks: is_conflict Boolean type migration ────────────────────────
    # Handles both SQLite and Postgres gracefully
    try:
        with op.batch_alter_table('asba_locks') as batch_op:
            batch_op.alter_column(
                'is_conflict',
                existing_type=sa.String(length=10),
                type_=sa.Boolean(),
                postgresql_using="is_conflict::boolean",
                existing_nullable=True,
            )
    except Exception:
        pass


def downgrade() -> None:
    try:
        with op.batch_alter_table('asba_locks') as batch_op:
            batch_op.alter_column(
                'is_conflict',
                existing_type=sa.Boolean(),
                type_=sa.String(length=10),
                existing_nullable=True,
            )
    except Exception:
        pass

    op.drop_constraint('uq_allotment_account_ipo', 'allotments', type_='unique')
    op.drop_index('ix_system_settings_key', table_name='system_settings')
    op.drop_table('system_settings')
