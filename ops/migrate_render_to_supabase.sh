#!/usr/bin/env bash
set -euo pipefail

# Safe one-shot migration from source Postgres (Render) to destination Postgres (Supabase).
#
# Required env vars:
#   SRC_DATABASE_URL   - full source PostgreSQL URL
#   DEST_DATABASE_URL  - full destination PostgreSQL URL
#
# Optional env vars:
#   MIGRATION_WORKDIR  - directory to store dump and verification files
#   DUMP_FILE          - explicit dump file path (defaults under MIGRATION_WORKDIR)
#
# Usage:
#   SRC_DATABASE_URL='postgresql://...' DEST_DATABASE_URL='postgresql://...' \
#   ./ops/migrate_render_to_supabase.sh

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd psql
require_cmd pg_dump
require_cmd pg_restore
require_cmd diff

SRC_DATABASE_URL="${SRC_DATABASE_URL:-}"
DEST_DATABASE_URL="${DEST_DATABASE_URL:-}"

if [[ -z "$SRC_DATABASE_URL" || -z "$DEST_DATABASE_URL" ]]; then
  echo "Both SRC_DATABASE_URL and DEST_DATABASE_URL are required." >&2
  exit 1
fi

WORKDIR="${MIGRATION_WORKDIR:-./tmp/db_migration_$(date +%Y%m%d_%H%M%S)}"
mkdir -p "$WORKDIR"

DUMP_FILE="${DUMP_FILE:-$WORKDIR/render_to_supabase.dump}"
SRC_COUNTS_FILE="$WORKDIR/source_table_counts.csv"
DEST_COUNTS_FILE="$WORKDIR/dest_table_counts.csv"
SRC_SEQ_FILE="$WORKDIR/source_sequences.csv"
DEST_SEQ_FILE="$WORKDIR/dest_sequences.csv"

TABLE_COUNT_SQL="
WITH tables AS (
  SELECT schemaname, tablename
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY 1, 2
)
SELECT
  schemaname || '.' || tablename AS table_name,
  (
    xpath(
      '/row/c/text()',
      query_to_xml(format('SELECT count(*) AS c FROM %I.%I', schemaname, tablename), true, true, '')
    )
  )[1]::text::bigint AS row_count
FROM tables
ORDER BY 1;
"

SEQUENCE_SQL="
SELECT
  schemaname || '.' || sequencename AS sequence_name,
  last_value
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY 1;
"

echo "[1/6] Testing source and destination connectivity..."
psql "$SRC_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "SELECT 1;" >/dev/null
psql "$DEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "SELECT 1;" >/dev/null

echo "[2/6] Capturing source pre-migration verification snapshots..."
psql "$SRC_DATABASE_URL" -X -A -t -F',' -v ON_ERROR_STOP=1 -c "$TABLE_COUNT_SQL" > "$SRC_COUNTS_FILE"
psql "$SRC_DATABASE_URL" -X -A -t -F',' -v ON_ERROR_STOP=1 -c "$SEQUENCE_SQL" > "$SRC_SEQ_FILE"

echo "[3/6] Creating source dump: $DUMP_FILE"
pg_dump "$SRC_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$DUMP_FILE"

echo "[4/6] Restoring dump into destination database..."
pg_restore \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --single-transaction \
  --dbname "$DEST_DATABASE_URL" \
  "$DUMP_FILE"

echo "[5/6] Capturing destination post-migration verification snapshots..."
psql "$DEST_DATABASE_URL" -X -A -t -F',' -v ON_ERROR_STOP=1 -c "$TABLE_COUNT_SQL" > "$DEST_COUNTS_FILE"
psql "$DEST_DATABASE_URL" -X -A -t -F',' -v ON_ERROR_STOP=1 -c "$SEQUENCE_SQL" > "$DEST_SEQ_FILE"

echo "[6/6] Comparing source vs destination snapshots..."
COUNTS_DIFF_FILE="$WORKDIR/table_count.diff"
SEQ_DIFF_FILE="$WORKDIR/sequence.diff"

set +e
diff -u "$SRC_COUNTS_FILE" "$DEST_COUNTS_FILE" > "$COUNTS_DIFF_FILE"
COUNTS_EXIT=$?
diff -u "$SRC_SEQ_FILE" "$DEST_SEQ_FILE" > "$SEQ_DIFF_FILE"
SEQ_EXIT=$?
set -e

if [[ $COUNTS_EXIT -eq 0 && $SEQ_EXIT -eq 0 ]]; then
  echo "Migration verification passed. Table counts and sequence values match."
  echo "Artifacts saved under: $WORKDIR"
  exit 0
fi

echo "Migration completed but verification mismatch detected." >&2
if [[ $COUNTS_EXIT -ne 0 ]]; then
  echo "Table count differences: $COUNTS_DIFF_FILE" >&2
fi
if [[ $SEQ_EXIT -ne 0 ]]; then
  echo "Sequence differences: $SEQ_DIFF_FILE" >&2
fi
echo "Review mismatch files before switching production DATABASE_URL." >&2
exit 2
