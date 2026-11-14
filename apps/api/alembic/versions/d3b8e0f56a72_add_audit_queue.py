"""add audit_requests and audit_quota (guest "Run audit" queue with a DB-enforced daily cap)

Revision ID: d3b8e0f56a72
Revises: c2a7d9e45f61
Create Date: 2026-11-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'd3b8e0f56a72'
down_revision: Union[str, None] = 'c2a7d9e45f61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not insp.has_table('audit_requests'):
        op.create_table(
            'audit_requests',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('ipo_id', sa.String(length=36), nullable=False),
            sa.Column('request_date', sa.Date(), nullable=False),
            sa.Column('status', sa.String(length=10), nullable=False),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('ipo_id', 'request_date', name='uq_audit_request_day'),
        )
        op.create_index('ix_audit_requests_ipo_id', 'audit_requests', ['ipo_id'])
    if not insp.has_table('audit_quota'):
        op.create_table(
            'audit_quota',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('day', sa.Date(), nullable=False),
            sa.Column('used', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('day', name='uq_audit_quota_day'),
        )


def downgrade() -> None:
    pass  # non-destructive
