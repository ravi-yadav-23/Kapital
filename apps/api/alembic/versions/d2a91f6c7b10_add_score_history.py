"""add score_history (append-only, no foreign key so history is never cascaded away)

Revision ID: d2a91f6c7b10
Revises: b7e2190f84ac
Create Date: 2026-11-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'd2a91f6c7b10'
down_revision: Union[str, None] = 'b7e2190f84ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'score_history',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('ipo_id', sa.String(length=36), nullable=False),
        sa.Column('component', sa.String(length=30), nullable=False),
        sa.Column('value', sa.Integer(), nullable=True),
        sa.Column('recommendation', sa.String(length=30), nullable=True),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('inputs', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_score_history_ipo_id', 'score_history', ['ipo_id'])


def downgrade() -> None:
    op.drop_index('ix_score_history_ipo_id', table_name='score_history')
    op.drop_table('score_history')
