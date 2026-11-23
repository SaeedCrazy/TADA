// Storefront copy in both languages. Persian is written natively, short and warm, in the Tada voice.
import type { Locale } from '@tada/shared';

export const LOCALES = ['fa', 'en'] as const;
export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);
export const dirOf = (l: Locale) => (l === 'fa' ? 'rtl' : 'ltr');
/** "/shop/cart" for fa, "/en/shop/cart" for en. */
export const href = (l: Locale, path: string) => (l === 'fa' ? path : `/en${path}`);

const fa = {
  brand: 'تادا',
  tagline: 'نُت جادویی طعم',
  nav: { menu: 'منو', assistant: 'دستیار تادا', account: 'حساب من', cart: 'سبد', orders: 'سفارش‌ها', site: 'سایت تادا' },
  langSwitch: 'English',
  hero: { title: 'سفارش از تادا', lead: 'از منوی امروز انتخاب کنید؛ سر میز، تحویل در شعبه یا دلیوری.', askAssistant: 'نمی‌دانید چه بخورید؟ از دستیار بپرسید' },
  branch: {
    pick: 'انتخاب شعبه', change: 'تغییر شعبه', open: (t: string) => `باز است تا ${t}`, closedUntil: (t: string, tomorrow: boolean) => `بسته است؛ ${tomorrow ? 'فردا ' : ''}ساعت ${t} باز می‌کنیم`,
    paused: 'سفارش آنلاین موقتاً متوقف است', all: 'همه‌ی شعبه‌ها', hours: 'ساعت کاری', chooseHint: 'منو و موجودی بر اساس شعبه نشان داده می‌شود.',
  },
  table: { at: (n: number, b: string) => `میز ${n} · شعبه‌ی ${b}`, leave: 'سفارش از میز نیست؟' },
  menu: { all: 'همه', featured: 'محبوب‌های تادا', soldOut: 'تمام شد', add: 'افزودن', from: 'از', empty: 'چیزی پیدا نشد.', search: 'جست‌وجو در منو' },
  product: { options: 'انتخاب‌ها', required: 'اجباری', optional: 'اختیاری', pickUpTo: (n: number) => `تا ${n} مورد`, note: 'توضیح برای بار', notePh: 'مثلاً کم‌یخ', qty: 'تعداد', addToCart: 'افزودن به سبد', allergens: 'حساسیت‌زاها', taste: 'ذائقه', back: 'بازگشت به منو', added: 'به سبد اضافه شد' },
  tasteScale: { sweetness: 'شیرینی', bitterness: 'تلخی', acidity: 'ترشی', body: 'غلظت', caffeine: 'کافئین' },
  cart: {
    title: 'سبد شما', empty: 'سبد خالی است. یک نُت از منو انتخاب کنید.', toMenu: 'رفتن به منو', checkout: 'ادامه‌ی خرید', subtotal: 'جمع اقلام',
    remove: 'حذف', items: (n: number) => `${n} قلم`, discount: 'تخفیف', delivery: 'هزینه‌ی ارسال', total: 'مبلغ نهایی', view: 'دیدن سبد',
  },
  checkout: {
    title: 'تکمیل سفارش', how: 'چطور سفارش می‌دهید؟', DINE_IN: 'سر میز', PICKUP: 'تحویل در شعبه', DELIVERY: 'دلیوری',
    dineInHint: 'برای سفارش سر میز، QR روی میز را اسکن کنید.', branch: 'شعبه', address: 'آدرس', savedAddresses: 'آدرس‌های ذخیره‌شده',
    newAddress: 'آدرس جدید', pin: 'محل را روی نقشه مشخص کنید', useMyLocation: 'استفاده از موقعیت من', addressLine: 'نشانی دقیق',
    addressPh: 'خیابان، کوچه، پلاک، واحد', saveAddress: 'ذخیره‌ی این آدرس', addressTitle: 'نام آدرس', addressTitlePh: 'خانه، محل کار…',
    name: 'نام شما', note: 'توضیح سفارش', code: 'کد تخفیف', apply: 'اعمال', pay: 'روش پرداخت', place: 'ثبت سفارش', placeAndPay: 'پرداخت و ثبت سفارش',
    loginNeeded: 'برای این نوع سفارش، شماره‌ی موبایل را تأیید کنید.', distance: (km: string) => `فاصله ${km} کیلومتر`, outOfRange: 'این آدرس خارج از محدوده‌ی ارسال است.',
    steps: ['نوع سفارش', 'جزئیات', 'پرداخت'], summary: 'خلاصه‌ی سفارش', free: 'رایگان', redirecting: 'در حال انتقال به درگاه پرداخت…',
  },
  login: {
    title: 'ورود با شماره‌ی موبایل', phone: 'شماره‌ی موبایل', phonePh: '۰۹۱۲۱۲۳۴۵۶۷', send: 'ارسال کد', code: 'کد تأیید', codeSent: (p: string) => `کد ۵ رقمی به ${p} پیامک شد.`,
    verify: 'تأیید و ورود', resend: 'ارسال دوباره', resendIn: (s: number) => `ارسال دوباره تا ${s} ثانیه`, change: 'تغییر شماره', name: 'نام (اختیاری)', logout: 'خروج',
  },
  order: {
    title: (n: number) => `سفارش #${n}`, status: 'وضعیت', paidOk: 'پرداخت موفق بود. سفارش شما به بار رسید.', paidFail: 'پرداخت انجام نشد. می‌توانید دوباره امتحان کنید.',
    retryPay: 'پرداخت دوباره', items: 'اقلام', placedAt: 'زمان ثبت', table: (n: number) => `میز ${n}`, payment: 'پرداخت', live: 'این صفحه خودکار به‌روز می‌شود.',
    expired: 'مهلت پرداخت تمام شد و سفارش لغو شد.', thanks: 'نوش جان!', track: 'پیگیری سفارش',
  },
  account: {
    title: 'حساب من', hello: (n: string) => `سلام ${n}!`, profile: 'مشخصات', name: 'نام', save: 'ذخیره', saved: 'ذخیره شد', orders: 'سفارش‌های من', noOrders: 'هنوز سفارشی ندارید.',
    addresses: 'آدرس‌ها', noAddresses: 'آدرسی ذخیره نکرده‌اید.', delete: 'حذف', taste: 'ذائقه‌ی من', tasteConsent: 'ذائقه‌ام را برای پیشنهادهای بعدی به خاطر بسپار',
    tasteForget: 'ذائقه‌ی ذخیره‌شده پاک شود', favorites: 'همیشگی‌های شما', forYou: 'برای شما',
  },
  assistant: {
    title: 'دستیار تادا', lead: 'بگویید چه حسی دارید؛ ذائقه‌تان را پیدا می‌کنیم.', quiz: 'چند سؤال کوتاه', chat: 'گفت‌وگو', ph: 'مثلاً: یک چیز شیرین و خنک',
    send: 'ارسال', thinking: 'در حال فکر…', picks: 'پیشنهاد دستیار', pairing: 'کنارش', addAll: 'افزودن همه به سبد', restart: 'از نو', next: 'بعدی', see: 'دیدن پیشنهادها',
    privacy: 'گفت‌وگوها برای بهتر شدن دستیار بی‌نام بازبینی می‌شوند. اطلاعات پرداخت یا رمز وارد نکنید.', saveTaste: 'ذائقه‌ام را ذخیره کن', multi: 'می‌توانید چند گزینه انتخاب کنید',
    unavailable: 'دستیار الان در دسترس نیست.',
  },
  footer: { rights: 'تادا لانژ', insta: 'اینستاگرام', hours: 'هر روز ۹ تا ۱۶ و ۱۷ تا ۲۳' },
  common: { loading: 'در حال بارگذاری…', retry: 'تلاش دوباره', close: 'بستن', cancel: 'انصراف', confirm: 'تأیید', yes: 'بله', no: 'خیر', toman: 'تومان', back: 'بازگشت' },
  errors: {
    generic: 'مشکلی پیش آمد. دوباره امتحان کنید.', network: 'اتصال برقرار نشد.', validation_failed: 'لطفاً اطلاعات را بررسی کنید.',
    invalid_mobile: 'شماره‌ی موبایل درست نیست.', otp_invalid: 'کد درست نیست یا منقضی شده.', otp_wait: 'کمی صبر کنید و دوباره درخواست دهید.', otp_locked: 'تلاش‌ها زیاد شد؛ کد جدید بگیرید.', otp_hourly_limit: 'درخواست کد زیاد شد؛ کمی بعد امتحان کنید.',
    sms_unavailable: 'ارسال پیامک ممکن نشد.', login_required: 'لطفاً وارد شوید.', branch_closed: 'شعبه الان سفارش نمی‌گیرد.', item_unavailable: 'یکی از اقلام الان موجود نیست.', out_of_stock: 'موجودی یکی از اقلام کافی نیست.',
    out_of_range: 'آدرس خارج از محدوده‌ی ارسال است.', below_minimum: 'مبلغ سفارش کمتر از حداقل ارسال است.', delivery_unavailable: 'این شعبه دلیوری ندارد.', table_not_found: 'این QR معتبر نیست؛ از همکاران بپرسید.',
    code_not_found: 'کد تخفیف پیدا نشد.', code_inactive: 'کد تخفیف فعال نیست.', code_expired: 'کد تخفیف منقضی شده.', code_not_started: 'کد تخفیف هنوز فعال نشده.', code_used_up: 'ظرفیت این کد تمام شده.',
    code_min_subtotal: 'مبلغ سفارش برای این کد کافی نیست.', code_login_required: 'برای این کد وارد شوید.', code_customer_limit: 'شما قبلاً از این کد استفاده کرده‌اید.',
    gateway_unavailable: 'درگاه پرداخت در دسترس نیست؛ کمی بعد امتحان کنید.', rate_limited: 'درخواست‌ها زیاد شد؛ کمی صبر کنید.', address_required: 'نشانی دقیق را بنویسید.', location_required: 'محل را روی نقشه مشخص کنید.',
    payment_method_not_allowed: 'این روش پرداخت برای این نوع سفارش نیست.', option_required: 'یکی از انتخاب‌های اجباری مانده.', account_blocked: 'حساب شما مسدود است.', not_awaiting_payment: 'این سفارش منتظر پرداخت نیست.',
  } as Record<string, string>,
};

