#!/usr/bin/env bash
# Daily backup: a compressed database dump and the uploaded photos, kept for 30 days.
# Run from the platform/ folder, e.g. from cron:  15 4 * * *  cd /opt/tada/platform && ./deploy/backup.sh
# Copy ./backups to another machine or storage as well (an off-server copy is part of the support promise).
set -euo pipefail
cd "$(dirname "$0")/.."
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p backups
docker compose exec -T db pg_dump -U tada -d tada --format=custom > "backups/db-$stamp.dump"
docker compose exec -T api tar -C /data -czf - uploads > "backups/uploads-$stamp.tgz"
find backups -type f -mtime +30 -delete
echo "backup written: backups/db-$stamp.dump"
# Restore (into an empty database):  docker compose exec -T db pg_restore -U tada -d tada --clean < backups/db-<stamp>.dump
