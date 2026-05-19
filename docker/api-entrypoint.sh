#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

if [ "${RUN_DB_SEED:-true}" = "true" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

exec node apps/api/dist/index.js
