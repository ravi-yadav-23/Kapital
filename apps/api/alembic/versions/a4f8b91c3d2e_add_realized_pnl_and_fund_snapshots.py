"""add_realized_pnl_and_fund_snapshots

Revision ID: a4f8b91c3d2e
Revises: c13dc79076eb
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from datetime import date


# revision identifiers, used by Alembic.
revision: str = 'a4f8b91c3d2e'
down_revision: Union[str, None] = 'c13dc79076eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── realized_pnl ─────────────────────────────────────────────────────────
    # P&L ledger for completed IPO exits and pre-listing sell orders.
    op.create_table(
        'realized_pnl',
        sa.Column('allotment_id', sa.String(length=36), nullable=False),
        sa.Column('account_id', sa.String(length=36), nullable=False),
        sa.Column('account_name', sa.String(length=100), nullable=False),
        sa.Column('ipo_name', sa.String(length=200), nullable=False),
        sa.Column('ipo_symbol', sa.String(length=50), nullable=False),
        sa.Column('shares_sold', sa.Integer(), nullable=False),
        sa.Column('issue_price', sa.Float(), nullable=False),
        sa.Column('exit_price', sa.Float(), nullable=False),
        sa.Column('invested_amount', sa.Float(), nullable=False),
        sa.Column('realized_amount', sa.Float(), nullable=False),
        sa.Column('net_pnl', sa.Float(), nullable=False),
        sa.Column('roi_percent', sa.Float(), nullable=False),
        sa.Column('exit_date', sa.Date(), nullable=False),
        sa.Column('exit_type', sa.String(length=50), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['allotment_id'], ['allotments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['account_id'], ['family_accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('allotment_id'),
    )

    # ── fund_snapshots ────────────────────────────────────────────────────────
    # Historical daily record of family corpus balances and ASBA lock utilization.
    op.create_table(
        'fund_snapshots',
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('total_family_corpus', sa.Float(), nullable=False),
        sa.Column('total_available_liquid', sa.Float(), nullable=False),
        sa.Column('total_locked_asba', sa.Float(), nullable=False),
        sa.Column('utilization_percent', sa.Float(), nullable=False),
        sa.Column('active_accounts_count', sa.Integer(), nullable=True),
        sa.Column('total_accounts_count', sa.Integer(), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_fund_snapshots_snapshot_date', 'fund_snapshots', ['snapshot_date'])


def downgrade() -> None:
    op.drop_index('ix_fund_snapshots_snapshot_date', table_name='fund_snapshots')
    op.drop_table('fund_snapshots')
    op.drop_table('realized_pnl')
