#!/usr/bin/env bash
set -euo pipefail

echo "[SEED] Initializing database tables and default datasets..."
python -c "
import asyncio
from app.db.database import init_db
asyncio.run(init_db())
"
echo "[SEED] Completed successfully."
