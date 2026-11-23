---
name: tada-security
description: Security checklist for any change to the Tada platform — auth, sessions, roles, payments, uploads, exports, the assistant, configuration or dependencies. Use before merging or deploying, and when reviewing a diff for vulnerabilities.
---

# Tada security checklist

Full description of the controls: `platform/docs/SECURITY.md`. For a change, confirm each line that applies.

## Identity and access
- [ ] New staff route calls `requireStaff(req, roles)` and branch scoping (`branchScope` / `assertBranchAccess`).
- [ ] New customer data route calls `requireCustomer` and filters by `customer.id` (no IDOR).
- [ ] Guest access uses an unguessable token compared with `safeEqualText`.
- [ ] Session/OTP logic unchanged, or covered by `src/test/auth.test.ts`.
- [ ] Cookie flags unchanged (HttpOnly; Secure in prod; Lax customer / Strict staff).

## Requests
- [ ] Mutating routes stay behind the Origin check in `app.ts` (do not add exceptions).
- [ ] Input validated with zod; limits on lengths, counts and numbers.
- [ ] Rate limit on anything that sends SMS, logs in, creates orders or calls the LLM.
- [ ] No HTML built from strings without escaping; React output only; JSON-LD escapes `<`.
- [ ] Redirect targets are our own origin (payment callback, `?next=` on staff login).

## Money
- [ ] Prices and totals computed on the server from the database.
- [ ] Payment marked paid only after gateway `verify` with our stored amount; replay-safe.
- [ ] Stock and discount usage changed with conditional updates inside the transaction.

## Files and exports
- [ ] Uploads: allowlisted types, magic-byte check, size limit, random names, no SVG.
- [ ] CSV/Excel exports pass every cell through the formula-injection guard.

## Assistant
- [ ] The model reaches data only through tools; it cannot place orders or pay; ids it returns are validated.
- [ ] Taste data stored only with consent.

## Config and supply chain
- [ ] No secrets in the repo; new env vars validated in `config.ts`; dangerous combos refused in production.
- [ ] `pnpm audit --prod` clean; review new dependencies with `supply-chain-risk-auditor`.
- [ ] Run `differential-review` on the diff and `sharp-edges` on new APIs/config.
- [ ] `pnpm --filter @tada/api test` and `pnpm --filter @tada/web e2e` pass.
