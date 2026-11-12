"""Rehearse `alembic upgrade head` against the database in DATABASE_URL WITHOUT changing it.

The whole upgrade runs inside one transaction (PostgreSQL DDL is transactional); the schema is compared
with the models while still inside it, then the transaction is ROLLED BACK. Row counts of the main tables
before/after are printed so you can see nothing changed.

    cd apps/api && python scripts/db_dry_run.py
"""
import os
import sys
from pathlib import Path

API = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(API / ".env")

from alembic import command  # noqa: E402
from alembic.autogenerate import compare_metadata  # noqa: E402
from alembic.config import Config  # noqa: E402
from alembic.runtime.migration import MigrationContext  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

TABLES = ["ipos", "ai_reports", "family_accounts", "ipo_orders", "allotments", "asba_locks", "system_settings"]


def main() -> int:
    url = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    if not url.startswith("postgres"):
        print("DATABASE_URL must be a PostgreSQL URL")
        return 2
    engine = create_engine(url)
    from app.models.base import Base
    import app.models  # noqa: F401

    cfg = Config(str(API / "alembic.ini"))
    cfg.set_main_option("script_location", str(API / "alembic"))

    with engine.connect() as conn:
        def counts():
            return {t: conn.execute(text(f"SELECT count(*) FROM {t}")).scalar() for t in TABLES
                    if conn.execute(text("SELECT to_regclass(:t)"), {"t": f"public.{t}"}).scalar()}

        trans = conn.begin()
        try:
            before = counts()
            version_before = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
            cfg.attributes["connection"] = conn
            command.upgrade(cfg, "head")
            version_after = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
            diffs = compare_metadata(MigrationContext.configure(conn), Base.metadata)
            structural = [
                f"{op[0]}: {getattr(op[1], 'name', op[1])}" if op[0].endswith("table")
                else f"{op[0]}: {op[2]}.{getattr(op[3], 'name', op[3])}"
                for d in diffs for op in (d if isinstance(d, list) else [d])
                if op[0] in ("add_table", "remove_table", "add_column", "remove_column")
            ]
            after = counts()
            print(f"alembic_version inside the transaction: {version_before} -> {version_after}")
            print("remaining structural differences vs models:", structural or "none")
            print("row counts unchanged:", before == {k: after[k] for k in before})
        finally:
            trans.rollback()
        print("ROLLED BACK - the database was not changed.")
        print("alembic_version now:", conn.execute(text("SELECT version_num FROM alembic_version")).scalar())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
