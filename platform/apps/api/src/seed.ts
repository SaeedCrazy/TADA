// Seeds the Tada menu, branches and tables, plus an owner account.
// Branch names and addresses come from the Tada website. Prices are SAMPLE values: set real ones in the admin panel.
// Branch coordinates are left empty on purpose; delivery turns on once a manager pins each branch on the map.
import { randomBytes } from 'node:crypto';
import { loadConfig } from './config.js';
import { createDb, type Db } from './db.js';
import { hashPassword } from './modules/auth/auth.routes.js';
import { randomToken } from './lib/util.js';

const T = (toman: number) => toman * 10; // rial

type Taste = { sweetness: number; bitterness: number; acidity: number; body: number; caffeine: number; milk: boolean; temperature: 'HOT' | 'ICED' | 'BOTH'; notes: string[] };

const milkGroup = {
  nameFa: 'شیر', nameEn: 'Milk', minSelect: 1, maxSelect: 1,
  options: [
    { nameFa: 'شیر معمولی', nameEn: 'Regular milk', priceDelta: 0, isDefault: true },
    { nameFa: 'شیر جو دوسر', nameEn: 'Oat milk', priceDelta: T(40000) },
    { nameFa: 'شیر بادام', nameEn: 'Almond milk', priceDelta: T(45000) },
  ],
};
const shotGroup = {
  nameFa: 'شات اضافه', nameEn: 'Extra shot', minSelect: 0, maxSelect: 1,
  options: [{ nameFa: 'یک شات اضافه', nameEn: 'One extra shot', priceDelta: T(35000) }],
};
const sweetGroup = {
  nameFa: 'شیرینی', nameEn: 'Sweetness', minSelect: 1, maxSelect: 1,
  options: [
    { nameFa: 'معمولی', nameEn: 'Regular', priceDelta: 0, isDefault: true },
    { nameFa: 'کم‌شیرین', nameEn: 'Less sweet', priceDelta: 0 },
    { nameFa: 'بدون شکر', nameEn: 'No sugar', priceDelta: 0 },
  ],
};
const tempGroup = {
  nameFa: 'سرو', nameEn: 'Served', minSelect: 1, maxSelect: 1,
  options: [
    { nameFa: 'گرم', nameEn: 'Hot', priceDelta: 0, isDefault: true },
    { nameFa: 'سرد با یخ', nameEn: 'Iced', priceDelta: T(10000) },
  ],
};
const grindGroup = {
  nameFa: 'آسیاب', nameEn: 'Grind', minSelect: 1, maxSelect: 1,
  options: [
    { nameFa: 'دانه‌ی کامل', nameEn: 'Whole bean', priceDelta: 0, isDefault: true },
    { nameFa: 'آسیاب اسپرسو', nameEn: 'Espresso grind', priceDelta: 0 },
    { nameFa: 'آسیاب دمی', nameEn: 'Filter grind', priceDelta: 0 },
  ],
};

interface SeedProduct {
  slug: string; cat: string; kind: 'DRINK' | 'FOOD' | 'PACKAGED'; nameFa: string; nameEn: string; descFa: string; descEn: string;
  art: string; price: number; featured?: boolean; allergens?: string[]; taste?: Taste; groups?: (typeof milkGroup)[];
}

const categories = [
  { slug: 'signature', nameFa: 'نوشیدنی‌های تادا', nameEn: 'Tada signatures', art: 'glass', sort: 1 },
  { slug: 'coffee', nameFa: 'قهوه', nameEn: 'Coffee', art: 'cup', sort: 2 },
  { slug: 'matcha-tea', nameFa: 'ماچا و چای', nameEn: 'Matcha and tea', art: 'leaf', sort: 3 },
  { slug: 'bakery', nameFa: 'بیکری و کوکی', nameEn: 'Bakery and cookies', art: 'croissant', sort: 4 },
  { slug: 'beans', nameFa: 'قهوه برای خانه', nameEn: 'Coffee for home', art: 'beans', sort: 5 },
];

