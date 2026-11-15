#!/bin/sh
set -eu
umask 077

cd "$(dirname "$0")/.."
mkdir -p backups
backup="backups/partypick-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
partial="$backup.partial"
trap 'rm -f "$partial"' EXIT HUP INT TERM

docker compose exec -T db sh -c \
  'PGPASSWORD="$POSTGRES_APP_PASSWORD" exec pg_dump -h 127.0.0.1 -U partypick -d partypick -Fc --no-owner --no-acl' \
  > "$partial"
test -s "$partial"
mv "$partial" "$backup"
trap - EXIT HUP INT TERM
printf 'Backup saved: %s\n' "$backup"
