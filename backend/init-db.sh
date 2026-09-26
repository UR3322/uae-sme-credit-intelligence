#!/usr/bin/env bash
set -euo pipefail

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set for the runtime database role}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE app LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE uae_sme_cip TO app;
GRANT USAGE ON SCHEMA public TO app;
SQL
