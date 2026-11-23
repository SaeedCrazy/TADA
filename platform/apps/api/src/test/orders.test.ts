import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, createTestApp, fixtures, loginCustomer, loginStaff, uuid, type TestEnv } from './helpers.js';
import { expireUnpaidOrders } from '../modules/orders/orders.service.js';
import { runAccountingSync } from '../modules/accounting/sync.js';

let env: TestEnv;
let fx: Awaited<ReturnType<typeof fixtures>>;
beforeAll(async () => {
  env = await createTestApp();
  fx = await fixtures(env.db);
});
afterAll(async () => { await env.close(); });

const T = (toman: number) => toman * 10;

describe('pricing', () => {
  it('prices options on the server and ignores anything the client might claim', async () => {
    const c = new Client(env.app);
    const oat = fx.opt('Milk', 'Oat milk');
    const iced = fx.opt('Served', 'Iced');
    const r = await c.post('/api/cart/quote', {
      type: 'DINE_IN', tableToken: fx.table.token,
      items: [{ productId: fx.latte.id, quantity: 2, optionIds: [oat.id, iced.id], price: 1 }, { productId: fx.cookie.id, quantity: 1 }],
    });
    expect(r.status).toBe(200);
    const q = r.body.quote;
    expect(q.lines[0].unitPrice).toBe(T(185000) + T(40000) + T(10000));
    expect(q.lines[0].lineTotal).toBe((T(185000) + T(40000) + T(10000)) * 2);
    // Required groups fall back to their default option.
    expect(q.lines[1].unitPrice).toBe(T(110000));
    expect(q.total).toBe(q.subtotal);
    expect(q.table).toEqual({ number: 1 });
  });

  it('rejects options from another product and invalid quantities', async () => {
    const c = new Client(env.app);
    const oat = fx.opt('Milk', 'Oat milk');
    const r = await c.post('/api/cart/quote', { type: 'DINE_IN', tableToken: fx.table.token, items: [{ productId: fx.espresso.id, quantity: 1, optionIds: [oat.id] }] });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('invalid_option');
    expect((await c.post('/api/cart/quote', { type: 'DINE_IN', tableToken: fx.table.token, items: [{ productId: fx.espresso.id, quantity: 50 }] })).status).toBe(400);
  });

  it('respects per-branch availability and price overrides', async () => {
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.espresso.id } }, data: { priceOverride: T(99000) } });
    const c = new Client(env.app);
    const ok = await c.post('/api/cart/quote', { type: 'DINE_IN', tableToken: fx.table.token, items: [{ productId: fx.espresso.id, quantity: 1 }] });
    expect(ok.body.quote.lines[0].unitPrice).toBe(T(99000));
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.espresso.id } }, data: { isAvailable: false, priceOverride: null } });
    const no = await c.post('/api/cart/quote', { type: 'DINE_IN', tableToken: fx.table.token, items: [{ productId: fx.espresso.id, quantity: 1 }] });
    expect(no.status).toBe(409);
    expect(no.body.error.code).toBe('item_unavailable');
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.espresso.id } }, data: { isAvailable: true } });
  });

  it('refuses orders when the branch is closed or paused', async () => {
    const c = new Client(env.app);
    await env.db.branch.update({ where: { id: fx.branch.id }, data: { acceptsOrders: false } });
    const r = await c.post('/api/cart/quote', { type: 'DINE_IN', tableToken: fx.table.token, items: [{ productId: fx.espresso.id, quantity: 1 }] });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('branch_closed');
    await env.db.branch.update({ where: { id: fx.branch.id }, data: { acceptsOrders: true, hours: [['00:00', '00:01']] } });
    expect((await c.post('/api/cart/quote', { type: 'DINE_IN', tableToken: fx.table.token, items: [{ productId: fx.espresso.id, quantity: 1 }] })).status).toBe(409);
    await env.db.branch.update({ where: { id: fx.branch.id }, data: { hours: [['00:00', '24:00']] } });
  });

  it('reports discount problems on quotes without failing them', async () => {
    const c = new Client(env.app);
    const r = await c.post('/api/cart/quote', { type: 'DINE_IN', tableToken: fx.table.token, items: [{ productId: fx.espresso.id, quantity: 1 }], discountCode: 'welcome10' });
    expect(r.status).toBe(200);
    expect(r.body.quote.discount).toBeNull();
    expect(r.body.quote.discountError).toBe('code_login_required');
  });
});

