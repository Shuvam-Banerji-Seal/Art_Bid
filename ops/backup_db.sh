#!/usr/bin/env bash
set -euo pipefail

# Hourly PostgreSQL backup script for festival operations.
# Usage:
#   DB_NAME=chitrakavyam DB_USER=postgres ./ops/backup_db.sh

DB_NAME="${DB_NAME:-chitrakavyam}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TS="$(date +%Y%m%d_%H%M%S)"
FILE="${BACKUP_DIR}/${DB_NAME}_${TS}.sql.gz"

mkdir -p "${BACKUP_DIR}"

pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" | gzip > "${FILE}"

# Keep last 200 backups by default.
ls -1t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | tail -n +201 | xargs -r rm -f

echo "Backup created: ${FILE}"
