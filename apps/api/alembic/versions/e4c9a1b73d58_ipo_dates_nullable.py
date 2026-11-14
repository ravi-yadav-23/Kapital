"""ipos.issue_open_date / issue_close_date become nullable

The initial schema made both NOT NULL, but upcoming IPOs often have no announced dates yet (the model has
always allowed NULL). On a database created from the initial migration, storing such an IPO failed with a
NotNullViolation - found by the first live run of the nightly job.

Revision ID: e4c9a1b73d58
Revises: d3b8e0f56a72
Create Date: 2026-11-13 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e4c9a1b73d58'
down_revision: Union[str, None] = 'd3b8e0f56a72'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = ('issue_open_date', 'issue_close_date')


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not insp.has_table('ipos'):
        return
    current = {c['name']: c for c in insp.get_columns('ipos')}
    for name in COLUMNS:
        if name in current and not current[name]['nullable']:
            with op.batch_alter_table('ipos') as batch:  # batch mode keeps SQLite working too
                batch.alter_column(name, existing_type=sa.Date(), nullable=True)


def downgrade() -> None:
    pass  # non-destructive: rows with NULL dates may exist now