describe('dine-in orders', () => {
  it('places a pay-at-counter order from a table QR as a guest', async () => {
    const c = new Client(env.app);
    const events: string[] = [];
    const off = env.app.ctx.bus.onOrder((e) => events.push(`${e.kind}:${e.status}`));
    const key = uuid();
    const body = {
      type: 'DINE_IN', tableToken: fx.table.token, paymentMethod: 'COUNTER', customerName: 'مهمان میز ۱',
      items: [{ productId: fx.espresso.id, quantity: 2 }], idempotencyKey: key,
    };
    const r = await c.post('/api/orders', body);
    off();
    expect(r.status).toBe(201);
    expect(r.body.order).toMatchObject({ status: 'PLACED', paymentStatus: 'UNPAID', type: 'DINE_IN', table: { number: 1 }, total: T(120000) * 2 });
    expect(r.body.payment).toBeNull();
    expect(events).toEqual(['created:PLACED']);

    // Same idempotency key: same order, no duplicate.
    const again = await c.post('/api/orders', body);
    expect(again.status).toBe(200);
    expect(again.body.order.id).toBe(r.body.order.id);
    expect(await env.db.order.count({ where: { idempotencyKey: key } })).toBe(1);

    // Guests follow the order with its token; anyone else gets 404.
    const view = await new Client(env.app).get(`/api/orders/${r.body.order.id}?t=${r.body.order.accessToken}`);
    expect(view.status).toBe(200);
    expect((await new Client(env.app).get(`/api/orders/${r.body.order.id}?t=wrong-token-wrong-token`)).status).toBe(404);
    expect((await new Client(env.app).get(`/api/orders/${r.body.order.id}`)).status).toBe(404);
  });

  it('does not allow online-only methods for the wrong order type', async () => {
    const c = new Client(env.app);
    const r = await c.post('/api/orders', {
      type: 'DINE_IN', tableToken: fx.table.token, paymentMethod: 'ON_DELIVERY', customerName: 'x',
      items: [{ productId: fx.espresso.id, quantity: 1 }], idempotencyKey: uuid(),
    });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('payment_method_not_allowed');
  });

  it('reserves stock and refuses to oversell', async () => {
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.cookie.id } }, data: { stock: 3 } });
    const c = new Client(env.app);
    const order = (qty: number) => c.post('/api/orders', {
      type: 'DINE_IN', tableToken: fx.table.token, paymentMethod: 'COUNTER', customerName: 'x',
      items: [{ productId: fx.cookie.id, quantity: qty }], idempotencyKey: uuid(),
    });
    expect((await order(2)).status).toBe(201);
    const over = await order(2);
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('out_of_stock');
    const row = await env.db.branchProduct.findUniqueOrThrow({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.cookie.id } } });
    expect(row.stock).toBe(1);
    // Concurrent orders for the last items: exactly one wins.
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.cookie.id } }, data: { stock: 1 } });
    const results = await Promise.all([order(1), order(1), order(1)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.cookie.id } }, data: { stock: null } });
  });
});

