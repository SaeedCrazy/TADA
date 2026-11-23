// Order lifecycle: create (idempotent), pay, move through the bar, cancel. Every change is one
// transaction guarded by the status it expects, so two baristas tapping at once cannot double-apply.
import type { z } from 'zod';
import {
  canTransition, createOrderSchema, LOGIN_REQUIRED_TYPES, PAYMENT_METHODS_BY_TYPE, formatToman,
  type OrderStatus,
} from '@tada/shared';
import type { AppContext } from '../../context.js';
import { Prisma, type Db } from '../../db.js';
import { AppError, badRequest, conflict, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { randomToken, safeEqualText } from '../../lib/util.js';
import type { AuthCustomer, AuthStaff } from '../../plugins/auth.js';
import { assertBranchAccess } from '../../plugins/auth.js';
import { priceCart } from './pricing.js';

type Tx = Prisma.TransactionClient;
export type CreateOrderInput = z.output<typeof createOrderSchema>;

export const orderInclude = {
  items: true,
  branch: { select: { id: true, slug: true, nameFa: true, nameEn: true, addressFa: true, addressEn: true, phone: true } },
  table: { select: { number: true, label: true } },
  events: { orderBy: { createdAt: 'asc' as const }, select: { status: true, note: true, createdAt: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function serializeOrder(o: OrderWithItems, opts: { staff?: boolean } = {}) {
  return {
    id: o.id,
    number: o.number,
    type: o.type,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    branch: o.branch,
    table: o.table,
    items: o.items.map((i) => ({
      id: i.id, productId: i.productId, nameFa: i.nameFa, nameEn: i.nameEn, quantity: i.quantity,
      unitPrice: i.unitPrice, options: i.options, note: i.note, lineTotal: i.lineTotal,
    })),
    subtotal: o.subtotal,
    discountTotal: o.discountTotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
    customerName: o.customerName,
    customerPhone: opts.staff ? o.customerPhone : o.customerPhone ? `${o.customerPhone.slice(0, 4)}***${o.customerPhone.slice(7)}` : null,
    addressText: o.addressText,
    location: opts.staff && o.lat !== null && o.lng !== null ? { lat: o.lat, lng: o.lng } : null,
    distanceKm: o.distanceKm,
    note: o.note,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    events: o.events,
    ...(opts.staff ? { customerId: o.customerId } : { accessToken: o.accessToken }),
  };
}

export function trackingUrl(ctx: AppContext, o: { id: string; accessToken: string; locale: string }) {
  const base = ctx.config.PUBLIC_WEB_URL.replace(/\/$/, '');
  return `${base}${o.locale === 'en' ? '/en' : ''}/shop/orders/${o.id}?t=${o.accessToken}`;
}

// ------------------------------------------------------------------ inventory & discounts

async function reserveStock(tx: Tx, branchId: string, items: { productId: string; quantity: number }[]) {
  const qty = new Map<string, number>();
  for (const i of items) qty.set(i.productId, (qty.get(i.productId) ?? 0) + i.quantity);
  const tracked = await tx.branchProduct.findMany({ where: { branchId, productId: { in: [...qty.keys()] }, stock: { not: null } } });
  for (const t of tracked) {
    const need = qty.get(t.productId)!;
    const r = await tx.branchProduct.updateMany({
      where: { branchId, productId: t.productId, stock: { gte: need } },
      data: { stock: { decrement: need } },
    });
    if (r.count !== 1) throw conflict('out_of_stock', { productId: t.productId });
  }
}

async function restoreStock(tx: Tx, branchId: string, items: { productId: string; quantity: number }[]) {
  for (const i of items) {
    await tx.branchProduct.updateMany({
      where: { branchId, productId: i.productId, stock: { not: null } },
      data: { stock: { increment: i.quantity } },
    });
  }
}

async function releaseDiscount(tx: Tx, orderId: string) {
  const red = await tx.discountRedemption.findUnique({ where: { orderId } });
  if (!red) return;
  await tx.discountRedemption.delete({ where: { orderId } });
  await tx.$executeRaw`UPDATE "DiscountCode" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE id = ${red.codeId}::uuid`;
}

// ------------------------------------------------------------------ notifications

const SMS_TEXT: Partial<Record<OrderStatus, (n: number, url: string) => string>> = {
  PLACED: (n, url) => `تادا: سفارش #${n} ثبت شد.\nپیگیری: ${url}`,
  READY: (n) => `تادا: سفارش #${n} آماده است. نوش جان!`,
  OUT_FOR_DELIVERY: (n) => `تادا: سفارش #${n} در راه است.`,
  CANCELLED: (n) => `تادا: سفارش #${n} لغو شد. برای پیگیری با شعبه تماس بگیرید.`,
};

async function notifyCustomer(ctx: AppContext, o: { id: string; number: number; customerPhone: string | null; accessToken: string; locale: string }, status: OrderStatus) {
  if (!ctx.config.SMS_ORDER_UPDATES || !o.customerPhone) return;
  const text = SMS_TEXT[status]?.(o.number, trackingUrl(ctx, o));
  if (!text) return;
  try {
    await ctx.sms.sendText(o.customerPhone, text);
    await ctx.db.smsLog.create({ data: { phone: o.customerPhone, template: `order.${status}`, status: 'sent' } });
  } catch (err) {
    ctx.log.warn({ err, orderId: o.id }, 'order sms failed');
    await ctx.db.smsLog.create({ data: { phone: o.customerPhone, template: `order.${status}`, status: 'failed', error: String(err).slice(0, 300) } }).catch(() => undefined);
  }
}

function emit(ctx: AppContext, o: { id: string; branchId: string; number: number; status: OrderStatus; paymentStatus: 'UNPAID' | 'PAID' | 'FAILED' | 'REFUNDED' }, kind: 'created' | 'updated') {
  ctx.bus.emitOrder({ orderId: o.id, branchId: o.branchId, number: o.number, status: o.status, paymentStatus: o.paymentStatus, kind });
}

export async function enqueueAccounting(ctx: AppContext, orderId: string) {
  if (!ctx.accounting) return;
  await ctx.db.accountingJob.upsert({
    where: { orderId },
    create: { orderId, driver: ctx.accounting.name },
    update: {},
  });
}

// ------------------------------------------------------------------ create

export async function createOrder(ctx: AppContext, input: CreateOrderInput, customer: AuthCustomer | null) {
  const { db } = ctx;

  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: orderInclude });
  if (existing) {
    if (existing.customerId && existing.customerId !== customer?.id) throw conflict('idempotency_key_reused');
    return { order: existing, created: false };
  }

  if (!PAYMENT_METHODS_BY_TYPE[input.type].includes(input.paymentMethod)) throw badRequest('payment_method_not_allowed');
  if (LOGIN_REQUIRED_TYPES.includes(input.type) && !customer) throw unauthorized('login_required');
  if (customer?.isBlocked) throw forbidden('account_blocked');

  let location = input.location;
  let addressText = input.addressText ?? null;
  if (input.type === 'DELIVERY') {
    if (input.addressId) {
      const addr = await db.address.findFirst({ where: { id: input.addressId, customerId: customer!.id } });
      if (!addr) throw notFound('address_not_found');
      location = { lat: addr.lat, lng: addr.lng };
      addressText = addr.line;
    }
    if (!location) throw badRequest('location_required');
    if (!addressText || addressText.length < 5) throw badRequest('address_required');
  } else {
    addressText = null;
    location = undefined;
  }

  const quote = await priceCart(db, { ...input, location }, { customerId: customer?.id ?? null, strictDiscount: true });
  const status: OrderStatus = input.paymentMethod === 'ONLINE' ? 'PENDING_PAYMENT' : 'PLACED';

  let order: OrderWithItems;
  try {
    order = await db.$transaction(async (tx) => {
      await reserveStock(tx, quote.branch.id, quote.lines);
      if (quote.discount) {
        const n = await tx.$executeRaw`
          UPDATE "DiscountCode" SET "usedCount" = "usedCount" + 1
          WHERE id = ${quote.discount.codeId}::uuid AND "isActive" AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
        if (n !== 1) throw conflict('code_used_up');
      }
      const created = await tx.order.create({
        data: {
          accessToken: randomToken(24),
          branchId: quote.branch.id,
          customerId: customer?.id ?? null,
          tableId: quote.table?.id ?? null,
          type: input.type,
          status,
          paymentMethod: input.paymentMethod,
          subtotal: quote.subtotal,
          discountTotal: quote.discount?.amount ?? 0,
          deliveryFee: quote.delivery?.fee ?? 0,
          total: quote.total,
          discountCodeId: quote.discount?.codeId ?? null,
          customerName: input.customerName,
          customerPhone: customer?.phone ?? null,
          addressText,
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          distanceKm: quote.delivery?.distanceKm ?? null,
          note: input.note?.trim() || null,
          locale: input.locale,
          idempotencyKey: input.idempotencyKey,
          items: {
            create: quote.lines.map((l) => ({
              productId: l.productId, nameFa: l.nameFa, nameEn: l.nameEn, unitPrice: l.unitPrice,
              quantity: l.quantity, options: l.options as unknown as Prisma.InputJsonValue, note: l.note, lineTotal: l.lineTotal,
            })),
          },
          events: { create: { status } },
        },
        include: orderInclude,
      });
      if (quote.discount) {
        await tx.discountRedemption.create({ data: { codeId: quote.discount.codeId, customerId: customer?.id ?? null, orderId: created.id } });
      }
      return created;
    });
  } catch (err) {
    // Two requests with the same idempotency key raced: return the winner.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const again = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: orderInclude });
      if (again) return { order: again, created: false };
    }
    throw err;
  }

  if (order.status === 'PLACED') {
    emit(ctx, order, 'created');
    void notifyCustomer(ctx, order, 'PLACED');
  }
  return { order, created: true };
}

// ------------------------------------------------------------------ payments

export async function startPayment(ctx: AppContext, order: { id: string; number: number; total: number; status: OrderStatus; customerPhone: string | null; accessToken: string }) {
  if (order.status !== 'PENDING_PAYMENT') throw conflict('not_awaiting_payment');
  const base = ctx.config.PUBLIC_WEB_URL.replace(/\/$/, '');
  try {
    const start = await ctx.payments.request({
      amount: order.total,
      description: `سفارش ${order.number} کافه تادا`,
      callbackUrl: `${base}/api/payments/callback?o=${order.id}`,
      mobile: order.customerPhone,
      orderId: order.id,
    });
    await ctx.db.payment.create({
      data: { orderId: order.id, provider: ctx.payments.name, amount: order.total, status: 'PENDING', authority: start.authority },
    });
    return { redirectUrl: start.redirectUrl };
  } catch (err) {
    ctx.log.error({ err, orderId: order.id }, 'payment request failed');
    await ctx.db.payment.create({
      data: { orderId: order.id, provider: ctx.payments.name, amount: order.total, status: 'FAILED', error: String(err).slice(0, 300) },
    });
    throw new AppError(502, 'gateway_unavailable');
  }
}

/** Handles the gateway callback. Safe to call twice for the same authority. */
export async function completePayment(ctx: AppContext, orderId: string, authority: string, gatewayStatus: string) {
  const { db } = ctx;
  const payment = await db.payment.findUnique({ where: { authority }, include: { order: true } });
  if (!payment || payment.orderId !== orderId) throw notFound('payment_not_found');
  const order = payment.order;
  if (payment.status === 'PAID') return { paid: true, order };

  if (gatewayStatus !== 'OK') {
    await db.payment.updateMany({ where: { id: payment.id, status: { in: ['INIT', 'PENDING'] } }, data: { status: 'FAILED', error: 'cancelled' } });
    return { paid: false, order };
  }

  const result = await ctx.payments.verify(authority, payment.amount);
  if (!result.ok) {
    await db.payment.updateMany({
      where: { id: payment.id, status: { in: ['INIT', 'PENDING', 'FAILED'] } },
      data: { status: 'FAILED', error: result.error, raw: (result.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    });
    return { paid: false, order };
  }

  const updated = await db.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: 'PAID' } },
      data: {
        status: 'PAID', refId: result.refId, cardPan: result.cardPan ?? null, verifiedAt: new Date(),
        raw: (result.raw ?? Prisma.JsonNull) as Prisma.InputJsonValue, error: null,
      },
    });
    if (claimed.count === 0) return null; // a concurrent callback already completed it
    const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const reopen = current.status === 'PENDING_PAYMENT' || current.status === 'CANCELLED';
    if (current.status === 'CANCELLED') {
      // Paid after the payment window closed: put it back on the bar and flag it. The money is
      // already taken, so stock is taken back without the availability guard (it may hit zero).
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const i of items) {
        await tx.branchProduct.updateMany({
          where: { branchId: current.branchId, productId: i.productId, stock: { not: null } },
          data: { stock: { decrement: i.quantity } },
        });
      }
    }
    const o = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        paidAt: new Date(),
        ...(reopen ? { status: 'PLACED', cancelledAt: null } : {}),
        ...(reopen ? { events: { create: { status: 'PLACED', note: current.status === 'CANCELLED' ? 'paid_after_timeout' : 'paid_online' } } } : {}),
      },
    });
    return o;
  });

  if (!updated) {
    return { paid: true, order: await db.order.findUniqueOrThrow({ where: { id: orderId } }) };
  }
  emit(ctx, updated, 'created');
  void notifyCustomer(ctx, updated, 'PLACED');
  await enqueueAccounting(ctx, orderId);
  return { paid: true, order: updated };
}

// ------------------------------------------------------------------ staff actions

export async function changeStatus(ctx: AppContext, staff: AuthStaff, orderId: string, to: OrderStatus, note?: string) {
  const { db } = ctx;
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw notFound('order_not_found');
  assertBranchAccess(staff, order.branchId);
  if (!canTransition(order.status, to, order.type)) throw conflict('invalid_transition', { from: order.status, to });

  const autoPaid = to === 'COMPLETED' && order.paymentStatus === 'UNPAID' && order.paymentMethod !== 'ONLINE';
  const updated = await db.$transaction(async (tx) => {
    const r = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        status: to,
        ...(to === 'COMPLETED' ? { completedAt: new Date() } : {}),
        ...(to === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
        ...(autoPaid ? { paymentStatus: 'PAID', paidAt: new Date() } : {}),
      },
    });
    if (r.count !== 1) throw conflict('stale_order');
    await tx.orderEvent.create({ data: { orderId, status: to, note: note ?? (autoPaid ? 'paid_at_handover' : null), staffId: staff.id } });
    if (to === 'CANCELLED') {
      await restoreStock(tx, order.branchId, order.items);
      if (order.paymentStatus !== 'PAID') await releaseDiscount(tx, orderId);
    }
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  });

  emit(ctx, updated, 'updated');
  if (autoPaid) await enqueueAccounting(ctx, orderId);
  if (to === 'READY' && order.type === 'DELIVERY') {
    // Delivery customers hear from us when the courier leaves, not when the cup is ready.
  } else {
    void notifyCustomer(ctx, updated, to);
  }
  return updated;
}

export async function markPaid(ctx: AppContext, staff: AuthStaff, orderId: string) {
  const { db } = ctx;
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('order_not_found');
  assertBranchAccess(staff, order.branchId);
  if (order.paymentMethod === 'ONLINE') throw conflict('online_orders_are_paid_by_gateway');
  if (order.status === 'CANCELLED' || order.status === 'PENDING_PAYMENT') throw conflict('invalid_state');
  const r = await db.order.updateMany({ where: { id: orderId, paymentStatus: 'UNPAID' }, data: { paymentStatus: 'PAID', paidAt: new Date() } });
  if (r.count !== 1) throw conflict('already_paid');
  await db.orderEvent.create({ data: { orderId, status: order.status, note: 'marked_paid', staffId: staff.id } });
  const updated = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  emit(ctx, updated, 'updated');
  await enqueueAccounting(ctx, orderId);
  return updated;
}

export async function markRefunded(ctx: AppContext, staff: AuthStaff, orderId: string) {
  const { db } = ctx;
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound('order_not_found');
  assertBranchAccess(staff, order.branchId);
  if (order.status !== 'CANCELLED' || order.paymentStatus !== 'PAID') throw conflict('invalid_state');
  await db.order.update({ where: { id: orderId }, data: { paymentStatus: 'REFUNDED' } });
  await db.orderEvent.create({ data: { orderId, status: 'CANCELLED', note: 'refunded', staffId: staff.id } });
}

// ------------------------------------------------------------------ housekeeping

/** Cancels online orders whose payment window has passed. Returns how many were cancelled. */
export async function expireUnpaidOrders(ctx: AppContext, now = new Date()): Promise<number> {
  const { db } = ctx;
  const cutoff = new Date(now.getTime() - ctx.config.PAYMENT_TIMEOUT_MINUTES * 60_000);
  const stale = await db.order.findMany({ where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } }, include: { items: true }, take: 100 });
  let n = 0;
  for (const o of stale) {
    const done = await db.$transaction(async (tx) => {
      const r = await tx.order.updateMany({ where: { id: o.id, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED', cancelledAt: now } });
      if (r.count !== 1) return false;
      await tx.orderEvent.create({ data: { orderId: o.id, status: 'CANCELLED', note: 'payment_timeout' } });
      await tx.payment.updateMany({ where: { orderId: o.id, status: { in: ['INIT', 'PENDING'] } }, data: { status: 'FAILED', error: 'timeout' } });
      await restoreStock(tx, o.branchId, o.items);
      await releaseDiscount(tx, o.id);
      return true;
    });
    if (done) n++;
  }
  return n;
}

export async function getOrderForViewer(db: Db, id: string, token: string | undefined, customer: AuthCustomer | null) {
  const order = await db.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw notFound('order_not_found');
  const ownsIt = customer && order.customerId === customer.id;
  const hasToken = Boolean(token && token.length >= 16 && safeEqualText(token, order.accessToken));
  if (!ownsIt && !hasToken) throw notFound('order_not_found');
  return order;
}

export const describeTotal = (rial: number) => formatToman(rial, 'fa');
