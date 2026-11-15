#!/bin/sh

# The image's postgres role is reserved for administration; API uses this role.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  <<'SQL'
\getenv app_password POSTGRES_APP_PASSWORD
CREATE ROLE partypick LOGIN PASSWORD :'app_password';
CREATE DATABASE partypick OWNER partypick;
SQL