const products: SeedProduct[] = [
  { slug: 'ube-latte', cat: 'signature', kind: 'DRINK', nameFa: 'لاته‌ی اوبه', nameEn: 'Ube latte', art: 'glass', price: 245000, featured: true,
    descFa: 'سیب‌زمینی بنفش فیلیپینی، شیر سرد و یخ؛ خوش‌رنگ‌ترین لیوان تادا.', descEn: 'Filipino purple yam, cold milk and ice; the prettiest glass at Tada.',
    allergens: ['لبنیات'], taste: { sweetness: 4, bitterness: 0, acidity: 0, body: 3, caffeine: 0, milk: true, temperature: 'ICED', notes: ['vanilla', 'creamy'] }, groups: [milkGroup, sweetGroup] },
  { slug: 'iced-ube-matcha', cat: 'signature', kind: 'DRINK', nameFa: 'اوبه ماچا', nameEn: 'Ube matcha', art: 'icedCup', price: 265000, featured: true,
    descFa: 'لایه‌ی بنفش اوبه زیر ماچای سبز؛ شیرین و کمی تلخ.', descEn: 'Purple ube beneath green matcha; sweet with a gentle bitterness.',
    allergens: ['لبنیات'], taste: { sweetness: 3, bitterness: 2, acidity: 0, body: 3, caffeine: 2, milk: true, temperature: 'ICED', notes: ['earthy', 'vanilla', 'creamy'] }, groups: [milkGroup, sweetGroup] },
  { slug: 'espresso', cat: 'coffee', kind: 'DRINK', nameFa: 'اسپرسو', nameEn: 'Espresso', art: 'coffeeCup', price: 120000,
    descFa: 'دانه‌های عربیکا، آسیاب تازه برای هر فنجان.', descEn: 'Arabica beans, freshly ground for every cup.',
    taste: { sweetness: 0, bitterness: 5, acidity: 3, body: 5, caffeine: 5, milk: false, temperature: 'HOT', notes: ['chocolate', 'nutty'] }, groups: [shotGroup] },
  { slug: 'americano', cat: 'coffee', kind: 'DRINK', nameFa: 'آمریکانو', nameEn: 'Americano', art: 'cup', price: 140000,
    descFa: 'اسپرسو و آب داغ؛ ساده و صادق.', descEn: 'Espresso and hot water; simple and honest.',
    taste: { sweetness: 0, bitterness: 4, acidity: 3, body: 3, caffeine: 5, milk: false, temperature: 'BOTH', notes: ['chocolate'] }, groups: [tempGroup, shotGroup] },
  { slug: 'cappuccino', cat: 'coffee', kind: 'DRINK', nameFa: 'کاپوچینو', nameEn: 'Cappuccino', art: 'cup', price: 175000,
    descFa: 'اسپرسو، شیر بخار داده و فوم ابری.', descEn: 'Espresso, steamed milk and a cloud of foam.',
    allergens: ['لبنیات'], taste: { sweetness: 1, bitterness: 3, acidity: 1, body: 4, caffeine: 4, milk: true, temperature: 'HOT', notes: ['chocolate', 'creamy'] }, groups: [milkGroup, shotGroup] },
  { slug: 'latte', cat: 'coffee', kind: 'DRINK', nameFa: 'لاته', nameEn: 'Latte', art: 'glass2', price: 185000, featured: true,
    descFa: 'اسپرسوی عربیکا با شیر بیشتر؛ نرم و گرد.', descEn: 'Arabica espresso with more milk; smooth and round.',
    allergens: ['لبنیات'], taste: { sweetness: 1, bitterness: 2, acidity: 1, body: 3, caffeine: 4, milk: true, temperature: 'BOTH', notes: ['caramel', 'creamy'] }, groups: [tempGroup, milkGroup, shotGroup] },
  { slug: 'mocha', cat: 'coffee', kind: 'DRINK', nameFa: 'موکا', nameEn: 'Mocha', art: 'cup', price: 205000,
    descFa: 'اسپرسو، شکلات تلخ و شیر.', descEn: 'Espresso, dark chocolate and milk.',
    allergens: ['لبنیات'], taste: { sweetness: 3, bitterness: 3, acidity: 1, body: 4, caffeine: 4, milk: true, temperature: 'BOTH', notes: ['chocolate', 'creamy'] }, groups: [tempGroup, milkGroup] },
  { slug: 'pour-over', cat: 'coffee', kind: 'DRINK', nameFa: 'قهوه‌ی دمی', nameEn: 'Pour-over', art: 'kettle', price: 195000,
    descFa: 'از ساعت ۹ صبح کتری روی گاز است و قهوه‌ی دمی آرام می‌چکد.', descEn: 'From 9 a.m. the kettle is on and the pour-over drips slowly.',
    taste: { sweetness: 1, bitterness: 2, acidity: 4, body: 2, caffeine: 4, milk: false, temperature: 'HOT', notes: ['fruity', 'citrus', 'floral'] } },
  { slug: 'cold-brew', cat: 'coffee', kind: 'DRINK', nameFa: 'کلدبرو', nameEn: 'Cold brew', art: 'icedCup', price: 190000,
    descFa: 'شانزده ساعت دم سرد؛ صاف، شیرین‌طعم و پرکافئین.', descEn: 'Sixteen hours cold-steeped; smooth, naturally sweet and strong.',
    taste: { sweetness: 1, bitterness: 2, acidity: 2, body: 3, caffeine: 5, milk: false, temperature: 'ICED', notes: ['chocolate', 'caramel'] } },
  { slug: 'matcha-latte', cat: 'matcha-tea', kind: 'DRINK', nameFa: 'ماچا لاته', nameEn: 'Matcha latte', art: 'leaf', price: 215000, featured: true,
    descFa: 'سبزِ تلخ‌وشیرین، با شیر.', descEn: 'Bittersweet green, with milk.',
    allergens: ['لبنیات'], taste: { sweetness: 2, bitterness: 3, acidity: 1, body: 3, caffeine: 3, milk: true, temperature: 'BOTH', notes: ['earthy', 'creamy'] }, groups: [tempGroup, milkGroup, sweetGroup] },
  { slug: 'pure-matcha', cat: 'matcha-tea', kind: 'DRINK', nameFa: 'ماچای خالص', nameEn: 'Pure matcha', art: 'leaf', price: 185000,
    descFa: 'ماچای هم‌زده با آب؛ بدون شیر.', descEn: 'Whisked matcha with water; no milk.',
    taste: { sweetness: 0, bitterness: 4, acidity: 1, body: 2, caffeine: 3, milk: false, temperature: 'HOT', notes: ['earthy'] } },
  { slug: 'herbal-tea', cat: 'matcha-tea', kind: 'DRINK', nameFa: 'دمنوش تادا', nameEn: 'Tada herbal infusion', art: 'teapot', price: 150000,
    descFa: 'گل‌ها و میوه‌های خشک، بی‌کافئین؛ برای عصرهای آرام.', descEn: 'Dried flowers and fruit, caffeine free; for calm evenings.',
    taste: { sweetness: 1, bitterness: 0, acidity: 3, body: 1, caffeine: 0, milk: false, temperature: 'HOT', notes: ['floral', 'fruity'] } },
  { slug: 'citrus-tonic', cat: 'signature', kind: 'DRINK', nameFa: 'تونیک مرکبات', nameEn: 'Citrus tonic', art: 'lemon', price: 175000,
    descFa: 'مرکبات تازه و سودا؛ بی‌کافئین و خنک.', descEn: 'Fresh citrus and soda; caffeine free and cold.',
    taste: { sweetness: 2, bitterness: 1, acidity: 5, body: 1, caffeine: 0, milk: false, temperature: 'ICED', notes: ['citrus', 'fruity'] } },
  { slug: 'croissant', cat: 'bakery', kind: 'FOOD', nameFa: 'کروسان کره‌ای', nameEn: 'Butter croissant', art: 'croissant', price: 135000,
    descFa: 'گرم و تازه، کنار اولین فنجان.', descEn: 'Warm and fresh, beside the first cup.', allergens: ['گلوتن', 'لبنیات', 'تخم‌مرغ'],
    taste: { sweetness: 1, bitterness: 0, acidity: 0, body: 2, caffeine: 0, milk: true, temperature: 'HOT', notes: ['creamy'] } },
  { slug: 'chocolate-cookie', cat: 'bakery', kind: 'FOOD', nameFa: 'کوکی شکلاتی', nameEn: 'Chocolate cookie', art: 'cookie', price: 110000, featured: true,
    descFa: 'همراهِ قهوه؛ یا به‌جای ناهار، تصمیمش با شما.', descEn: 'With your coffee, or instead of lunch; your call.', allergens: ['گلوتن', 'لبنیات', 'تخم‌مرغ'],
    taste: { sweetness: 5, bitterness: 1, acidity: 0, body: 3, caffeine: 1, milk: true, temperature: 'BOTH', notes: ['chocolate', 'nutty'] } },
  { slug: 'beans-1kg', cat: 'beans', kind: 'PACKAGED', nameFa: 'قهوه‌ی ۱۰۰٪ عربیکا، یک کیلو', nameEn: '100% Arabica coffee, 1 kg', art: 'beans', price: 2450000,
    descFa: 'همان قهوه‌ای که پشت بار تادا دم می‌شود؛ برای اسپرسو و قهوه‌های دمی.', descEn: 'The same coffee we brew behind the Tada bar; for espresso and filter.',
    groups: [grindGroup] },
];

