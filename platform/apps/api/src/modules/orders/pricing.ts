// Server-side pricing. The client never sends prices: every total is computed here from the database.
import type { z } from 'zod';
import { quoteSchema, openState } from '@tada/shared';
import type { Db } from '../../db.js';
import { AppError, badRequest, conflict, notFound } from '../../lib/errors.js';
import { haversineKm } from '../../lib/util.js';
import { branchHours, loadAvailability, productInclude, type ProductRow } from '../catalog/catalog.service.js';

export type QuoteInput = z.output<typeof quoteSchema>;
type BranchRow = Awaited<ReturnType<Db['branch']['findFirstOrThrow']>>;
type DiscountRow = Awaited<ReturnType<Db['discountCode']['findFirstOrThrow']>>;

export interface PricedOption { id: string; nameFa: string; nameEn: string; priceDelta: number }
export interface PricedLine {
  productId: string;
  nameFa: string;
  nameEn: string;
  quantity: number;
  unitPrice: number;
  options: PricedOption[];
  note: string | null;
  lineTotal: number;
}

export interface Quote {
  type: QuoteInput['type'];
  branch: BranchRow;
  table: { id: string; number: number } | null;
  lines: PricedLine[];
  subtotal: number;
  discount: { codeId: string; code: string; amount: number } | null;
  discountError: string | null;
  delivery: { distanceKm: number; fee: number } | null;
  total: number;
}

export function deliveryFee(b: Pick<BranchRow, 'deliveryBaseFee' | 'deliveryPerKm'>, distanceKm: number): number {
  return b.deliveryBaseFee + b.deliveryPerKm * Math.max(0, Math.ceil(distanceKm) - 1);
}

export async function findDeliveryBranch(db: Db, loc: { lat: number; lng: number }, now = new Date()) {
  const branches = await db.branch.findMany({
    where: { isActive: true, acceptsOrders: true, deliveryEnabled: true, lat: { not: null }, lng: { not: null } },
  });
  const candidates = branches
    .map((b) => ({ branch: b, distanceKm: Math.round(haversineKm(loc, { lat: b.lat!, lng: b.lng! }) * 10) / 10 }))
    .filter((c) => c.distanceKm <= c.branch.deliveryMaxKm)
    .map((c) => ({ ...c, open: openState(branchHours(c.branch), now, c.branch.timezone).open }))
    .sort((a, b) => Number(b.open) - Number(a.open) || a.distanceKm - b.distanceKm);
  const best = candidates[0];
  return best ? { branch: best.branch, distanceKm: best.distanceKm, fee: deliveryFee(best.branch, best.distanceKm) } : null;
}

export type DiscountCheck = { ok: true; row: DiscountRow; amount: number } | { ok: false; error: string; minSubtotal?: number };

export async function evaluateDiscount(db: Db, code: string, subtotal: number, customerId: string | null, now = new Date()): Promise<DiscountCheck> {
  const row = await db.discountCode.findUnique({ where: { code } });
  if (!row) return { ok: false, error: 'code_not_found' };
  if (!row.isActive) return { ok: false, error: 'code_inactive' };
  if (row.startsAt && row.startsAt > now) return { ok: false, error: 'code_not_started' };
  if (row.endsAt && row.endsAt < now) return { ok: false, error: 'code_expired' };
  if (row.usageLimit !== null && row.usedCount >= row.usageLimit) return { ok: false, error: 'code_used_up' };
  if (subtotal < row.minSubtotal) return { ok: false, error: 'code_min_subtotal', minSubtotal: row.minSubtotal };
  if (row.perCustomerLimit !== null) {
    if (!customerId) return { ok: false, error: 'code_login_required' };
    const used = await db.discountRedemption.count({ where: { codeId: row.id, customerId } });
    if (used >= row.perCustomerLimit) return { ok: false, error: 'code_customer_limit' };
  }
  const raw = row.type === 'PERCENT' ? Math.floor((subtotal * row.value) / 100) : row.value;
  const capped = row.type === 'PERCENT' && row.maxDiscount !== null ? Math.min(raw, row.maxDiscount) : raw;
  return { ok: true, row, amount: Math.max(0, Math.min(capped, subtotal)) };
}

async function resolveBranch(db: Db, input: QuoteInput, now: Date) {
  if (input.type === 'DINE_IN') {
    if (!input.tableToken) throw badRequest('table_required');
    const table = await db.diningTable.findUnique({ where: { token: input.tableToken }, include: { branch: true } });
    if (!table || !table.isActive || !table.branch.isActive) throw notFound('table_not_found');
    return { branch: table.branch, table: { id: table.id, number: table.number }, delivery: null };
  }
  if (input.type === 'PICKUP') {
    if (!input.branchId) throw badRequest('branch_required');
    const branch = await db.branch.findFirst({ where: { id: input.branchId, isActive: true } });
    if (!branch) throw notFound('branch_not_found');
    return { branch, table: null, delivery: null };
  }
  // DELIVERY
  if (!input.location) throw badRequest('location_required');
  if (input.branchId) {
    const branch = await db.branch.findFirst({ where: { id: input.branchId, isActive: true } });
    if (!branch) throw notFound('branch_not_found');
    if (!branch.deliveryEnabled || branch.lat === null || branch.lng === null) throw conflict('delivery_unavailable');
    const distanceKm = Math.round(haversineKm(input.location, { lat: branch.lat, lng: branch.lng }) * 10) / 10;
    if (distanceKm > branch.deliveryMaxKm) throw conflict('out_of_range', { maxKm: branch.deliveryMaxKm, distanceKm });
    return { branch, table: null, delivery: { distanceKm, fee: deliveryFee(branch, distanceKm) } };
  }
  const found = await findDeliveryBranch(db, input.location, now);
  if (!found) throw conflict('out_of_range');
  return { branch: found.branch, table: null, delivery: { distanceKm: found.distanceKm, fee: found.fee } };
}