describe('online payment', () => {
  it('requires login for pickup', async () => {
    const r = await new Client(env.app).post('/api/orders', {
      type: 'PICKUP', branchId: fx.branch.id, paymentMethod: 'ONLINE', customerName: 'x', items: [{ productId: fx.espresso.id, quantity: 1 }], idempotencyKey: uuid(),
    });
    expect(r.status).toBe(401);
  });

  it('pays through the gateway, verifies server-side and is idempotent', async () => {
    const c = await loginCustomer(env.app, '09121110000', 'رضا');
    const r = await c.post('/api/orders', {
      type: 'PICKUP', branchId: fx.branch.id, paymentMethod: 'ONLINE', customerName: 'رضا',
      items: [{ productId: fx.latte.id, quantity: 1 }], discountCode: 'WELCOME10', idempotencyKey: uuid(),
    });
    expect(r.status).toBe(201);
    const order = r.body.order;
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.discountTotal).toBe(T(18500));
    expect(order.total).toBe(T(185000) - T(18500));
    expect(r.body.payment.redirectUrl).toMatch(/\/api\/payments\/mock\/MOCK/);

    // Not on the bar until paid.
    const owner = await loginStaff(env.app);
    const active = await owner.get(`/api/staff/orders?status=ACTIVE&branchId=${fx.branch.id}`);
    expect(active.body.orders.find((o: { id: string }) => o.id === order.id)).toBeUndefined();

    // The customer approves on the gateway page and comes back through the callback.
    const url = new URL(r.body.payment.redirectUrl);
    const approve = await new Client(env.app).get(`${url.pathname.replace(/\/?$/, '/approve')}${url.search}`);
    expect(approve.status).toBe(302);
    const callback = new URL(approve.raw.headers.location as string);
    expect(callback.searchParams.get('Status')).toBe('OK');
    const cb = await new Client(env.app).get(`${callback.pathname}${callback.search}`);
    expect(cb.status).toBe(302);
    expect(cb.raw.headers.location).toContain(`/shop/orders/${order.id}?t=`);
    expect(cb.raw.headers.location).toContain('paid=1');

    const paid = await env.db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid).toMatchObject({ status: 'PLACED', paymentStatus: 'PAID' });
    expect(await env.db.payment.count({ where: { orderId: order.id, status: 'PAID' } })).toBe(1);

    // A replayed callback changes nothing.
    await new Client(env.app).get(`${callback.pathname}${callback.search}`);
    expect(await env.db.orderEvent.count({ where: { orderId: order.id, status: 'PLACED' } })).toBe(1);

    // The invoice is queued and pushed to accounting.
    expect(await env.db.accountingJob.count({ where: { orderId: order.id } })).toBe(1);
    const sync = await runAccountingSync(env.app.ctx);
    expect(sync.done).toBeGreaterThanOrEqual(1);
    const inv = env.accounting.invoices.find((i) => i.orderId === order.id)!;
    expect(inv).toMatchObject({ invoiceNumber: `TADA-${order.number}`, total: order.total, discount: T(18500), paymentRef: expect.any(String) });

    // The SMS went out with a tracking link.
    expect(env.sms.sent.some((m) => m.phone === '09121110000' && m.text.includes(`#${order.number}`))).toBe(true);

    // WELCOME10 is one per customer.
    const second = await c.post('/api/orders', {
      type: 'PICKUP', branchId: fx.branch.id, paymentMethod: 'ONLINE', customerName: 'رضا',
      items: [{ productId: fx.latte.id, quantity: 1 }], discountCode: 'WELCOME10', idempotencyKey: uuid(),
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('code_customer_limit');
  });

  it('keeps the order unpaid when the customer cancels at the gateway, and lets them retry', async () => {
    const c = await loginCustomer(env.app, '09121110001');
    const r = await c.post('/api/orders', {
      type: 'PICKUP', branchId: fx.branch.id, paymentMethod: 'ONLINE', customerName: 'x', items: [{ productId: fx.espresso.id, quantity: 1 }], idempotencyKey: uuid(),
    });
    const url = new URL(r.body.payment.redirectUrl);
    const cb = new URL(url.searchParams.get('cb')!);
    const authority = url.pathname.split('/').pop()!;
    const res = await new Client(env.app).get(`${cb.pathname}${cb.search}&Authority=${authority}&Status=NOK`);
    expect(res.raw.headers.location).toContain('paid=0');
    expect((await env.db.order.findUniqueOrThrow({ where: { id: r.body.order.id } })).status).toBe('PENDING_PAYMENT');
    // A forged "OK" without approval at the gateway fails verification.
    await new Client(env.app).get(`${cb.pathname}${cb.search}&Authority=${authority}&Status=OK`);
    expect((await env.db.order.findUniqueOrThrow({ where: { id: r.body.order.id } })).paymentStatus).toBe('UNPAID');
    const retry = await c.post(`/api/orders/${r.body.order.id}/pay`);
    expect(retry.status).toBe(200);
    expect(retry.body.payment.redirectUrl).toContain('/api/payments/mock/');
  });

  it('cancels unpaid orders after the payment window and gives stock and codes back', async () => {
    const c = await loginCustomer(env.app, '09121110002');
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.cookie.id } }, data: { stock: 5 } });
    const r = await c.post('/api/orders', {
      type: 'PICKUP', branchId: fx.branch.id, paymentMethod: 'ONLINE', customerName: 'x',
      items: [{ productId: fx.cookie.id, quantity: 2 }], discountCode: 'WELCOME10', idempotencyKey: uuid(),
    });
    expect(r.status).toBe(201);
    const before = await env.db.discountCode.findUniqueOrThrow({ where: { code: 'WELCOME10' } });
    const n = await expireUnpaidOrders(env.app.ctx, new Date(Date.now() + 21 * 60_000));
    expect(n).toBeGreaterThanOrEqual(1);
    const o = await env.db.order.findUniqueOrThrow({ where: { id: r.body.order.id } });
    expect(o.status).toBe('CANCELLED');
    const stock = await env.db.branchProduct.findUniqueOrThrow({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.cookie.id } } });
    expect(stock.stock).toBe(5);
    const after = await env.db.discountCode.findUniqueOrThrow({ where: { code: 'WELCOME10' } });
    expect(after.usedCount).toBe(before.usedCount - 1);
    expect(await env.db.discountRedemption.count({ where: { orderId: o.id } })).toBe(0);
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.cookie.id } }, data: { stock: null } });
  });

  it('never trusts the mock gateway page with a foreign callback', async () => {
    const r = await new Client(env.app).get('/api/payments/mock/MOCKabcdefgh12/approve?cb=https%3A%2F%2Fevil.example%2Fx');
    expect(r.status).toBe(404);
    const page = await new Client(env.app).get('/api/payments/mock/MOCKabcdefgh12?cb=https%3A%2F%2Fevil.example%2Fx');
    expect(page.status).toBe(400);
  });
});

