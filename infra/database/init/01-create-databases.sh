#!/bin/sh
# One database and one login role per service. A service can only connect to its own database, with its own password
# (DB_PASSWORD_<SERVICE>, see .env.example); none of them knows the admin password (POSTGRES_PASSWORD).
# Runs automatically when the Postgres volume is first created (docker-entrypoint-initdb.d).
# Safe to run again on an existing volume: it creates what is missing and sets each role's password to the current value,
# so it is also how a password is changed or an install made before per-service passwords is brought up to date:
#   docker compose exec -T postgres sh /docker-entrypoint-initdb.d/01-create-databases.sh
# Tables are not created here: each service applies its own Prisma migrations when it starts.
set -eu

for svc in auth company user vehicle gps_device gps_data transport alert integration; do
  name="DB_PASSWORD_$(echo "$svc" | tr 'a-z' 'A-Z')"
  eval "pw=\${$name:-}"
  if [ -z "$pw" ]; then echo "missing $name (see .env.example)" >&2; exit 1; fi
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -v role="${svc}_svc" -v db="${svc}_db" -v pw="$pw" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'pw') WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role') \gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'role', :'pw') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'role') WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db') \gexec
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
SQL
  echo "ready: ${svc}_db (role ${svc}_svc)"
done
