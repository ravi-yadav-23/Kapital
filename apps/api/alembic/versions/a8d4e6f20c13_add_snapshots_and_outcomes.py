"""add gmp_snapshots, subscription_snapshots, ipo_outcomes

Revision ID: a8d4e6f20c13
Revises: f7b3c1d9a2e4
Create Date: 2026-11-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a8d4e6f20c13'
down_revision: Union[str, None] = 'f7b3c1d9a2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts():
    return [sa.Column('created_at', sa.DateTime(), nullable=False), sa.Column('updated_at', sa.DateTime(), nullable=False)]


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not insp.has_table('gmp_snapshots'):
        op.create_table(
            'gmp_snapshots',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('ipo_id', sa.String(length=36), nullable=False),
            sa.Column('snapshot_date', sa.Date(), nullable=False),
            sa.Column('source', sa.String(length=50), nullable=False),
            sa.Column('gmp_percent', sa.Float(), nullable=False),
            sa.Column('gmp_rupees', sa.Float(), nullable=True),
            *_ts(),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('ipo_id', 'snapshot_date', 'source', name='uq_gmp_snapshot'),
        )
        op.create_index('ix_gmp_snapshots_ipo_id', 'gmp_snapshots', ['ipo_id'])
    if not insp.has_table('subscription_snapshots'):
        op.create_table(
            'subscription_snapshots',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('ipo_id', sa.String(length=36), nullable=False),
            sa.Column('snapshot_date', sa.Date(), nullable=False),
            sa.Column('source', sa.String(length=50), nullable=False),
            sa.Column('retail', sa.Float(), nullable=True),
            sa.Column('shni', sa.Float(), nullable=True),
            sa.Column('bhni', sa.Float(), nullable=True),
            sa.Column('qib', sa.Float(), nullable=True),
            sa.Column('total', sa.Float(), nullable=True),
            *_ts(),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('ipo_id', 'snapshot_date', 'source', name='uq_subscription_snapshot'),
        )
        op.create_index('ix_subscription_snapshots_ipo_id', 'subscription_snapshots', ['ipo_id'])
    if not insp.has_table('ipo_outcomes'):
        op.create_table(
            'ipo_outcomes',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('ipo_id', sa.String(length=36), nullable=False),
            sa.Column('symbol', sa.String(length=50), nullable=True),
            sa.Column('issue_price', sa.Float(), nullable=True),
            sa.Column('listing_price', sa.Float(), nullable=False),
            sa.Column('listing_gain_percent', sa.Float(), nullable=False),
            sa.Column('listing_date', sa.Date(), nullable=True),
            sa.Column('is_sme', sa.String(length=5), nullable=True),
            sa.Column('last_gmp_percent', sa.Float(), nullable=True),
            sa.Column('last_subscription_total', sa.Float(), nullable=True),
            sa.Column('source', sa.String(length=50), nullable=False),
            *_ts(),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_ipo_outcomes_ipo_id', 'ipo_outcomes', ['ipo_id'], unique=True)


def downgrade() -> None:
    pass  # non-destructive