describe('delivery', () => {
  beforeAll(async () => {
    await env.db.branch.update({
      where: { id: fx.branch.id },
      data: { lat: 35.7600, lng: 51.4100, deliveryEnabled: true, deliveryBaseFee: T(30000), deliveryPerKm: T(10000), deliveryMaxKm: 5, deliveryMinOrder: T(150000), deliveryFreeAbove: T(1000000) },
    });
  });

  it('finds the nearest branch and prices delivery by distance', async () => {
    const check = await new Client(env.app).post('/api/delivery/check', { lat: 35.7800, lng: 51.4100 });
    expect(check.body).toMatchObject({ available: true, branch: { slug: 'mollasadra' } });
    expect(check.body.distanceKm).toBeCloseTo(2.2, 1);
    expect(check.body.fee).toBe(T(30000) + T(10000) * 2);
    expect((await new Client(env.app).post('/api/delivery/check', { lat: 36.5, lng: 52.5 })).body.available).toBe(false);
  });

  it('enforces the minimum order and makes delivery free above the threshold', async () => {
    const c = await loginCustomer(env.app, '09121110003');
    const small = await c.post('/api/cart/quote', { type: 'DELIVERY', location: { lat: 35.78, lng: 51.41 }, items: [{ productId: fx.cookie.id, quantity: 1 }] });
    expect(small.status).toBe(409);
    expect(small.body.error.code).toBe('below_minimum');
    const big = await c.post('/api/cart/quote', { type: 'DELIVERY', location: { lat: 35.78, lng: 51.41 }, items: [{ productId: fx.latte.id, quantity: 6 }] });
    expect(big.body.quote.delivery).toMatchObject({ fee: 0 });
  });

  it('places a cash-on-delivery order with a saved address', async () => {
    const c = await loginCustomer(env.app, '09121110004');
    const addr = await c.post('/api/me/addresses', { title: 'خانه', line: 'خیابان نمونه، پلاک ۱۲', lat: 35.775, lng: 51.405 });
    expect(addr.status).toBe(201);
    const r = await c.post('/api/orders', {
      type: 'DELIVERY', paymentMethod: 'ON_DELIVERY', customerName: 'سامان', addressId: addr.body.address.id,
      items: [{ productId: fx.latte.id, quantity: 2 }], idempotencyKey: uuid(),
    });
    expect(r.status).toBe(201);
    expect(r.body.order).toMatchObject({ status: 'PLACED', type: 'DELIVERY', addressText: 'خیابان نمونه، پلاک ۱۲' });
    expect(r.body.order.deliveryFee).toBeGreaterThan(0);
    expect(r.body.order.total).toBe(r.body.order.subtotal + r.body.order.deliveryFee);
  });

  it('refuses another customer\'s address', async () => {
    const a = await loginCustomer(env.app, '09121110005');
    const addr = await a.post('/api/me/addresses', { title: 'کار', line: 'آدرس محرمانه، پلاک ۵', lat: 35.77, lng: 51.41 });
    const b = await loginCustomer(env.app, '09121110006');
    const r = await b.post('/api/orders', {
      type: 'DELIVERY', paymentMethod: 'ON_DELIVERY', customerName: 'x', addressId: addr.body.address.id,
      items: [{ productId: fx.latte.id, quantity: 2 }], idempotencyKey: uuid(),
    });
    expect(r.status).toBe(404);
    expect((await b.del(`/api/me/addresses/${addr.body.address.id}`)).status).toBe(404);
  });
});
