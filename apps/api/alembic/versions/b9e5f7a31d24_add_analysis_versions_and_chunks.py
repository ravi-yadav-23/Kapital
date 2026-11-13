"""add analysis_versions and analysis_chunks (append-only offer-document analysis)

Revision ID: b9e5f7a31d24
Revises: a8d4e6f20c13
Create Date: 2026-11-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b9e5f7a31d24'
down_revision: Union[str, None] = 'a8d4e6f20c13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts():
    return [sa.Column('created_at', sa.DateTime(), nullable=False), sa.Column('updated_at', sa.DateTime(), nullable=False)]


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not insp.has_table('analysis_versions'):
        op.create_table(
            'analysis_versions',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('ipo_id', sa.String(length=36), nullable=False),
            sa.Column('doc_kind', sa.String(length=20), nullable=False),
            sa.Column('doc_url', sa.String(length=500), nullable=False),
            sa.Column('doc_sha256', sa.String(length=64), nullable=False),
            sa.Column('version', sa.Integer(), nullable=False),
            sa.Column('model', sa.String(length=80), nullable=True),
            *_ts(),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('ipo_id', 'doc_kind', 'version', name='uq_analysis_version'),
        )
        op.create_index('ix_analysis_versions_ipo_id', 'analysis_versions', ['ipo_id'])
    if not insp.has_table('analysis_chunks'):
        op.create_table(
            'analysis_chunks',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('ipo_id', sa.String(length=36), nullable=False),
            sa.Column('version_id', sa.String(length=36), nullable=False),
            sa.Column('chunk_index', sa.Integer(), nullable=False),
            sa.Column('page_start', sa.Integer(), nullable=True),
            sa.Column('page_end', sa.Integer(), nullable=True),
            sa.Column('text_sha256', sa.String(length=64), nullable=False),
            sa.Column('text', sa.Text(), nullable=False),
            sa.Column('status', sa.String(length=10), nullable=False),
            sa.Column('facts', sa.JSON(), nullable=True),
            sa.Column('error', sa.String(length=300), nullable=True),
            *_ts(),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('version_id', 'chunk_index', name='uq_analysis_chunk'),
        )
        op.create_index('ix_analysis_chunks_ipo_id', 'analysis_chunks', ['ipo_id'])
        op.create_index('ix_analysis_chunks_version_id', 'analysis_chunks', ['version_id'])


def downgrade() -> None:
    pass  # non-destructive
