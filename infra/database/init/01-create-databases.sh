#!/bin/sh
# One database and one login role per service. A service can only connect to its own database.
# Runs automatically when the Postgres volume is first created (docker-entrypoint-initdb.d).
# Safe to run again on an existing volume (it only creates what is missing):
#   docker compose exec -T postgres sh /docker-entrypoint-initdb.d/01-create-databases.sh
# Tables are not created here: each service applies its own Prisma migrations when it starts.
set -eu

for svc in auth company user vehicle gps_device gps_data transport alert integration; do
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -v role="${svc}_svc" -v db="${svc}_db" -v pw="$POSTGRES_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'pw') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'role') WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db') \gexec
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
SQL
  echo "ready: ${svc}_db (role ${svc}_svc)"
done
