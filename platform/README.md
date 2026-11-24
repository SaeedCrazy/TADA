# پلتفرم یکپارچه‌ی فروش و سفارش تادا

سایت تعاملی تادا، فروشگاه آنلاین، پنل مدیریت، سفارش سر میز با QR، تحویل در شعبه، دلیوری، صفحه‌ی بار، اتصال به حسابداری و دستیار هوشمند؛ همه در یک پلتفرم با هویت بصری خود تادا.

> English summary at the end.

## چه چیزی ساخته شده

| فاز | بخش | کجا |
|---|---|---|
| ۱ | فروشگاه آنلاین (فارسی و انگلیسی)، صفحه‌ی محصول با سئو، سبد، پرداخت آنلاین، پیگیری سفارش، حساب مشتری با ورود پیامکی | `apps/web/src/app/(shop)` |
| ۱ | پنل مدیریت: داشبورد، سفارش‌ها، منو و محصولات، موجودی هر شعبه، شعبه‌ها و ساعت کاری، کدهای تخفیف، مشتری‌ها، همکاران و نقش‌ها، گزارش فروش، گزارش تغییرات، تنظیمات | `apps/web/src/app/(staff)/admin` |
| ۱ | API: قیمت‌گذاری سمت سرور، سفارش idempotent، درگاه زرین‌پال، تخفیف، نقش‌ها، گزارش | `apps/api` |
| ۲ | سفارش سر میز با QR (هر میز کد جدا، قابل تعویض)، تحویل در شعبه، دلیوری با نقشه و محاسبه‌ی هزینه بر اساس فاصله، پرداخت دم در | `apps/api/src/modules/orders` |
| ۲ | صفحه‌ی بار: سفارش‌ها زنده (SSE)، صدای سفارش جدید، چاپ فیش ۸۰ میلی‌متری | `apps/web/src/app/(staff)/bar` |
| ۲ | پیامک: کد ورود و اطلاع‌رسانی وضعیت سفارش (کاوه‌نگار) | `apps/api/src/modules/notify` |
| ۲ | حسابداری: صف ارسال فاکتور (وب‌هوک امضاشده با تلاش دوباره) و خروجی CSV | `apps/api/src/modules/accounting` |
| ۳ | دستیار تادا: پرسش‌نامه‌ی ذائقه، گفت‌وگو، پیشنهاد فقط از منوی موجود شعبه، سبد پیشنهادی، بازبینی گفت‌وگوها در پنل | `apps/api/src/modules/assistant`، `packages/shared/src/taste.ts` |

## ساختار

```
platform/
  apps/api        Fastify 5 + Prisma 7 + PostgreSQL 16 (TypeScript)
  apps/web        Next.js 16 + React 19 (فروشگاه، پنل، صفحه‌ی بار)
  packages/shared ثابت‌ها، اعتبارسنجی (zod)، موتور ذائقه، ساعت کاری، قیمت و شماره‌ی موبایل
  deploy/         Dockerfileها، nginx، پشتیبان‌گیری
  docs/           راه‌اندازی، امنیت، نگهداری
```

## اجرا برای توسعه

پیش‌نیاز: Node 22، pnpm 10، PostgreSQL 16.

```bash
cd platform
pnpm install
cp apps/api/.env.example apps/api/.env   # یا از روی نمونه‌ی پایین بسازید
pnpm --filter @tada/shared build
pnpm --filter @tada/api exec prisma migrate deploy
SEED_OWNER_PASSWORD='یک-رمز-محلی' pnpm db:seed
pnpm dev:api     # http://localhost:4000
pnpm dev:web     # http://localhost:3000/shop  و  /admin  و  /bar
```

نمونه‌ی `apps/api/.env` برای توسعه:

```
NODE_ENV=development
DATABASE_URL=postgresql://tada:tada@localhost:5432/tada?schema=public
SESSION_SECRET=dev-only-session-secret-change-me-0123456789
PUBLIC_WEB_URL=http://localhost:3000
PAYMENT_DRIVER=mock
SMS_DRIVER=console
```

در توسعه کد ورود پیامکی در لاگ API چاپ می‌شود و درگاه آزمایشی بدون جابه‌جایی پول کار می‌کند. هر دو در حالت production رد می‌شوند.

## تست‌ها

