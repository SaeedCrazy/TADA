import { openState, isValidHours, DEFAULT_HOURS, type HoursRange, type TasteAttributes } from '@tada/shared';
import type { Db } from '../../db.js';

const productInclude = {
  optionGroups: {
    orderBy: { sort: 'asc' as const },
    include: { options: { where: { isActive: true }, orderBy: { sort: 'asc' as const } } },
  },
};

type ProductRow = Awaited<ReturnType<Db['product']['findFirstOrThrow']>> & {
  optionGroups: (Awaited<ReturnType<Db['optionGroup']['findFirstOrThrow']>> & {
    options: Awaited<ReturnType<Db['option']['findFirstOrThrow']>>[];
  })[];
};

type BranchRow = Awaited<ReturnType<Db['branch']['findFirstOrThrow']>>;

export function branchHours(b: Pick<BranchRow, 'hours'>): HoursRange[] {
  return isValidHours(b.hours) ? (b.hours as HoursRange[]) : DEFAULT_HOURS;
}

export function serializeBranch(b: BranchRow, now = new Date()) {
  const hours = branchHours(b);
  return {
    id: b.id,
    slug: b.slug,
    nameFa: b.nameFa,
    nameEn: b.nameEn,
    addressFa: b.addressFa,
    addressEn: b.addressEn,
    phone: b.phone,
    lat: b.lat,
    lng: b.lng,
    hours,
    timezone: b.timezone,
    open: openState(hours, now, b.timezone),
    acceptsOrders: b.acceptsOrders,
    delivery: {
      enabled: b.deliveryEnabled && b.lat !== null && b.lng !== null,
      baseFee: b.deliveryBaseFee,
      perKm: b.deliveryPerKm,
      maxKm: b.deliveryMaxKm,
      minOrder: b.deliveryMinOrder,
      freeAbove: b.deliveryFreeAbove,
    },
  };
}

export function tasteOf(p: Pick<ProductRow, 'sweetness' | 'bitterness' | 'acidity' | 'body' | 'caffeine' | 'milk' | 'temperature' | 'notes'>): TasteAttributes | null {
  if (p.sweetness === null || p.bitterness === null || p.caffeine === null) return null;
  return {
    sweetness: p.sweetness,
    bitterness: p.bitterness,
    acidity: p.acidity ?? 0,
    body: p.body ?? 0,
    caffeine: p.caffeine,
    milk: p.milk ?? false,
    temperature: p.temperature ?? 'BOTH',
    notes: p.notes,
  };
}

export interface Availability { isAvailable: boolean; stock: number | null; priceOverride: number | null }

export function serializeProduct(p: ProductRow, avail?: Availability | null) {
  const price = avail?.priceOverride ?? p.basePrice;
  const available = p.isActive && (avail ? avail.isAvailable && (avail.stock === null || avail.stock > 0) : true);
  return {
    id: p.id,
    slug: p.slug,
    categoryId: p.categoryId,
    kind: p.kind,
    nameFa: p.nameFa,
    nameEn: p.nameEn,
    descFa: p.descFa,
    descEn: p.descEn,
    art: p.art,
    imageUrl: p.imageUrl,
    price,
    available,
    stock: avail?.stock ?? null,
    isFeatured: p.isFeatured,
    allergens: p.allergens,
    taste: tasteOf(p),
    optionGroups: p.optionGroups.map((g) => ({
      id: g.id,
      nameFa: g.nameFa,
      nameEn: g.nameEn,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: g.options.map((o) => ({ id: o.id, nameFa: o.nameFa, nameEn: o.nameEn, priceDelta: o.priceDelta, isDefault: o.isDefault })),
    })),
  };
}

export type PublicProduct = ReturnType<typeof serializeProduct>;

export async function loadAvailability(db: Db, branchId: string | undefined, productIds?: string[]) {
  const map = new Map<string, Availability>();
  if (!branchId) return map;
  const rows = await db.branchProduct.findMany({
    where: { branchId, ...(productIds ? { productId: { in: productIds } } : {}) },
  });
  for (const r of rows) map.set(r.productId, { isAvailable: r.isAvailable, stock: r.stock, priceOverride: r.priceOverride });
  return map;
}

export async function loadMenu(db: Db, branchId?: string) {
  const [categories, products, avail] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }] }),
    db.product.findMany({
      where: { isActive: true, category: { isActive: true } },
      orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }],
      include: productInclude,
    }),
    loadAvailability(db, branchId),
  ]);
  const serialized = products.map((p) => serializeProduct(p as ProductRow, avail.get(p.id) ?? null));
  return {
    categories: categories
      .map((c) => ({ id: c.id, slug: c.slug, nameFa: c.nameFa, nameEn: c.nameEn, art: c.art }))
      .filter((c) => serialized.some((p) => p.categoryId === c.id)),
    products: serialized,
  };
}

export async function loadProductBySlug(db: Db, slug: string, branchId?: string) {
  const p = await db.product.findFirst({ where: { slug, isActive: true }, include: { ...productInclude, category: true } });
  if (!p) return null;
  const avail = await loadAvailability(db, branchId, [p.id]);
  return { ...serializeProduct(p as ProductRow, avail.get(p.id) ?? null), category: { slug: p.category.slug, nameFa: p.category.nameFa, nameEn: p.category.nameEn } };
}

export { productInclude };
export type { ProductRow };
