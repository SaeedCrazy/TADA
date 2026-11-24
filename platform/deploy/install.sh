#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# نصب پلتفرم تادا روی یک سرور Ubuntu یا Debian (با root اجرا شود)
#
#   نسخه‌ی نمایشی روی IP سرور، بدون دامنه (پرداخت و پیامک آزمایشی):
#     bash install.sh
#
#   نسخه‌ی واقعی با دامنه و HTTPS (کلیدهای زرین‌پال و کاوه‌نگار پرسیده می‌شوند):
#     bash install.sh --domain tada.ir --email you@example.com
#
#   گزینه‌های دیگر:
#     --port 8080                  وقتی پورت ۸۰ سرور دست برنامه‌ی دیگری است (فقط نسخه‌ی نمایشی)
#     --ip 1.2.3.4                 IP عمومی، اگر خودکار درست پیدا نشد
#     --docker-mirror URL          آینه‌ی Docker Hub برای سرورهای داخل ایران
#     --npm-registry URL           آینه‌ی npm برای سرورهای داخل ایران
#     --branch NAME                شاخه‌ی گیت (پیش‌فرض: شاخه‌ای که پلتفرم در آن است)
#
# اجرای دوباره همین اسکریپت = به‌روزرسانی. فایل .env، پایگاه داده و عکس‌ها حفظ می‌شوند.
# ---------------------------------------------------------------------------
set -Eeuo pipefail

REPO_URL="${REPO_URL:-https://github.com/SaeedCrazy/TADA.git}"
BRANCH="${BRANCH:-ccr-6da8ed3f-1rtojo}"
DIR="${DIR:-/opt/tada}"
DOMAIN=""; EMAIL=""; PORT=""; PUBLIC_IP=""; MIRROR=""; NPM_REGISTRY_ARG=""
SKIP_BUILD="${TADA_SKIP_BUILD:-0}"

say()  { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!  %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mخطا: %s\033[0m\n' "$*" >&2; exit 1; }
trap 'die "اجرا در خط $LINENO متوقف شد؛ پیام بالا را ببینید."' ERR

usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:?}"; shift 2 ;;
    --email) EMAIL="${2:?}"; shift 2 ;;
    --port) PORT="${2:?}"; shift 2 ;;
    --ip) PUBLIC_IP="${2:?}"; shift 2 ;;
    --docker-mirror) MIRROR="${2:?}"; shift 2 ;;
    --npm-registry) NPM_REGISTRY_ARG="${2:?}"; shift 2 ;;
    --branch) BRANCH="${2:?}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; die "گزینه‌ی ناشناخته: $1" ;;
  esac
done

MODE=demo
if [ -n "$DOMAIN" ]; then
  MODE=production
  [ -n "$EMAIL" ] || die "برای HTTPS ایمیل لازم است: --email you@example.com"
  [ -z "$PORT" ] || [ "$PORT" = 80 ] || die "نسخه‌ی واقعی باید روی پورت‌های ۸۰ و ۴۴۳ باشد"
fi
PORT="${PORT:-80}"

# ------------------------------------------------------------------ checks
[ "$(id -u)" -eq 0 ] || die "با root اجرا کنید:  sudo bash install.sh"
. /etc/os-release
case "${ID:-}" in ubuntu|debian) ;; *) die "فقط Ubuntu یا Debian پشتیبانی می‌شود (این سرور: ${PRETTY_NAME:-نامعلوم})" ;; esac

say "نصب پیش‌نیازها"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl iproute2 >/dev/null

# ------------------------------------------------------------------ docker
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  say "نصب Docker"
  if ! curl -fsSL https://get.docker.com | sh; then
    warn "نصب از docker.com ممکن نشد؛ از مخزن سیستم‌عامل نصب می‌شود"
    apt-get install -y -qq docker.io >/dev/null
    apt-get install -y -qq docker-compose-v2 >/dev/null 2>&1 || apt-get install -y -qq docker-compose-plugin >/dev/null
  fi
fi
if [ -n "$MIRROR" ]; then
  say "تنظیم آینه‌ی Docker Hub: $MIRROR"
  mkdir -p /etc/docker
  [ -f /etc/docker/daemon.json ] && cp /etc/docker/daemon.json "/etc/docker/daemon.json.bak.$(date +%s)"
  printf '{\n  "registry-mirrors": ["%s"]\n}\n' "$MIRROR" > /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker info >/dev/null 2>&1 || die "Docker اجرا نمی‌شود"
docker compose version >/dev/null 2>&1 || die "Docker Compose نصب نشد"

