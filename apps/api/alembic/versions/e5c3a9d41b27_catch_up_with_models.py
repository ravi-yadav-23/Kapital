"""catch up with the models (idempotent)

Adds everything the application code expects but earlier migrations never created:
ai_reports.{summary_source,financial_metrics,gatekeepers,is_audited}, allotments.angel_client_id,
family_accounts.{pan,has_ddpi,tpin}, ipos.isin and the ipo_aliases table.

Every step first checks what already exists, because some databases got part of this schema from the
application's own create_all/ALTER start-up code. Existing reports are NOT flagged audited
(is_audited defaults to false) because they were never verified.

Revision ID: e5c3a9d41b27
Revises: d2a91f6c7b10
Create Date: 2026-11-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e5c3a9d41b27'
down_revision: Union[str, None] = 'd2a91f6c7b10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(insp, table):
    return {c['name'] for c in insp.get_columns(table)}


def _add_if_missing(insp, table, column):
    if column.name not in _columns(insp, table):
        op.add_column(table, column)


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())

    _add_if_missing(insp, 'ai_reports', sa.Column('summary_source', sa.String(length=50), nullable=True))
    _add_if_missing(insp, 'ai_reports', sa.Column('financial_metrics', sa.JSON(), nullable=True))
    _add_if_missing(insp, 'ai_reports', sa.Column('gatekeepers', sa.JSON(), nullable=True))
    _add_if_missing(insp, 'ai_reports', sa.Column('is_audited', sa.Boolean(), server_default=sa.false(), nullable=False))

    _add_if_missing(insp, 'allotments', sa.Column('angel_client_id', sa.String(length=50), nullable=True))

    _add_if_missing(insp, 'family_accounts', sa.Column('pan', sa.String(length=10), nullable=True))
    _add_if_missing(insp, 'family_accounts', sa.Column('has_ddpi', sa.Boolean(), server_default=sa.false(), nullable=False))
    _add_if_missing(insp, 'family_accounts', sa.Column('tpin', sa.String(length=255), nullable=True))

    if 'isin' not in _columns(insp, 'ipos'):
        op.add_column('ipos', sa.Column('isin', sa.String(length=50), nullable=True))
    if 'ix_ipos_isin' not in {i['name'] for i in insp.get_indexes('ipos')}:
        op.create_index('ix_ipos_isin', 'ipos', ['isin'])

    if not insp.has_table('ipo_aliases'):
        op.create_table(
            'ipo_aliases',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('ipo_id', sa.String(length=36), nullable=False),
            sa.Column('alias', sa.String(length=200), nullable=False),
            sa.Column('normalized_alias', sa.String(length=200), nullable=False),
            sa.Column('source', sa.String(length=50), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['ipo_id'], ['ipos.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_ipo_aliases_ipo_id', 'ipo_aliases', ['ipo_id'])
        op.create_index('ix_ipo_aliases_normalized_alias', 'ipo_aliases', ['normalized_alias'], unique=True)


def downgrade() -> None:
    # Deliberately non-destructive: dropping these columns/tables would delete data the application
    # now relies on. Downgrade is a no-op.
    pass
