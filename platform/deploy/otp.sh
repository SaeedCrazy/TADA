#!/usr/bin/env bash
# Demo mode only: shows the latest login codes (the console SMS driver writes them to the API log).
# Usage: bash deploy/otp.sh [count]
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose logs --no-log-prefix --since 60m api 2>/dev/null \
  | grep 'console driver) OTP' \
  | tail -n "${1:-5}" \
  | sed -E 's/.*"phone":"([^"]+)".*"code":"([0-9]+)".*/\1  ←  \2/' \
  || echo "در یک ساعت گذشته کدی ارسال نشده است."