# Building the images needs ~3 GB of memory; add swap on small servers.
mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$mem_mb" -lt 3500 ] && [ -z "$(swapon --show 2>/dev/null)" ]; then
  say "رم سرور ${mem_mb} مگابایت است؛ ۲ گیگ swap ساخته می‌شود"
  if { fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none; } \
     && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile; then
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  else
    warn "ساخت swap ممکن نشد؛ اگر ساخت برنامه با کمبود حافظه متوقف شد، رم سرور را بیشتر کنید"
  fi
fi

# ------------------------------------------------------------------ code
say "دریافت کد از $REPO_URL (شاخه‌ی $BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q --depth 1 origin "$BRANCH"
  git -C "$DIR" checkout -q -B "$BRANCH" FETCH_HEAD
  git -C "$DIR" reset -q --hard FETCH_HEAD
else
  git clone -q --depth 1 --branch "$BRANCH" "$REPO_URL" "$DIR"
fi
cd "$DIR/platform"

# ------------------------------------------------------------------ ports and address
port_busy() { [ -n "$(ss -ltnH "sport = :$1" 2>/dev/null)" ]; }
ours_up() { docker compose ps --status running --services 2>/dev/null | grep -qx nginx; }
if port_busy "$PORT" && ! ours_up; then
  die "پورت $PORT را برنامه‌ی دیگری گرفته. با پورت دیگر اجرا کنید:  bash install.sh --port 8080"
fi
if [ "$MODE" = production ] && port_busy 443 && ! ours_up; then
  die "پورت ۴۴۳ را برنامه‌ی دیگری گرفته؛ اول آن را آزاد کنید"
fi

if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  case "$PUBLIC_IP" in
    ''|10.*|192.168.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*)
      PUBLIC_IP="$(curl -fsS --max-time 6 https://api.ipify.org 2>/dev/null || echo "$PUBLIC_IP")" ;;
  esac
fi
if [ "$MODE" = production ]; then
  URL="https://$DOMAIN"
  resolved="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}')"
  [ "$resolved" = "$PUBLIC_IP" ] || warn "دامنه‌ی $DOMAIN به ${resolved:-هیچ‌جا} اشاره می‌کند، نه به $PUBLIC_IP. اول DNS را درست کنید، وگرنه گواهی HTTPS صادر نمی‌شود."
else
  URL="http://$PUBLIC_IP"
  [ "$PORT" = 80 ] || URL="$URL:$PORT"
fi

# ------------------------------------------------------------------ .env
set_env() {
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else printf '%s=%s\n' "$1" "$2" >> .env; fi
}
get_env() { sed -n "s/^$1=//p" .env | tail -1; }
rand() { openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | cut -c1-"$1"; }

if [ ! -f .env ]; then
  say "ساخت فایل تنظیمات (.env) با رمزهای تصادفی"
  umask 077
  cp .env.example .env
  set_env POSTGRES_PASSWORD "$(rand 32)"
  set_env SESSION_SECRET "$(rand 64)"
  umask 022
fi
chmod 600 .env
set_env NODE_ENV production
set_env PUBLIC_WEB_URL "$URL"
set_env HTTP_PORT "$PORT"
[ -z "$NPM_REGISTRY_ARG" ] || set_env NPM_REGISTRY "$NPM_REGISTRY_ARG"

if [ "$MODE" = demo ]; then
  set_env DEMO_MODE true
  set_env NGINX_MODE http
  set_env HTTPS_PORT 127.0.0.1:18443
  set_env COOKIE_SECURE false
  set_env PAYMENT_DRIVER mock
  set_env SMS_DRIVER console
else
  set_env DEMO_MODE false
  set_env NGINX_MODE https
  set_env HTTPS_PORT 443
  set_env COOKIE_SECURE true
  ask() { # ask KEY "question"
    if [ -z "$(get_env "$1")" ]; then
      [ -t 0 ] || die "مقدار $1 در $DIR/platform/.env خالی است؛ آن را پر کنید و دوباره اجرا کنید"
      read -rp "$2: " v; set_env "$1" "$v"
    fi
  }
  ask ZARINPAL_MERCHANT_ID "کد پذیرنده‌ی زرین‌پال (merchant id)"
  ask KAVENEGAR_API_KEY "کلید API کاوه‌نگار"
  if [ -z "$(get_env KAVENEGAR_SENDER)" ] && [ -t 0 ]; then
    read -rp "شماره‌ی خط ارسال کاوه‌نگار برای پیامک وضعیت سفارش (خالی = بدون پیامک وضعیت): " v; set_env KAVENEGAR_SENDER "$v"
  fi
  set_env PAYMENT_DRIVER zarinpal
  set_env SMS_DRIVER kavenegar
fi

