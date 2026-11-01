#!/usr/bin/env bash
set -euo pipefail

# kapitl database backup script
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kapitl}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/kapitl_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting database backup at ${TIMESTAMP}..."

if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"
else
  docker exec -t kapitl-postgres pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-kapitl}" | gzip > "${BACKUP_FILE}"
fi

echo "[INFO] Backup completed successfully: ${BACKUP_FILE}"

# Keep last 14 days of backups
find "${BACKUP_DIR}" -type f -name "kapitl_backup_*.sql.gz" -mtime +14 -delete
echo "[INFO] Old backups cleaned up."

