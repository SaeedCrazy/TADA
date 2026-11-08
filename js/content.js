// All site copy, both languages. Edit text here only.
// Persian is written natively (not translated); keep it short and warm.
// PLACEHOLDERS are marked with  TODO:  — see README.md.

const SITE = {
  instagram: 'https://www.instagram.com/tada_lounge/',
  shop: 'https://tada.ir',
  // Hero video (scroll-scrubbed, see VIDEO-PROMPTS.md). Leave null until the Kling video
  // is ready, then set, for example:
  //   video: 'assets/video/hero.mp4', videoWebm: 'assets/video/hero.webm',
  //   videoMobile: 'assets/video/hero-720.mp4', poster: 'assets/video/hero-poster.jpg'
  hero: { video: null, videoWebm: null, videoMobile: null, poster: null },
};

const maps = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

const CONTENT = {
  fa: {
    dir: 'rtl',
    langSwitch: 'EN',
    skip: 'رد کردن',
    gate: { loading: 'در حال آماده‌سازی…', enterTouch: 'برای ورود، صفحه را لمس کنید', enterClick: 'برای ورود کلیک کنید' },
    nav: { top: 'آغاز', story: 'تادا', product: 'منو', branches: 'شعبه‌ها', collab: 'همکاری', order: 'سفارش' },
    skipTo: 'پرش به محتوا', menuBtn: 'فهرست', menuClose: 'بستن',
    sound: { on: 'صدا: روشن', off: 'صدا: خاموش' },
    hero: {
      line: 'جایی که طعم بشکن می‌زند.',
      cue: 'اسکرول کنید',
      // Overlays over the scrubbed video, at 15–25 / 35–45 / 60–70 / 85–100 % of the scroll.
      chapters: [
        { t: 'یک جرقه.', s: 'هر جادو از یک نقطه‌ی نور شروع می‌شود.' },
        { t: 'شیشه، یخ، شیر.', s: 'و اوبه‌ای که آرام می‌ریزد.' },
        { t: 'بنفش در سفید می‌رقصد.', s: 'نگاه کنید. عجله‌ای نیست.' },
        { t: 'تادا!', s: 'نوبت شماست.' },
      ],
    },
    story: {
      title: 'تادا یعنی همان لحظه.',
      lead: 'شعبده‌باز وقتی تردستی‌اش جواب می‌دهد، می‌گوید «تادا!». ما هر فنجان را همین‌طور روی میز می‌گذاریم.',
      body: 'قهوه‌ای که با حوصله انتخاب شده، ماچای تازه، اوبه‌ی بنفشِ این روزها، و پیشخوانی که از بیکری و کوکی خالی نمی‌ماند.',
      notes: [
        { t: 'قهوه', s: 'اسپرسو و دمی، از دانه‌های عربیکا' },
        { t: 'ماچا', s: 'سبزِ تلخ‌وشیرین، با شیر یا بدون' },
        { t: 'اوبه', s: 'سیب‌زمینی بنفش فیلیپینی؛ خوش‌رنگ‌ترین لیوان تادا' },
        { t: 'بیکری', s: 'هر روز صبح، گرم' },
        { t: 'کوکی', s: 'برای همراهِ قهوه، یا جای ناهار' },
      ],
    },
    product: {
      kicker: 'از تادا تا خانه',
      title: 'قهوه ۱۰۰٪ عربیکا',
      size: 'بسته‌ی یک کیلوگرمی',
      intro: 'همان قهوه‌ای که پشت بار تادا دم می‌شود؛ برای اسپرسو و قهوه‌های دمی.',
      specs: [
        ['مناسب برای', 'اسپرسو و قهوه‌های دمی'],
        ['خاستگاه', 'آفریقا و آمریکا'],
        ['فرآوری', 'طبیعی'],
        ['درجه‌ی برشت', 'مدیوم'],
      ],
      profileTitle: 'پروفایل طعم',
      // TODO: values read from a blurry photo of the 250 g label — unconfirmed.
      profileNote: 'اعداد از روی عکس برچسب ۲۵۰ گرمی خوانده شده و هنوز تأیید نشده‌اند.',
      profileFlag: 'پروفایل طعم · تأییدنشده',
      profile: [
        ['تلخی', 15],
        ['اسیدیته', 92],
        ['شیرینی', 42],
        ['بادی', 55],
      ],
      cta: 'سفارش در tada.ir',
      pack: { label: 'قهوه ۱۰۰٪ عربیکا', weight: '۱ کیلوگرم', sub: 'اسپرسو و دمی' },
    },
    // The horizontal menu track. `tone` picks the label colour from the kit palette.
    menu: {
      title: 'هر لیوان، یک ترفند.',
      lead: 'آنچه پشت بار تادا آماده می‌شود، و آنچه می‌توانید با خود ببرید.',
      items: [
        { tone: 'ube', name: 'اوبه', sub: 'لاته‌ی اوبه', note: 'سیب‌زمینی بنفش فیلیپینی، شیر سرد و یخ؛ خوش‌رنگ‌ترین لیوان تادا.' },
        { tone: 'matcha', name: 'ماچا', sub: 'لاته یا خالص', note: 'سبزِ تلخ‌وشیرین، با شیر یا بدون.' },
        { tone: 'night', name: 'قهوه', sub: 'اسپرسو و دمی', note: 'دانه‌های عربیکا، با حوصله انتخاب و دم شده.' },
        { tone: 'paper', name: 'بیکری', sub: 'هر روز صبح', note: 'گرم و تازه، کنار اولین فنجان.' },
        { tone: 'purple', name: 'کوکی', sub: 'همراهِ قهوه', note: 'یا به‌جای ناهار؛ تصمیمش با شما.' },
        { tone: 'pack', kind: 'pack' }, // the 1 kg bag: uses `product`
      ],
    },
    branches: {
      title: 'سه شعبه.',
      lead: 'هر کدام یک بشکن با شما فاصله دارد.',
      route: 'مسیر',
      // TODO: city and opening hours unknown — ask the client. Do not invent.
      hours: null,
      list: [
        { name: 'ملاصدرا', addr: 'خیابان ملاصدرا، مابین ۳ و ۵', map: maps('Tada Lounge ملاصدرا') },
        { name: 'جمهوری', addr: 'بلوار جمهوری، مابین شاداب و ۵۶', map: maps('Tada Lounge بلوار جمهوری') },
        { name: 'دانشگاه', addr: 'بلوار دانشگاه، خیابان شاهد، نبش شاهد ۱۱', map: maps('Tada Lounge بلوار دانشگاه شاهد') },
      ],
    },
    collab: {
      title: 'با تادا کار کنید.',
      items: [
        { t: 'به تیم تادا بپیوندید', s: 'اگر پشت بار ایستادن و بشکن زدن را دوست دارید، از خودتان برایمان بنویسید.' },
        { t: 'سفارش سازمانی و رویداد', s: 'برای قهوه‌ی دفترتان، رویدادها و همکاری‌های تجاری، در دایرکت پیام بدهید.' },
      ],
      cta: 'پیام در اینستاگرام',
    },
    footer: {
      tagline: 'نُت جادویی طعم',
      rights: 'تادا لانژ',
      links: [
        { t: 'اینستاگرام', href: 'https://www.instagram.com/tada_lounge/' },
        { t: 'فروشگاه tada.ir', href: 'https://tada.ir' },
      ],
    },
  },

  en: {
    dir: 'ltr',
    langSwitch: 'فا',
    skip: 'Skip',
    gate: { loading: 'Preparing…', enterTouch: 'Tap to enter', enterClick: 'Click to enter' },
    nav: { top: 'Start', story: 'Tada', product: 'Menu', branches: 'Branches', collab: 'Work with us', order: 'Order' },
    skipTo: 'Skip to content', menuBtn: 'Index', menuClose: 'Close',
    sound: { on: 'Sound: on', off: 'Sound: off' },
    hero: {
      line: 'Where flavor snaps its fingers.',
      cue: 'Scroll',
      chapters: [
        { t: 'One spark.', s: 'Every trick begins with a point of light.' },
        { t: 'Glass, ice, milk.', s: 'And ube, poured slowly.' },
        { t: 'Purple dances into white.', s: 'Watch. There is no hurry.' },
        { t: 'Tada!', s: 'Your turn.' },
      ],
    },
    story: {
      title: 'Tada is that moment.',
      lead: '“Tada!” is what a magician says when the trick lands. That is how every cup reaches your table.',
      body: 'Coffee chosen with patience, fresh matcha, this season’s purple ube, and a counter that never runs out of bakes and cookies.',
      notes: [
        { t: 'Coffee', s: 'Espresso and filter, Arabica beans' },
        { t: 'Matcha', s: 'Bittersweet green, with milk or without' },
        { t: 'Ube', s: 'Filipino purple yam; the prettiest glass at Tada' },
        { t: 'Bakery', s: 'Every morning, warm' },
        { t: 'Cookies', s: 'With your coffee, or instead of lunch' },
      ],
    },
    product: {
      kicker: 'From Tada to your kitchen',
      title: '100% Arabica coffee',
      size: 'One-kilogram bag',
      intro: 'The same coffee brewed behind the Tada bar, for espresso and filter.',
      specs: [
        ['Best for', 'Espresso and filter'],
        ['Origin', 'Africa and the Americas'],
        ['Process', 'Natural'],
        ['Roast', 'Medium'],
      ],
      profileTitle: 'Flavor profile',
      profileNote: 'Read from a blurry photo of the 250 g label; not yet confirmed.',
      profileFlag: 'Flavor profile · unconfirmed',
      profile: [
        ['Bitterness', 15],
        ['Acidity', 92],
        ['Sweetness', 42],
        ['Body', 55],
      ],
      cta: 'Order at tada.ir',
      pack: { label: 'قهوه ۱۰۰٪ عربیکا', weight: '۱ کیلوگرم', sub: 'اسپرسو و دمی' },
    },
    menu: {
      title: 'Every glass, a trick.',
      lead: 'What we make behind the Tada bar, and what you can take home.',
      items: [
        { tone: 'ube', name: 'Ube', sub: 'Ube latte', note: 'Filipino purple yam, cold milk and ice; the prettiest glass at Tada.' },
        { tone: 'matcha', name: 'Matcha', sub: 'Latte or straight', note: 'Bittersweet green, with milk or without.' },
        { tone: 'night', name: 'Coffee', sub: 'Espresso and filter', note: 'Arabica beans, chosen and brewed with patience.' },
        { tone: 'paper', name: 'Bakery', sub: 'Every morning', note: 'Warm and fresh, beside the first cup.' },
        { tone: 'purple', name: 'Cookies', sub: 'With your coffee', note: 'Or instead of lunch; your call.' },
        { tone: 'pack', kind: 'pack' },
      ],
    },
    branches: {
      title: 'Three branches.',
      lead: 'Each one a snap away.',
      route: 'Directions',
      hours: null,
      list: [
        { name: 'Mollasadra', addr: 'Mollasadra St., between 3 and 5', map: maps('Tada Lounge ملاصدرا') },
        { name: 'Jomhouri', addr: 'Jomhouri Blvd., between Shadab and 56', map: maps('Tada Lounge بلوار جمهوری') },
        { name: 'Daneshgah', addr: 'Daneshgah Blvd., Shahed St., corner of Shahed 11', map: maps('Tada Lounge بلوار دانشگاه شاهد') },
      ],
    },
    collab: {
      title: 'Work with Tada.',
      items: [
        { t: 'Join the team', s: 'If standing behind a bar and snapping your fingers sounds like you, write to us about yourself.' },
        { t: 'Corporate orders and events', s: 'Coffee for your office, events and business partnerships: send us a DM.' },
      ],
      cta: 'Message us on Instagram',
    },
    footer: {
      tagline: 'The magic note of flavor',
      rights: 'Tada Lounge',
      links: [
        { t: 'Instagram', href: 'https://www.instagram.com/tada_lounge/' },
        { t: 'Shop at tada.ir', href: 'https://tada.ir' },
      ],
    },
  },
};

/** Persian digits for the fa locale. */
const faDigits = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