type Dict = typeof fa;

const en: Dict = {
  brand: 'Tada',
  tagline: 'The magic note of taste',
  nav: { menu: 'Menu', assistant: 'Tada assistant', account: 'Account', cart: 'Cart', orders: 'Orders', site: 'Tada website' },
  langSwitch: 'فارسی',
  hero: { title: 'Order from Tada', lead: "Pick from today's menu: at your table, pickup or delivery.", askAssistant: 'Not sure what to have? Ask the assistant' },
  branch: {
    pick: 'Choose a branch', change: 'Change branch', open: (t) => `Open until ${t}`, closedUntil: (t, tomorrow) => `Closed; opens ${tomorrow ? 'tomorrow ' : ''}at ${t}`,
    paused: 'Online ordering is paused', all: 'All branches', hours: 'Opening hours', chooseHint: 'The menu and stock follow the branch you choose.',
  },
  table: { at: (n, b) => `Table ${n} · ${b} branch`, leave: 'Not ordering from a table?' },
  menu: { all: 'All', featured: 'Tada favorites', soldOut: 'Sold out', add: 'Add', from: 'from', empty: 'Nothing found.', search: 'Search the menu' },
  product: { options: 'Choices', required: 'Required', optional: 'Optional', pickUpTo: (n) => `up to ${n}`, note: 'Note for the bar', notePh: 'e.g. light ice', qty: 'Quantity', addToCart: 'Add to cart', allergens: 'Allergens', taste: 'Taste', back: 'Back to the menu', added: 'Added to your cart' },
  tasteScale: { sweetness: 'Sweetness', bitterness: 'Bitterness', acidity: 'Acidity', body: 'Body', caffeine: 'Caffeine' },
  cart: {
    title: 'Your cart', empty: 'Your cart is empty. Pick a note from the menu.', toMenu: 'Go to the menu', checkout: 'Checkout', subtotal: 'Items',
    remove: 'Remove', items: (n) => `${n} item${n === 1 ? '' : 's'}`, discount: 'Discount', delivery: 'Delivery', total: 'Total', view: 'View cart',
  },
  checkout: {
    title: 'Checkout', how: 'How are you ordering?', DINE_IN: 'At the table', PICKUP: 'Pickup', DELIVERY: 'Delivery',
    dineInHint: 'To order at your table, scan the QR code on it.', branch: 'Branch', address: 'Address', savedAddresses: 'Saved addresses',
    newAddress: 'New address', pin: 'Pin the place on the map', useMyLocation: 'Use my location', addressLine: 'Full address',
    addressPh: 'Street, alley, number, unit', saveAddress: 'Save this address', addressTitle: 'Address name', addressTitlePh: 'Home, work…',
    name: 'Your name', note: 'Order note', code: 'Discount code', apply: 'Apply', pay: 'Payment', place: 'Place order', placeAndPay: 'Pay and place order',
    loginNeeded: 'Please verify your mobile number for this kind of order.', distance: (km) => `${km} km away`, outOfRange: 'This address is outside our delivery area.',
    steps: ['Order type', 'Details', 'Payment'], summary: 'Summary', free: 'Free', redirecting: 'Taking you to the payment gateway…',
  },
  login: {
    title: 'Sign in with your mobile', phone: 'Mobile number', phonePh: '0912 123 4567', send: 'Send code', code: 'Code', codeSent: (p) => `We texted a 5-digit code to ${p}.`,
    verify: 'Verify and sign in', resend: 'Resend', resendIn: (s) => `Resend in ${s}s`, change: 'Change number', name: 'Name (optional)', logout: 'Sign out',
  },
  order: {
    title: (n) => `Order #${n}`, status: 'Status', paidOk: 'Payment succeeded. Your order is at the bar.', paidFail: 'Payment did not go through. You can try again.',
    retryPay: 'Pay again', items: 'Items', placedAt: 'Placed', table: (n) => `Table ${n}`, payment: 'Payment', live: 'This page updates by itself.',
    expired: 'The payment window closed and the order was cancelled.', thanks: 'Enjoy!', track: 'Track order',
  },
  account: {
    title: 'Account', hello: (n) => `Hi ${n}!`, profile: 'Profile', name: 'Name', save: 'Save', saved: 'Saved', orders: 'My orders', noOrders: 'No orders yet.',
    addresses: 'Addresses', noAddresses: 'No saved addresses.', delete: 'Delete', taste: 'My taste', tasteConsent: 'Remember my taste for future suggestions',
    tasteForget: 'Forget my saved taste', favorites: 'Your usuals', forYou: 'For you',
  },
  assistant: {
    title: 'Tada assistant', lead: "Tell us how you feel; we'll find your taste.", quiz: 'A few quick questions', chat: 'Chat', ph: 'e.g. something sweet and iced',
    send: 'Send', thinking: 'Thinking…', picks: 'Assistant picks', pairing: 'On the side', addAll: 'Add all to cart', restart: 'Start over', next: 'Next', see: 'See picks',
    privacy: 'Conversations are reviewed anonymously to improve the assistant. Never type payment details or passwords.', saveTaste: 'Save my taste', multi: 'You can pick several',
    unavailable: 'The assistant is not available right now.',
  },
  footer: { rights: 'Tada Lounge', insta: 'Instagram', hours: 'Daily 9–16 and 17–23' },
  common: { loading: 'Loading…', retry: 'Try again', close: 'Close', cancel: 'Cancel', confirm: 'Confirm', yes: 'Yes', no: 'No', toman: 'Toman', back: 'Back' },
  errors: {
    generic: 'Something went wrong. Please try again.', network: 'Could not connect.', validation_failed: 'Please check the details.',
    invalid_mobile: 'That mobile number is not valid.', otp_invalid: 'The code is wrong or expired.', otp_wait: 'Please wait a moment before asking again.', otp_locked: 'Too many tries; request a new code.', otp_hourly_limit: 'Too many codes; try again later.',
    sms_unavailable: 'Could not send the text message.', login_required: 'Please sign in.', branch_closed: 'This branch is not taking orders now.', item_unavailable: 'An item is not available right now.', out_of_stock: 'Not enough stock for an item.',
    out_of_range: 'This address is outside our delivery area.', below_minimum: 'The order is below the delivery minimum.', delivery_unavailable: 'This branch does not deliver.', table_not_found: 'This QR code is not valid; please ask our team.',
    code_not_found: 'Discount code not found.', code_inactive: 'This code is not active.', code_expired: 'This code has expired.', code_not_started: 'This code is not active yet.', code_used_up: 'This code has been used up.',
    code_min_subtotal: 'Your order is too small for this code.', code_login_required: 'Sign in to use this code.', code_customer_limit: 'You have already used this code.',
    gateway_unavailable: 'The payment gateway is unavailable; try again shortly.', rate_limited: 'Too many requests; please wait.', address_required: 'Please write the full address.', location_required: 'Please pin the place on the map.',
    payment_method_not_allowed: 'That payment method is not available for this order.', option_required: 'A required choice is missing.', account_blocked: 'Your account is blocked.', not_awaiting_payment: 'This order is not awaiting payment.',
  },
};

export const dict = (l: Locale): Dict => (l === 'fa' ? fa : en);
export type { Dict };

export function errorText(l: Locale, code: string | undefined): string {
  const d = dict(l).errors;
  return (code && d[code]) || d.generic!;
}