| دستور | چه چیزی |
|---|---|
| `pnpm --filter @tada/shared test` | ۱۱ تست: موبایل، قیمت، ساعت کاری، موتور ذائقه، اعتبارسنجی |
| `pnpm --filter @tada/api test` | ۶۲ تست یکپارچه روی PostgreSQL واقعی (پایگاه `tada_test`) |
| `pnpm --filter @tada/web e2e` | ۱۸ تست Playwright روی نسخه‌ی production، با بررسی دسترس‌پذیری WCAG 2.1 AA (پایگاه `tada_e2e`) |

## راه‌اندازی روی سرور

با یک دستور (Ubuntu یا Debian، با root):

```bash
curl -fsSL https://raw.githubusercontent.com/SaeedCrazy/TADA/ccr-6da8ed3f-1rtojo/platform/deploy/install.sh -o install.sh
bash install.sh                                            # نسخه‌ی نمایشی روی IP سرور
bash install.sh --domain tada.ir --email you@example.com   # نسخه‌ی واقعی با HTTPS
```

اجرای دوباره = به‌روزرسانی. جزئیات و نصب دستی در [docs/DEPLOY.md](docs/DEPLOY.md).

## تصمیم‌ها و چیزهایی که باید بدانید

- **قیمت‌های منو نمونه است.** محصولات و شعبه‌ها از سایت تادا آمده‌اند، اما قیمت‌ها حدسی‌اند؛ در پنل اصلاح کنید.
- **محل شعبه‌ها خالی است.** دلیوری هر شعبه وقتی روشن می‌شود که محلش روی نقشه ثبت شود (پنل ← شعبه‌ها).
- **درگاه پرداخت: زرین‌پال** (REST v4، مبلغ به ریال). مبلغ همیشه از پایگاه داده خوانده و پس از بازگشت از درگاه، سمت سرور تأیید می‌شود.
- **پیامک: کاوه‌نگار.** کد ورود با قالب `verify/lookup` و اطلاع‌رسانی سفارش با خط اختصاصی.
- **حسابداری:** چون نرم‌افزار فعلی تادا مشخص نیست، اتصال از راه وب‌هوک امضاشده (یک مبدل کوچک کنار هر نرم‌افزاری) و خروجی CSV است. راهنما: [docs/OPERATIONS.md](docs/OPERATIONS.md).
- **دستیار:** بدون هیچ سرویس بیرونی در حالت «هدایت‌شده» کار می‌کند. برای گفت‌وگوی آزاد، هر سرویس سازگار با OpenAI که استفاده‌اش برای شما قانونی است (مثلاً یک مدل متن‌باز روی سرور خودتان با vLLM یا Ollama) را در `.env` تنظیم کنید. سرویس‌های Anthropic و OpenAI رسماً در ایران ارائه نمی‌شوند.
- **نقشه:** کاشی‌های OpenStreetMap؛ با `NEXT_PUBLIC_MAP_TILES` قابل تعویض (مثلاً نقشه‌ی داخلی).
- **سایت تعاملی:** همان سایت فعلی در `/` سرو می‌شود. دکمه‌ی «سفارش» آن هنوز به `https://tada.ir` اشاره دارد؛ در شاخه‌ی `v2` مقدار `SITE.shop` را به `/shop` تغییر دهید و با دستور `tada` منتشر کنید.

---

## English summary

The Tada unified ordering and commerce platform: storefront (Persian and English), admin panel, table QR ordering, pickup, delivery with distance pricing, a live bar screen, SMS, accounting sync (signed webhook + CSV), and the Tada assistant (taste quiz + chat with tools, guided mode without any external service). Fastify + Prisma + PostgreSQL API, Next.js web app, shared TypeScript package, Docker Compose deployment behind nginx that also serves the existing Tada website at `/`.

Tests: 11 shared unit tests, 62 API integration tests on real PostgreSQL, 18 Playwright end-to-end tests on a production build including axe WCAG 2.1 AA checks. A production-mode Docker stack was built and smoke-tested (TLS, secure cookies, CSRF origin check, SSE through nginx).

Docs: [DEPLOY](docs/DEPLOY.md) · [SECURITY](docs/SECURITY.md) · [OPERATIONS](docs/OPERATIONS.md). Project skills for Claude Code live in [`../Skills`](../Skills).
