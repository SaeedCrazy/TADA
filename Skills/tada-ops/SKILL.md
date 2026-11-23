---
name: tada-ops
description: Operating the Tada platform in production — deploy, update, backups and restore, monitoring, incident handling, and the monthly support routine. Use for server work, releases, outages, or support tasks.
---

# Running Tada in production

Guides: `platform/docs/DEPLOY.md` (install, HTTPS, env), `platform/docs/OPERATIONS.md` (routines,
incidents, accounting webhook), `platform/docs/SECURITY.md`.

## Commands (from platform/)
```bash
./deploy/sync-site.sh                 # copy the static Tada website for nginx
docker compose up -d --build          # start or update everything (migrations run on API start)
docker compose exec api node dist/seed.js   # first install only
docker compose logs -f api web nginx  # logs
./deploy/backup.sh                    # DB dump + uploads, 30-day retention (run daily from cron)
docker compose exec -T db pg_restore -U tada -d tada --clean < backups/db-<stamp>.dump   # restore
```

## Health
- `GET /api/health` (API + DB). Containers have healthchecks. Monitor `/api/health` and `/shop` externally.
- Bar screen shows «زنده» when its event stream is connected; nginx must not buffer `/api/staff/orders/stream`.

## Support routine
- Daily: monitoring alerts, last night's backup, accounting queue has no failures.
- Weekly: security updates (`git pull`, `pnpm audit --prod`, rebuild), error log review.
- Monthly: test-restore a backup, sales report, review assistant conversations and fix product taste data.

## Releasing a change
1. Tests: `pnpm --filter @tada/api test`, `pnpm --filter @tada/web e2e`.
2. Security: the `tada-security` checklist.
3. Deploy off-peak (outside 9–16 and 17–23 Tehran time if possible), then watch logs and the bar screen.
