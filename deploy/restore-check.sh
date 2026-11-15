#!/bin/sh
set -eu
umask 077

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  printf 'Usage: sh deploy/restore-check.sh BACKUP_FILE\n' >&2
  exit 2
fi
backup=$(realpath "$1")
cd "$(dirname "$0")/.."
restore_db="partypick_restore_$(date +%s)_$$"
created=0
cleanup() {
  if [ "$created" -eq 1 ]; then
    docker compose exec -T db sh -c \
      'PGPASSWORD="$POSTGRES_PASSWORD" exec dropdb -h 127.0.0.1 -U postgres --if-exists "$1"' \
      sh "$restore_db" >/dev/null
  fi
}
trap cleanup EXIT HUP INT TERM

docker compose exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_PASSWORD" exec createdb -h 127.0.0.1 -U postgres -O partypick "$1"' \
  sh "$restore_db"
created=1
docker compose exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_APP_PASSWORD" exec pg_restore -h 127.0.0.1 -U partypick -d "$1" --no-owner --no-acl --exit-on-error' \
  sh "$restore_db" < "$backup"

counts=$(docker compose exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_APP_PASSWORD" exec psql -h 127.0.0.1 -U partypick -d "$1" -At -F "|" -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM guest_sessions), (SELECT count(*) FROM rooms), (SELECT count(*) FROM guest_libraries), (SELECT count(*) FROM game_catalog)"' \
  sh "$restore_db")
IFS='|' read -r sessions rooms libraries catalog <<EOF
$counts
EOF
case "$sessions:$rooms:$libraries:$catalog" in
  *[!0-9:]*|'') printf 'Restore verification returned invalid counts\n' >&2; exit 1 ;;
esac
if [ "$catalog" -lt 1 ] ||
   [ "$rooms" -lt "${EXPECT_MIN_ROOMS:-0}" ] ||
   [ "$libraries" -lt "${EXPECT_MIN_LIBRARIES:-0}" ]; then
  printf 'Restore verification failed minimum content checks\n' >&2
  exit 1
fi
if [ "${EXPECT_SAME_AS_LIVE:-0}" = 1 ]; then
  # Only for a quiescent database: the live DB can change after pg_dump's snapshot.
  digest_sql="SELECT md5(
    (SELECT coalesce(string_agg(to_jsonb(t)::text, ',' ORDER BY to_jsonb(t)::text), '') FROM guest_sessions t) ||
    (SELECT coalesce(string_agg(to_jsonb(t)::text, ',' ORDER BY to_jsonb(t)::text), '') FROM rooms t) ||
    (SELECT coalesce(string_agg(to_jsonb(t)::text, ',' ORDER BY to_jsonb(t)::text), '') FROM guest_libraries t) ||
    (SELECT coalesce(string_agg(to_jsonb(t)::text, ',' ORDER BY to_jsonb(t)::text), '') FROM game_catalog t)
  )"
  live_digest=$(docker compose exec -T db sh -c \
    'PGPASSWORD="$POSTGRES_APP_PASSWORD" exec psql -h 127.0.0.1 -U partypick -d partypick -At -v ON_ERROR_STOP=1 -c "$1"' \
    sh "$digest_sql")
  restored_digest=$(docker compose exec -T db sh -c \
    'PGPASSWORD="$POSTGRES_APP_PASSWORD" exec psql -h 127.0.0.1 -U partypick -d "$1" -At -v ON_ERROR_STOP=1 -c "$2"' \
    sh "$restore_db" "$digest_sql")
  if [ "$live_digest" != "$restored_digest" ]; then
    printf 'Restore content differs from live database\n' >&2
    exit 1
  fi
fi
printf 'Restore verified: sessions=%s rooms=%s libraries=%s catalog=%s\n' "$sessions" "$rooms" "$libraries" "$catalog"
