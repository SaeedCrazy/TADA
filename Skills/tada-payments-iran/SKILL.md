---
name: tada-payments-iran
description: Iranian payments and SMS for the Tada platform — Zarinpal gateway flow, rial/toman handling, eNamad and Shaparak requirements, Kavenegar OTP. Use when touching payment, checkout, refunds, SMS, or when setting up a new merchant account.
---

# Payments and SMS in Iran

## Zarinpal (apps/api/src/modules/payments/drivers.ts)

1. `request`: POST `https://payment.zarinpal.com/pg/v4/payment/request.json` (sandbox: `sandbox.zarinpal.com`)
   with `merchant_id`, `amount` (rials, `currency: "IRR"`), `description`, `callback_url`, `metadata`.
   `data.code === 100` → `authority`; redirect to `/pg/StartPay/<authority>`.
2. Customer returns to `GET /api/payments/callback?o=<orderId>&Authority=&Status=OK|NOK`.
3. `verify`: POST `/pg/v4/payment/verify.json` with the **amount from our database**.
   `100` = verified, `101` = already verified (treat as success). Anything else = failed.
4. Only then: payment PAID, order PLACED, accounting job queued, SMS sent. The callback is idempotent.

Unpaid online orders are cancelled after `PAYMENT_TIMEOUT_MINUTES`; a late successful payment re-opens the
order with note `paid_after_timeout`. Refunds are made in the Zarinpal panel; staff then mark the order
refunded in the admin panel.

## Money units
Store and compute integer **rials**. Show **toman** (`formatToman`). The admin edits prices in toman
(`TomanInput` multiplies by 10).

## Merchant setup (business owner's name)
- eNamad for the domain and the gateway contract must be in the business owner's name; the settlement IBAN
  must belong to the merchant. The developer manages them as technical admin.
- Some bank gateways only accept registered or Iranian server IPs — check before choosing hosting.

## Kavenegar (apps/api/src/modules/notify/sms.ts)
- OTP: `verify/lookup.json` with `receptor`, `token` (the code), `template` (`KAVENEGAR_OTP_TEMPLATE`).
  Create the template in the Kavenegar panel with one `%token`.
- Order updates: `sms/send.json` from `KAVENEGAR_SENDER` (dedicated line). Empty sender = updates off.
- Failures are logged in `SmsLog`; OTP failures return `sms_unavailable` to the user.

## Testing
Use `PAYMENT_DRIVER=mock` (refused in production) and `SMS_DRIVER=console`. The mock gateway page has
"پرداخت موفق" and "انصراف" and verifies the amount like the real one. Driver request shapes are unit-tested
with a fake `fetch` in `src/test/drivers.test.ts` — update those tests when the provider API changes.
