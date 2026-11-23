# راه‌اندازی روی سرور

پلتفرم با Docker Compose اجرا می‌شود: PostgreSQL، API، وب‌اپ و nginx. nginx سایت تعاملی فعلی تادا را در `/` و فروشگاه را در `/shop` سرو می‌کند.

## پیش‌نیاز

- یک سرور لینوکسی (۲ هسته و ۴ گیگ رم کافی است) با Docker و Docker Compose.
- دامنه‌ای که به IP سرور اشاره کند (مثلاً `tada.ir`).
- برای درگاه بانکی ایرانی، سرور داخل ایران معمولاً بی‌دردسرتر است (بعضی درگاه‌ها فقط IP ایرانی یا ثبت‌شده را قبول می‌کنند).
- کد پذیرنده‌ی زرین‌پال (به نام کسب‌وکار، با اینماد) و کلید API کاوه‌نگار با یک قالب پیامک تأیید.

## مراحل

```bash
git clone <repo> /opt/tada && cd /opt/tada/platform
cp .env.example .env          # همه‌ی مقادیر را پر کنید
openssl rand -base64 48       # برای SESSION_SECRET
./deploy/sync-site.sh         # سایت تعاملی را در deploy/site کپی می‌کند
docker compose up -d --build
docker compose exec api node dist/seed.js   # منو، شعبه‌ها، میزها و حساب owner (رمز یک‌بار چاپ می‌شود)
```

سپس وارد `https://دامنه/admin` شوید، رمز owner را عوض کنید و:

1. قیمت‌های واقعی را در «منو و محصولات» وارد کنید.
2. در «شعبه‌ها» محل هر شعبه را روی نقشه ثبت و دلیوری را تنظیم کنید.
3. در «همکاران» برای مدیر هر شعبه و باریستاها حساب بسازید.
4. از «میزها و QR» برگه‌ی QR هر شعبه را چاپ کنید.

## HTTPS

```bash
docker compose stop nginx                     # پورت ۸۰ برای certbot آزاد شود
certbot certonly --standalone -d tada.ir      # یک‌بار
cp /etc/letsencrypt/live/tada.ir/fullchain.pem /etc/letsencrypt/live/tada.ir/privkey.pem deploy/certs/
# در .env:  NGINX_MODE=https
docker compose up -d nginx
```

برای تمدید خودکار، certbot را با `--deploy-hook` تنظیم کنید که گواهی‌ها را در `deploy/certs` کپی و `docker compose restart nginx` اجرا کند.

## پشتیبان‌گیری

```bash
crontab -e
15 4 * * *  cd /opt/tada/platform && ./deploy/backup.sh >> backups/backup.log 2>&1
```

پشتیبان روزانه‌ی پایگاه داده و عکس‌ها ۳۰ روز نگه داشته می‌شود. پوشه‌ی `backups` را هر روز به جای دیگری هم کپی کنید. بازگردانی: دستور داخل `deploy/backup.sh`.

## به‌روزرسانی

```bash
git pull && ./deploy/sync-site.sh && docker compose up -d --build
```

مهاجرت‌های پایگاه داده هنگام شروع API خودکار اجرا می‌شوند (`prisma migrate deploy`).

## تنظیمات مهم `.env`

| متغیر | توضیح |
|---|---|
| `PUBLIC_WEB_URL` | آدرس عمومی با https. برای بازگشت از درگاه، QR میزها و بررسی مبدأ درخواست‌ها |
| `SESSION_SECRET` | دست‌کم ۳۲ نویسه‌ی تصادفی |
| `PAYMENT_DRIVER` | `zarinpal` (درگاه آزمایشی در production رد می‌شود) |
| `ZARINPAL_MERCHANT_ID` | کد پذیرنده |
| `SMS_DRIVER`، `KAVENEGAR_*` | کلید و نام قالب کد ورود؛ خط اختصاصی برای پیامک وضعیت سفارش |
| `ACCOUNTING_DRIVER` | `none` یا `webhook` (راهنما در OPERATIONS.md) |
| `LLM_BASE_URL`، `LLM_MODEL` | اختیاری؛ خالی یعنی دستیار در حالت هدایت‌شده |
| `NEXT_PUBLIC_MAP_TILES` | اختیاری؛ آدرس کاشی‌های نقشه (هنگام build) |

## سلامت و پایش

- `GET /api/health` وضعیت API و پایگاه داده را برمی‌گرداند؛ کانتینرها healthcheck دارند.
- یک سرویس پایش بیرونی (UptimeRobot یا مشابه) را روی `/api/health` و `/shop` تنظیم کنید.
- لاگ‌ها: `docker compose logs -f api web nginx`.
