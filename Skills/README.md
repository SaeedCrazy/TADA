# Skills

مهارت‌های Claude Code برای پروژه‌ی تادا. هر پوشه یک مهارت با `SKILL.md` است.
Claude Code مهارت‌ها را از `.claude/skills` می‌خواند؛ در این مخزن `.claude/skills` به همین پوشه اشاره دارد.

## مهارت‌های اختصاصی تادا (نوشته‌شده برای همین پروژه)

| مهارت | کاربرد |
|---|---|
| `tada-brand-ui` | هویت بصری، رنگ‌ها، فونت، طرح‌های خطی، متن فارسی، RTL، دسترس‌پذیری |
| `tada-backend` | قواعد API، Prisma 7، سفارش و پرداخت، افزودن endpoint |
| `tada-security` | چک‌لیست امنیتی هر تغییر |
| `tada-testing` | اجرای و نوشتن تست‌های واحد، یکپارچه و end-to-end |
| `tada-payments-iran` | زرین‌پال، ریال و تومان، اینماد و شاپرک، کاوه‌نگار |
| `tada-assistant` | دستیار تادا: موتور ذائقه، گفت‌وگو، ابزارها، قواعد ایمنی |
| `tada-ops` | راه‌اندازی، به‌روزرسانی، پشتیبان، پایش، روال پشتیبانی |

## مهارت‌های عمومی (از منابع معتبر، بازبینی‌شده)

| مهارت | منبع | مجوز |
|---|---|---|
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | MIT |
| `frontend-design`, `webapp-testing` | anthropics/skills | Apache-2.0 |
| `sharp-edges`, `differential-review`, `supply-chain-risk-auditor`, `property-based-testing` | trailofbits/skills | CC-BY-SA-4.0 |
| `prisma-cli`, `prisma-client-api`, `prisma-orm-setup`, `prisma-database-setup` | prisma/skills (نصب با `prisma init`) | MIT |

منبع و commit هر مهارت در فایل `SOURCE.md` همان پوشه آمده است. اسکریپت‌های مهارت‌های بیرونی پیش از افزودن بازبینی شدند
(ابزار جست‌وجوی `ui-ux-pro-max` کاملاً محلی است و به شبکه وصل نمی‌شود). تست‌های داخلی آن مهارت و پیکربندی‌های مخصوص
ابزارهای دیگر حذف شده‌اند.

ابزار جست‌وجوی UI/UX:

```bash
python3 Skills/ui-ux-pro-max/scripts/search.py "checkout form" --domain ux
python3 Skills/ui-ux-pro-max/scripts/search.py "cafe ordering" --design-system
```
