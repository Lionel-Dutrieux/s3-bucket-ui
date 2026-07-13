#!/bin/sh
# Apply any pending schema migrations, then start the server. `migrate deploy`
# is idempotent — it only runs migrations not yet recorded in the database — so
# it is safe on every boot and across replicas.
set -e

echo "[entrypoint] applying database migrations…"
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting server…"
exec node server.js