export async function priceCart(
  db: Db,
  input: QuoteInput,
  opts: { customerId: string | null; strictDiscount: boolean; now?: Date },
): Promise<Quote> {
  const now = opts.now ?? new Date();
  const { branch, table, delivery } = await resolveBranch(db, input, now);

  if (!branch.acceptsOrders || !openState(branchHours(branch), now, branch.timezone).open) {
    throw conflict('branch_closed', { open: openState(branchHours(branch), now, branch.timezone) });
  }

  const ids = [...new Set(input.items.map((i) => i.productId))];
  const products = (await db.product.findMany({ where: { id: { in: ids }, isActive: true }, include: productInclude })) as ProductRow[];
  const byId = new Map(products.map((p) => [p.id, p]));
  const avail = await loadAvailability(db, branch.id, ids);

  // Stock is checked per product across all lines.
  const qtyByProduct = new Map<string, number>();
  for (const line of input.items) qtyByProduct.set(line.productId, (qtyByProduct.get(line.productId) ?? 0) + line.quantity);

  const lines: PricedLine[] = input.items.map((line) => {
    const p = byId.get(line.productId);
    const a = avail.get(line.productId);
    if (!p) throw conflict('item_unavailable', { productId: line.productId });
    if (a && !a.isAvailable) throw conflict('item_unavailable', { productId: p.id });
    if (a && a.stock !== null && a.stock < (qtyByProduct.get(p.id) ?? 0)) {
      throw conflict('out_of_stock', { productId: p.id, stock: a.stock });
    }

    const chosen = new Set(line.optionIds);
    const options: PricedOption[] = [];
    for (const g of p.optionGroups) {
      let picked = g.options.filter((o) => chosen.has(o.id));
      if (picked.length === 0 && g.minSelect > 0) picked = g.options.filter((o) => o.isDefault).slice(0, g.minSelect);
      if (picked.length < g.minSelect) throw badRequest('option_required', { productId: p.id, groupId: g.id });
      if (picked.length > g.maxSelect) throw badRequest('too_many_options', { productId: p.id, groupId: g.id });
      for (const o of picked) {
        options.push({ id: o.id, nameFa: o.nameFa, nameEn: o.nameEn, priceDelta: o.priceDelta });
        chosen.delete(o.id);
      }
    }
    if (chosen.size > 0) throw badRequest('invalid_option', { productId: p.id });

    const base = a?.priceOverride ?? p.basePrice;
    const unitPrice = base + options.reduce((s, o) => s + o.priceDelta, 0);
    return {
      productId: p.id,
      nameFa: p.nameFa,
      nameEn: p.nameEn,
      quantity: line.quantity,
      unitPrice,
      options,
      note: line.note?.trim() || null,
      lineTotal: unitPrice * line.quantity,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  let discount: Quote['discount'] = null;
  let discountError: string | null = null;
  if (input.discountCode) {
    const check = await evaluateDiscount(db, input.discountCode, subtotal, opts.customerId, now);
    if (check.ok) discount = { codeId: check.row.id, code: check.row.code, amount: check.amount };
    else if (opts.strictDiscount) throw conflict(check.error, check.minSubtotal ? { minSubtotal: check.minSubtotal } : undefined);
    else discountError = check.error;
  }

  let deliveryOut: Quote['delivery'] = null;
  if (input.type === 'DELIVERY' && delivery) {
    if (subtotal < branch.deliveryMinOrder) throw conflict('below_minimum', { minOrder: branch.deliveryMinOrder });
    const afterDiscount = subtotal - (discount?.amount ?? 0);
    const free = branch.deliveryFreeAbove > 0 && afterDiscount >= branch.deliveryFreeAbove;
    deliveryOut = { distanceKm: delivery.distanceKm, fee: free ? 0 : delivery.fee };
  }

  const total = subtotal - (discount?.amount ?? 0) + (deliveryOut?.fee ?? 0);
  if (total < 0) throw new AppError(500, 'negative_total');
  return { type: input.type, branch, table, lines, subtotal, discount, discountError, delivery: deliveryOut, total };
}

export function serializeQuote(q: Quote) {
  return {
    type: q.type,
    branch: { id: q.branch.id, slug: q.branch.slug, nameFa: q.branch.nameFa, nameEn: q.branch.nameEn },
    table: q.table ? { number: q.table.number } : null,
    lines: q.lines,
    subtotal: q.subtotal,
    discount: q.discount ? { code: q.discount.code, amount: q.discount.amount } : null,
    discountError: q.discountError,
    delivery: q.delivery,
    total: q.total,
  };
}
