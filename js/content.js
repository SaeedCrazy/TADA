// All site copy, both languages. Edit text here only.
// Persian is written natively (not translated); keep it short and warm.
// Headlines marked «Tada letters» are written with the brand alphabet: keep them free of
// punctuation, and use ـ (tatweel) to stretch a join the way the designer does.

const SITE = {
  instagram: 'https://www.instagram.com/tada_lounge/',
  shop: 'https://tada.ir',
  // Opening hours, from the designer's glass: morning 9–16, evening 17–23 (Tehran time).
  hours: [[9, 16], [17, 23]],
  timeZone: 'Asia/Tehran',
  // Optional film inside the door (a calm loop). Leave null until it exists, then e.g.
  //   video: 'assets/video/door.mp4', poster: 'assets/video/door.jpg'
  hero: { video: null, poster: null },
};

const maps = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

const CONTENT = {
  fa: {
    dir: 'rtl',
    langSwitch: 'EN',
    langName: 'English',
    skipTo: 'پرش به محتوا',
    loading: 'در حال آماده‌سازی',
    nav: { top: 'آغاز', morning: 'تادا', menu: 'منو', branches: 'شعبه‌ها', order: 'سفارش', collab: 'همکاری' },
    menuBtn: 'فهرست', menuClose: 'بستن',
    sound: { on: 'صدا روشن', off: 'صدا خاموش' },
    hero: {
      tagline: 'نُت جادویی طعم',
      cue: 'بفرمایید تو',
      hoursTitle: 'ساعت کاری',
      morning: 'صبح ۹ تا ۱۶',
      evening: 'عصر ۱۷ تا ۲۳',
      order: 'سفارش آنلاین از وبسایت',
      insta: 'تادا در اینستاگرام',
    },
    status: {
      open: h => `الان باز است، تا ساعت ${h}`,
      gap: h => `الان بسته است، ساعت ${h} دوباره باز می‌کنیم`,
      today: h => `الان بسته است، امروز ساعت ${h} صبح باز می‌کنیم`,
      tomorrow: h => `الان بسته است، فردا ساعت ${h} صبح باز می‌کنیم`,
    },
    morning: {
      title: 'تادا یعنی همان لحظه',          // Tada letters
      lead: 'شعبده‌باز وقتی تردستی‌اش جواب می‌دهد، می‌گوید «تادا!». ما هر فنجان را همین‌طور روی میز می‌گذاریم.',
      body: 'از ساعت ۹ صبح کتری روی گاز است و قهوه‌ی دمی آرام می‌چکد. قهوه‌ای که با حوصله انتخاب شده، ماچای تازه، اوبه‌ی بنفش، و پیشخوانی که از بیکری و کوکی خالی نمی‌ماند.',
    },
    bar: {
      title: 'از دانه تا فنجان',               // Tada letters
      lead: 'دانه‌های عربیکا، آسیاب تازه برای هر فنجان، و دستگاهی که هر روز از نو تنظیم می‌شود.',
      pack: {
        title: 'همان قهوه، برای خانه',
        name: 'قهوه‌ی ۱۰۰٪ عربیکا',
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
        profileNote: 'این اعداد از روی عکس برچسب خوانده شده و هنوز تأیید نشده‌اند.',
        profile: [['تلخی', 15], ['اسیدیته', 92], ['شیرینی', 42], ['بادی', 55]],
        cta: 'سفارش در tada.ir',
      },
    },
    menu: {
      title: 'هر طعم یک نـت',                  // Tada letters
      lead: 'آنچه پشت بار تادا آماده می‌شود. هر لیوان نُت خودش را دارد.',
      prev: 'طعم قبلی', next: 'طعم بعدی',
      items: [
        { art: 'glass', name: 'اوبه', sub: 'لاته‌ی اوبه', note: 'سیب‌زمینی بنفش فیلیپینی، شیر سرد و یخ؛ خوش‌رنگ‌ترین لیوان تادا.' },
        { art: 'leaf', name: 'ماچا', sub: 'لاته یا خالص', note: 'سبزِ تلخ‌وشیرین، با شیر یا بدون.' },
        { art: 'cup', name: 'قهوه', sub: 'اسپرسو و دمی', note: 'دانه‌های عربیکا، با حوصله انتخاب و دم شده.' },
        { art: 'croissant', name: 'بیکری', sub: 'هر روز صبح', note: 'گرم و تازه، کنار اولین فنجان.' },
        { art: 'cookie', name: 'کوکی', sub: 'همراهِ قهوه', note: 'یا به‌جای ناهار؛ تصمیمش با شما.' },
      ],
    },
    evening: {
      title: 'عصر وقت جادوست',                 // Tada letters
      lead: 'ساعت ۱۷ دوباره باز می‌کنیم و تا ۲۳ می‌مانیم. همان طعم‌ها، با نوری آرام‌تر.',
      body: 'برای گپی طولانی، یک لیوان سرد، یا فقط چند دقیقه سکوت بعد از یک روز شلوغ.',
    },
    branches: {
      title: 'سه شعبه',                         // Tada letters
      lead: 'هر کدام یک بشکن با شما فاصله دارد.',
      route: 'مسیر',
      hours: 'هر سه شعبه: صبح ۹ تا ۱۶، عصر ۱۷ تا ۲۳',
      list: [
        { name: 'ملاصدرا', addr: 'خیابان ملاصدرا، مابین ۳ و ۵', map: maps('Tada Lounge ملاصدرا'), art: 'coffeeCup' },
        { name: 'جمهوری', addr: 'بلوار جمهوری، مابین شاداب و ۵۶', map: maps('Tada Lounge بلوار جمهوری'), art: 'icedCup' },
        { name: 'دانشگاه', addr: 'بلوار دانشگاه، خیابان شاهد، نبش شاهد ۱۱', map: maps('Tada Lounge بلوار دانشگاه شاهد'), art: 'glass2' },
      ],
    },
    order: {
      title: 'سفارش آنلاین',                   // Tada letters
      lead: 'منوی تادا در وبسایت هم هست. سفارشتان را ثبت کنید، بقیه‌اش با ما.',
      cta: 'سفارش در tada.ir',
    },
    collab: {
      title: 'با تادا کار کنید',               // Tada letters
      items: [
        { t: 'به تیم تادا بپیوندید', s: 'اگر پشت بار ایستادن و بشکن زدن را دوست دارید، از خودتان برایمان بنویسید.' },
        { t: 'سفارش سازمانی و رویداد', s: 'برای قهوه‌ی دفترتان، رویدادها و همکاری‌های تجاری، در دایرکت پیام بدهید.' },
      ],
      cta: 'پیام در اینستاگرام',
    },
    glass: {
      caption: 'شیشه‌ی تادا، از بیرون',
      alt: 'طرح خطی شیشه‌ی کافه تادا: دری کمانی با دست بشکن‌زن، و دور آن فنجان، دستگاه اسپرسو، آسیاب، کروسان، نت‌های موسیقی، کلاه شعبده، موتور پیک و نخل.',
      rights: 'تادا لانژ',
      links: [
        { t: 'اینستاگرام', href: 'https://www.instagram.com/tada_lounge/' },
        { t: 'tada.ir', href: 'https://tada.ir' },
      ],
    },
  },

  en: {
    dir: 'ltr',
    langSwitch: 'فا',
    langName: 'فارسی',
    skipTo: 'Skip to content',
    loading: 'Getting ready',
    nav: { top: 'Start', morning: 'Tada', menu: 'Menu', branches: 'Branches', order: 'Order', collab: 'Work with us' },
    menuBtn: 'Index', menuClose: 'Close',
    sound: { on: 'Sound on', off: 'Sound off' },
    hero: {
      tagline: 'The magic note of flavor',
      cue: 'Come in',
      hoursTitle: 'Opening hours',
      morning: 'Mornings 9 to 16',
      evening: 'Evenings 17 to 23',
      order: 'Order online',
      insta: 'Tada on Instagram',
    },
    status: {
      open: h => `Open now, until ${h}:00`,
      gap: h => `Closed now, back at ${h}:00`,
      today: h => `Closed now, opening today at ${h}:00`,
      tomorrow: h => `Closed now, opening tomorrow at ${h}:00`,
    },
    morning: {
      title: 'Tada is that moment',
      lead: '“Tada!” is what a magician says when the trick lands. That is how every cup reaches your table.',
      body: 'From 9 in the morning the kettle is on and the filter coffee drips slowly. Coffee chosen with patience, fresh matcha, purple ube, and a counter that never runs out of bakes and cookies.',
    },
    bar: {
      title: 'From bean to cup',
      lead: 'Arabica beans, ground fresh for every cup, on a machine that is tuned again every day.',
      pack: {
        title: 'The same coffee, for home',
        name: '100% Arabica coffee',
        size: 'One-kilogram bag',
        intro: 'The same coffee brewed behind the Tada bar, for espresso and filter.',
        specs: [
          ['Best for', 'Espresso and filter'],
          ['Origin', 'Africa and the Americas'],
          ['Process', 'Natural'],
          ['Roast', 'Medium'],
        ],
        profileTitle: 'Flavor profile',
        profileNote: 'Read from a photo of the label; not yet confirmed.',
        profile: [['Bitterness', 15], ['Acidity', 92], ['Sweetness', 42], ['Body', 55]],
        cta: 'Order at tada.ir',
      },
    },
    menu: {
      title: 'Every flavor, a note',
      lead: 'What we make behind the Tada bar. Every glass has its own note.',
      prev: 'Previous flavor', next: 'Next flavor',
      items: [
        { art: 'glass', name: 'Ube', sub: 'Ube latte', note: 'Filipino purple yam, cold milk and ice; the prettiest glass at Tada.' },
        { art: 'leaf', name: 'Matcha', sub: 'Latte or straight', note: 'Bittersweet green, with milk or without.' },
        { art: 'cup', name: 'Coffee', sub: 'Espresso and filter', note: 'Arabica beans, chosen and brewed with patience.' },
        { art: 'croissant', name: 'Bakery', sub: 'Every morning', note: 'Warm and fresh, beside the first cup.' },
        { art: 'cookie', name: 'Cookies', sub: 'With your coffee', note: 'Or instead of lunch; your call.' },
      ],
    },
    evening: {
      title: 'Evenings are for magic',
      lead: 'We open again at 17:00 and stay until 23:00. The same flavors, in a softer light.',
      body: 'For a long talk, a cold glass, or a few quiet minutes after a busy day.',
    },
    branches: {
      title: 'Three branches',
      lead: 'Each one a snap away.',
      route: 'Directions',
      hours: 'All three: mornings 9 to 16, evenings 17 to 23',
      list: [
        { name: 'Mollasadra', addr: 'Mollasadra St., between 3 and 5', map: maps('Tada Lounge ملاصدرا'), art: 'coffeeCup' },
        { name: 'Jomhouri', addr: 'Jomhouri Blvd., between Shadab and 56', map: maps('Tada Lounge بلوار جمهوری'), art: 'icedCup' },
        { name: 'Daneshgah', addr: 'Daneshgah Blvd., Shahed St., corner of Shahed 11', map: maps('Tada Lounge بلوار دانشگاه شاهد'), art: 'glass2' },
      ],
    },
    order: {
      title: 'Order online',
      lead: 'The Tada menu is on our website too. Place your order; we take it from there.',
      cta: 'Order at tada.ir',
    },
    collab: {
      title: 'Work with Tada',
      items: [
        { t: 'Join the team', s: 'If standing behind a bar and snapping your fingers sounds like you, write to us about yourself.' },
        { t: 'Corporate orders and events', s: 'Coffee for your office, events and business partnerships: send us a DM.' },
      ],
      cta: 'Message us on Instagram',
    },
    glass: {
      caption: 'The Tada glass, from outside',
      alt: 'The line drawing on the Tada window: an arched door with the snapping hand, surrounded by cups, an espresso machine, a grinder, a croissant, music notes, a magician’s hat, a delivery scooter and a palm.',
      rights: 'Tada Lounge',
      links: [
        { t: 'Instagram', href: 'https://www.instagram.com/tada_lounge/' },
        { t: 'tada.ir', href: 'https://tada.ir' },
      ],
    },
  },
};

/** Persian digits for the fa locale. */
const faDigits = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
