---
name: tada-testing
description: How to run and write tests for the Tada platform — shared unit tests, API integration tests on PostgreSQL, and Playwright end-to-end tests with accessibility checks. Use when adding features, fixing bugs, or verifying a change works.
---

# Testing the Tada platform

| Layer | Command | Database |
|---|---|---|
| Shared (pure functions) | `pnpm --filter @tada/shared test` | none |
| API integration | `pnpm --filter @tada/api test` | `tada_test` (truncated per file) |
| End to end | `pnpm --filter @tada/web e2e` | `tada_e2e` (reseeded on start) |

Guards refuse to run against databases not named `tada_test` / `*_e2e`. Never point tests at real data.

## API tests (apps/api/src/test)

- `createTestApp(env?, overrides?)` builds the app on a clean, seeded database with fake SMS and accounting
  drivers, branches open around the clock, and `OTP_TEST_CODE`.
- `Client` keeps cookies and sends our Origin on writes; `loginCustomer(app, phone)`, `loginStaff(app, user, pw)`.
- `fixtures(db)` gives branches, a table, products and option lookups.
- Pass time explicitly (`expireUnpaidOrders(ctx, futureDate)`) instead of waiting.
- Test the unhappy paths: wrong role, wrong branch, bad input, races (`Promise.all` of the same request).

## End-to-end (apps/web/e2e)

- Playwright `@playwright/test` is pinned to 1.63.0 to match the preinstalled browser. Run with `--trace off`.
- The config starts the API on :4100 (`e2e/start-api.sh`) and a **production build** of the web app on :3100.
- Helpers: `addFromMenu(page, name, options)`, `otpLogin(page, phone)` (code 11111), `staffLogin(page, user, pw)`,
  `expectAccessible(page)` (axe, WCAG 2.1 AA serious/critical must be empty), `trackErrors(page)`.
- Shop specs run on Pixel 7; admin specs on desktop. Prefer role/label locators in Persian, like a user would.

## Before calling something done

Run the layer you touched and the e2e suite, then look at the screens you changed (mobile and desktop).
For property-style checks of money/taste logic see `Skills/property-based-testing`; for browser automation
patterns see `Skills/webapp-testing`.
