#!/usr/bin/env bash
# Starts the API for end-to-end tests on its own database and port.
set -euo pipefail
cd "$(dirname "$0")/../../api"
export NODE_ENV=development
export DATABASE_URL="${E2E_DATABASE_URL:-postgresql://tada:tada@localhost:5432/tada_e2e?schema=public}"
export SESSION_SECRET=e2e-session-secret-0123456789-abcdefghijkl
export PUBLIC_WEB_URL=http://localhost:3100
export PORT=4100
export PAYMENT_DRIVER=mock
export SMS_DRIVER=console
export OTP_TEST_CODE=11111
export RATE_LIMIT=false
export LOG_LEVEL=warn
export UPLOAD_DIR=/tmp/tada-e2e-uploads
npx prisma migrate deploy > /dev/null
npx tsx src/e2e-seed.ts
exec npx tsx src/server.ts
