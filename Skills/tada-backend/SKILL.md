---
name: tada-backend
description: Conventions for the Tada API (platform/apps/api, Fastify 5 + Prisma 7 + PostgreSQL) and the shared package. Use when adding or changing endpoints, database models, migrations, order/payment logic, workers or integrations.
---

# Tada backend

## Layout

```
apps/api/src/
  app.ts            buildApp(): plugins, CSRF origin check, route registration
  config.ts         zod-validated env; unsafe production combinations throw
  context.ts        AppContext (db, bus, sms, payments, accounting, llm) — tests override drivers here
  plugins/auth.ts   sessions, requireCustomer / requireStaff(roles) / branchScope / assertBranchAccess
  modules/<area>/   *.routes.ts (HTTP) + *.service.ts (logic) + drivers
  workers.ts        payment timeout, accounting outbox, cleanup
packages/shared/    enums, zod request schemas, taste engine, hours, money and phone helpers
```

## Rules

- **Validate everything** with `parse(schema, input)` (lib/util.ts); shared request schemas live in `@tada/shared`.
- **Errors**: throw `AppError` helpers (`badRequest('code')`, `conflict`, `notFound`, `forbidden`). Codes are
  stable snake_case strings the web app translates in `lib/i18n.ts → errors`. Never leak internals.
- **Money** is integer rials end to end. The client never sends prices; `priceCart()` computes them.
- **State changes** run in a transaction guarded by the status they expect
  (`updateMany({ where: { id, status: from } })` and check `count`). Reserve stock and discount usage with
  conditional updates. Order creation is idempotent on `idempotencyKey`.
- **Staff actions**: check role with `requireStaff(req, [...])`, scope with `branchScope`/`assertBranchAccess`,
  and write an `audit(...)` entry.
- **Raw SQL** only through tagged templates (`$queryRaw\`...\``) — never string concatenation.
- **Events**: emit order changes on `ctx.bus` so the bar screen (SSE) updates.
- **Integrations** are drivers behind interfaces (payments, SMS, accounting, LLM) with a fake for tests.

## Prisma 7 specifics

- Client is generated to `src/generated/prisma` (`prisma generate`); import from `./db.js`.
- `prisma.config.ts` holds the datasource URL; the client uses `@prisma/adapter-pg`.
- New migration: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <change>` against the dev DB.
  Never run `migrate reset` on anything but a throwaway database. Production applies `migrate deploy` on start.
- Reference: `Skills/prisma-client-api`, `Skills/prisma-cli`.

## Adding an endpoint (checklist)

1. Schema in `@tada/shared` if the web app sends it; otherwise local zod.
2. Route with auth/role/branch checks first, then `parse`, then the service call.
3. Rate limit sensitive routes (`config: { rateLimit: { max, timeWindow } }`).
4. Integration test in `src/test/*.test.ts` (happy path, auth, wrong branch, bad input).
5. Error code added to `apps/web/src/lib/i18n.ts` in both languages if users can see it.
