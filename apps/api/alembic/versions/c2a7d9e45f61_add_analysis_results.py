"""add analysis_results (nightly listing-gain engine output, append-only)

Revision ID: c2a7d9e45f61
Revises: b9e5f7a31d24
Create Date: 2026-11-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c2a7d9e45f61'
down_revision: Union[str, None] = 'b9e5f7a31d24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table('analysis_results'):
        return
    op.create_table(
        'analysis_results',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('ipo_id', sa.String(length=36), nullable=False),
        sa.Column('version_id', sa.String(length=36), nullable=False),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('verdict', sa.String(length=30), nullable=False),
        sa.Column('confidence', sa.String(length=10), nullable=False),
        sa.Column('components', sa.JSON(), nullable=True),
        sa.Column('signals', sa.JSON(), nullable=True),
        sa.Column('red_flags', sa.JSON(), nullable=True),
        sa.Column('facts', sa.JSON(), nullable=True),
        sa.Column('inputs', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_analysis_results_ipo_id', 'analysis_results', ['ipo_id'])
    op.create_index('ix_analysis_results_version_id', 'analysis_results', ['version_id'])


def downgrade() -> None:
    pass  # non-destructive