const branches = [
  { slug: 'mollasadra', nameFa: 'ملاصدرا', nameEn: 'Mollasadra', addressFa: 'خیابان ملاصدرا، مابین ۳ و ۵', addressEn: 'Mollasadra St., between 3 and 5', sort: 1 },
  { slug: 'jomhouri', nameFa: 'جمهوری', nameEn: 'Jomhouri', addressFa: 'بلوار جمهوری، مابین شاداب و ۵۶', addressEn: 'Jomhouri Blvd., between Shadab and 56', sort: 2 },
  { slug: 'daneshgah', nameFa: 'دانشگاه', nameEn: 'Daneshgah', addressFa: 'بلوار دانشگاه، خیابان شاهد، نبش شاهد ۱۱', addressEn: 'Daneshgah Blvd., Shahed St., corner of Shahed 11', sort: 3 },
];

export async function seed(db: Db, opts: { ownerPassword?: string; quiet?: boolean } = {}) {
  const log = (...a: unknown[]) => { if (!opts.quiet) console.log(...a); };
  const cats = new Map<string, string>();
  for (const c of categories) {
    const row = await db.category.upsert({ where: { slug: c.slug }, create: c, update: {} });
    cats.set(c.slug, row.id);
  }
  for (const [i, p] of products.entries()) {
    const existing = await db.product.findUnique({ where: { slug: p.slug } });
    if (existing) continue;
    const taste = p.taste ?? null;
    await db.product.create({
      data: {
        slug: p.slug, categoryId: cats.get(p.cat)!, kind: p.kind, nameFa: p.nameFa, nameEn: p.nameEn, descFa: p.descFa, descEn: p.descEn,
        art: p.art, basePrice: T(p.price), isFeatured: p.featured ?? false, sort: i, allergens: p.allergens ?? [],
        ...(taste ? { sweetness: taste.sweetness, bitterness: taste.bitterness, acidity: taste.acidity, body: taste.body, caffeine: taste.caffeine, milk: taste.milk, temperature: taste.temperature, notes: taste.notes } : {}),
        optionGroups: {
          create: (p.groups ?? []).map((g, gi) => ({
            nameFa: g.nameFa, nameEn: g.nameEn, minSelect: g.minSelect, maxSelect: g.maxSelect, sort: gi,
            options: { create: g.options.map((o, oi) => ({ ...o, sort: oi })) },
          })),
        },
      },
    });
  }
  for (const b of branches) {
    const branch = await db.branch.upsert({
      where: { slug: b.slug },
      create: { ...b, hours: [['09:00', '16:00'], ['17:00', '23:00']] },
      update: {},
    });
    for (let n = 1; n <= 10; n++) {
      await db.diningTable.upsert({
        where: { branchId_number: { branchId: branch.id, number: n } },
        create: { branchId: branch.id, number: n, token: randomToken(12) },
        update: {},
      });
    }
  }
  const allProducts = await db.product.findMany({ select: { id: true } });
  const allBranches = await db.branch.findMany({ select: { id: true } });
  await db.branchProduct.createMany({
    data: allBranches.flatMap((b) => allProducts.map((p) => ({ branchId: b.id, productId: p.id }))),
    skipDuplicates: true,
  });
  await db.discountCode.upsert({
    where: { code: 'WELCOME10' },
    create: { code: 'WELCOME10', type: 'PERCENT', value: 10, maxDiscount: T(100000), perCustomerLimit: 1 },
    update: {},
  });

  if (!(await db.staff.findFirst({ where: { role: 'OWNER' } }))) {
    const password = opts.ownerPassword ?? randomBytes(12).toString('base64url');
    await db.staff.create({ data: { username: 'owner', name: 'مدیر تادا', role: 'OWNER', passwordHash: await hashPassword(password) } });
    log(`\nOwner account created.\n  username: owner\n  password: ${password}\nChange it after the first login.\n`);
  }
  log('Seed complete.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);
  await seed(db, { ownerPassword: process.env.SEED_OWNER_PASSWORD });
  await db.$disconnect();
}