# ------------------------------------------------------------------ https certificate
mkdir -p deploy/certs
if [ "$MODE" = production ]; then
  say "گرفتن گواهی HTTPS برای $DOMAIN"
  apt-get install -y -qq certbot >/dev/null
  docker compose stop nginx >/dev/null 2>&1 || true
  certbot certonly --standalone -n --agree-tos --keep-until-expiring -m "$EMAIL" -d "$DOMAIN"
  cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "/etc/letsencrypt/live/$DOMAIN/privkey.pem" deploy/certs/
  chmod 600 deploy/certs/privkey.pem
  # Renewals use certbot's own web server on port 80, so nginx steps aside for a moment.
  mkdir -p /etc/letsencrypt/renewal-hooks/pre /etc/letsencrypt/renewal-hooks/post /etc/letsencrypt/renewal-hooks/deploy
  printf '#!/bin/sh\ncd %s/platform && docker compose stop nginx\n' "$DIR" > /etc/letsencrypt/renewal-hooks/pre/tada.sh
  printf '#!/bin/sh\ncd %s/platform && docker compose start nginx\n' "$DIR" > /etc/letsencrypt/renewal-hooks/post/tada.sh
  printf '#!/bin/sh\ncp -L /etc/letsencrypt/live/%s/fullchain.pem /etc/letsencrypt/live/%s/privkey.pem %s/platform/deploy/certs/\n' "$DOMAIN" "$DOMAIN" "$DIR" > /etc/letsencrypt/renewal-hooks/deploy/tada.sh
  chmod +x /etc/letsencrypt/renewal-hooks/*/tada.sh
fi

# ------------------------------------------------------------------ build and start
say "آماده‌سازی سایت تعاملی تادا"
./deploy/sync-site.sh >/dev/null

if [ "$SKIP_BUILD" = 1 ]; then
  say "اجرای سرویس‌ها"
  docker compose up -d --no-build
else
  say "ساخت و اجرای سرویس‌ها (بار اول ۵ تا ۱۵ دقیقه طول می‌کشد)"
  docker compose up -d --build
fi

say "منتظر بالا آمدن API"
api_ok() { docker compose exec -T api node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; }
for _ in $(seq 1 90); do api_ok && break; sleep 2; done
api_ok || { docker compose logs --tail 60 api; die "API بالا نیامد؛ لاگ بالا را ببینید"; }

# ------------------------------------------------------------------ first-time data
CREDS=/root/tada-credentials.txt
if [ ! -f .seeded ]; then
  say "ساخت منو، شعبه‌ها، میزها و حساب مدیر"
  out="$(docker compose exec -T api node dist/seed.js)"
  pw="$(printf '%s\n' "$out" | sed -n 's/^ *password: //p' | head -1)"
  if [ "$MODE" = demo ]; then
    # In the demo every branch takes orders around the clock, so you can try it at any hour.
    docker compose exec -T db psql -q -U tada -d tada -c "UPDATE \"Branch\" SET hours='[[\"00:00\",\"24:00\"]]'" >/dev/null
  fi
  if [ -n "$pw" ]; then
    umask 077
    printf 'پنل تادا: %s/admin\nنام کاربری: owner\nرمز: %s\n(بعد از اولین ورود، رمز را از «تنظیمات» عوض کنید)\n' "$URL" "$pw" > "$CREDS"
    umask 022
  fi
  touch .seeded
fi

# Production keeps working after reboots and checks the certificate twice a day (certbot's timer).
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "$PORT"/tcp >/dev/null
  [ "$MODE" = demo ] || ufw allow 443/tcp >/dev/null
fi

docker image prune -f >/dev/null 2>&1 || true

# ------------------------------------------------------------------ done
say "تمام شد"
cat <<EOF

  سایت تعاملی:   $URL/
  فروشگاه:       $URL/shop
  دستیار تادا:   $URL/shop/assistant
  پنل مدیریت:    $URL/admin
  صفحه‌ی بار:    $URL/bar

  نام کاربری و رمز پنل:  cat $CREDS
  به‌روزرسانی بعدی:      bash $DIR/platform/deploy/install.sh ${DOMAIN:+--domain $DOMAIN --email $EMAIL}
  لاگ‌ها:                cd $DIR/platform && docker compose logs -f api web
EOF
if [ "$MODE" = demo ]; then
  cat <<EOF

  این نسخه‌ی نمایشی است:
  - پرداخت آزمایشی است و پولی جابه‌جا نمی‌شود.
  - پیامک واقعی فرستاده نمی‌شود. کد ورود مشتری را این‌طور ببینید:
        bash $DIR/platform/deploy/otp.sh
  - شعبه‌ها شبانه‌روز باز هستند تا هر ساعتی امتحان کنید؛ ساعت واقعی را در پنل ← شعبه‌ها بگذارید.
EOF
fi
