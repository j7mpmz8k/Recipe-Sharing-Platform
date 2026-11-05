#!/bin/sh
set -e

# Run database migrations automatically if RUN_MIGRATIONS is true
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] Running database migrations..."
  node migrate.js
fi

# Hand off execution to CMD (node server.js)
exec "$@"
