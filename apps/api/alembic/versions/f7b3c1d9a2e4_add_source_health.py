"""add source_health (per-source health and daily request budget)

Revision ID: f7b3c1d9a2e4
Revises: e5c3a9d41b27
Create Date: 2026-11-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'f7b3c1d9a2e4'
down_revision: Union[str, None] = 'e5c3a9d41b27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table('source_health'):
        return  # already created by the application's create_all
    op.create_table(
        'source_health',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('last_attempt_at', sa.DateTime(), nullable=True),
        sa.Column('last_success_at', sa.DateTime(), nullable=True),
        sa.Column('last_error', sa.String(length=500), nullable=True),
        sa.Column('consecutive_failures', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_record_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('budget_date', sa.Date(), nullable=True),
        sa.Column('requests_today', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_source_health_source', 'source_health', ['source'], unique=True)


def downgrade() -> None:
    pass  # non-destructive
