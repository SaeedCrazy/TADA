import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, createTestApp, fixtures, loginStaff, uuid, type TestEnv } from './helpers.js';
import { hashPassword } from '../modules/auth/auth.routes.js';

let env: TestEnv;
let fx: Awaited<ReturnType<typeof fixtures>>;
let owner: Client;
let barista: Client;
let manager: Client;

beforeAll(async () => {
  env = await createTestApp();
  fx = await fixtures(env.db);
  await env.db.staff.create({ data: { username: 'bar1', name: 'باریستا', role: 'BARISTA', branchId: fx.branch.id, passwordHash: await hashPassword('barista-password-1') } });
  await env.db.staff.create({ data: { username: 'mgr2', name: 'مدیر جمهوری', role: 'MANAGER', branchId: fx.other.id, passwordHash: await hashPassword('manager-password-2') } });
  owner = await loginStaff(env.app);
  barista = await loginStaff(env.app, 'bar1', 'barista-password-1');
  manager = await loginStaff(env.app, 'mgr2', 'manager-password-2');
});
afterAll(async () => { await env.close(); });

async function counterOrder(items = [{ productId: fx.espresso.id, quantity: 1 }]) {
  const r = await new Client(env.app).post('/api/orders', {
    type: 'DINE_IN', tableToken: fx.table.token, paymentMethod: 'COUNTER', customerName: 'میز ۱', items, idempotencyKey: uuid(),
  });
  expect(r.status).toBe(201);
  return r.body.order as { id: string; number: number; total: number };
}

describe('the bar flow', () => {
  it('moves an order through the bar and marks counter orders paid at handover', async () => {
    const o = await counterOrder();
    const step = (to: string) => barista.post(`/api/staff/orders/${o.id}/status`, { status: to });
    expect((await step('PREPARING')).status).toBe(200);
    const skip = await step('PLACED');
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('invalid_transition');
    expect((await step('READY')).status).toBe(200);
    const done = await step('COMPLETED');
    expect(done.body.order).toMatchObject({ status: 'COMPLETED', paymentStatus: 'PAID' });
    expect(await env.db.accountingJob.count({ where: { orderId: o.id } })).toBe(1);
    const events = await env.db.orderEvent.findMany({ where: { orderId: o.id }, orderBy: { createdAt: 'asc' } });
    expect(events.map((e) => e.status)).toEqual(['PLACED', 'PREPARING', 'READY', 'COMPLETED']);
  });

  it('marks counter payment explicitly and refuses to do it twice', async () => {
    const o = await counterOrder();
    expect((await barista.post(`/api/staff/orders/${o.id}/mark-paid`)).status).toBe(200);
    expect((await barista.post(`/api/staff/orders/${o.id}/mark-paid`)).status).toBe(409);
  });

  it('keeps staff inside their own branch', async () => {
    const o = await counterOrder();
    expect((await manager.post(`/api/staff/orders/${o.id}/status`, { status: 'PREPARING' })).status).toBe(403);
    expect((await manager.get(`/api/staff/orders/${o.id}`)).status).toBe(403);
    expect((await manager.get(`/api/staff/orders?branchId=${fx.branch.id}`)).status).toBe(403);
    const own = await manager.get('/api/staff/orders');
    expect(own.body.orders.every((x: { branch: { id: string } }) => x.branch.id === fx.other.id)).toBe(true);
  });

  it('streams new orders to the bar screen', async () => {
    const events: string[] = [];
    const off = env.app.ctx.bus.onOrder((e) => { if (e.branchId === fx.branch.id) events.push(e.status); });
    await counterOrder();
    off();
    expect(events).toContain('PLACED');
  });

  it('cancels with stock returned', async () => {
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.cookie.id } }, data: { stock: 4 } });
    const o = await counterOrder([{ productId: fx.cookie.id, quantity: 3 }]);
    expect((await barista.post(`/api/staff/orders/${o.id}/status`, { status: 'CANCELLED', note: 'مشتری رفت' })).status).toBe(200);
    const s = await env.db.branchProduct.findUniqueOrThrow({ where: { branchId_productId: { branchId: fx.branch.id, productId: fx.cookie.id } } });
    expect(s.stock).toBe(4);
  });
});

describe('roles', () => {
  it('lets only the owner edit the menu', async () => {
    const cat = await env.db.category.findFirstOrThrow();
    const product = {
      categoryId: cat.id, kind: 'DRINK', nameFa: 'نوشیدنی تست', nameEn: 'Test drink', basePrice: 1500000,
      taste: { sweetness: 2, bitterness: 2, acidity: 1, body: 2, caffeine: 2, milk: true, temperature: 'HOT', notes: ['creamy'] },
      optionGroups: [{ nameFa: 'اندازه', nameEn: 'Size', minSelect: 1, maxSelect: 1, options: [{ nameFa: 'کوچک', nameEn: 'Small', isDefault: true }, { nameFa: 'بزرگ', nameEn: 'Large', priceDelta: 200000 }] }],
    };
    expect((await barista.post('/api/staff/products', product)).status).toBe(403);
    expect((await manager.post('/api/staff/products', product)).status).toBe(403);
    const created = await owner.post('/api/staff/products', product);
    expect(created.status).toBe(201);
    const menu = await new Client(env.app).get('/api/menu?branch=mollasadra');
    const p = menu.body.products.find((x: { id: string }) => x.id === created.body.product.id);
    expect(p.optionGroups[0].options).toHaveLength(2);

    // Edit keeps option ids that still exist.
    const group = p.optionGroups[0];
    const upd = await owner.put(`/api/staff/products/${p.id}`, {
      ...product, basePrice: 1600000,
      optionGroups: [{ ...product.optionGroups[0], id: group.id, options: [{ id: group.options[0].id, nameFa: 'کوچک', nameEn: 'Small', isDefault: true }] }],
    });
    expect(upd.status).toBe(200);
    const after = await env.db.option.findMany({ where: { groupId: group.id } });
    expect(after.map((o) => o.id)).toEqual([group.options[0].id]);
  });

  it('lets baristas mark items sold out but not change prices', async () => {
    const url = `/api/staff/branches/${fx.branch.id}/availability/${fx.latte.id}`;
    expect((await barista.put(url, { isAvailable: false })).status).toBe(200);
    expect((await barista.put(url, { priceOverride: 1 })).status).toBe(403);
    expect((await barista.put(`/api/staff/branches/${fx.other.id}/availability/${fx.latte.id}`, { isAvailable: false })).status).toBe(403);
    await barista.put(url, { isAvailable: true });
  });

  it('keeps staff management with the owner', async () => {
    expect((await manager.get('/api/staff/staff-users')).status).toBe(403);
    const r = await owner.post('/api/staff/staff-users', { username: 'newbar', name: 'جدید', role: 'BARISTA', branchId: fx.branch.id, password: 'a-strong-password' });
    expect(r.status).toBe(201);
    expect(r.body.staff.passwordHash).toBeUndefined();
    expect((await owner.post('/api/staff/staff-users', { username: 'nobranch', name: 'x', role: 'BARISTA', password: 'a-strong-password' })).status).toBe(400);
  });

  it('rotates a table QR token so the old code stops working', async () => {
    const t = await env.db.diningTable.findFirstOrThrow({ where: { branchId: fx.branch.id, number: 9 } });
    expect((await new Client(env.app).get(`/api/tables/${t.token}`)).status).toBe(200);
    const r = await owner.post(`/api/staff/tables/${t.id}/rotate`);
    expect(r.status).toBe(200);
    expect((await new Client(env.app).get(`/api/tables/${t.token}`)).status).toBe(404);
    const svg = await owner.get(`/api/staff/tables/${t.id}/qr.svg`);
    expect(svg.raw.headers['content-type']).toContain('image/svg+xml');
    expect(svg.raw.body).toContain('<svg');
  });
});

describe('uploads', () => {
  const multipart = (filename: string, type: string, content: Buffer) => {
    const boundary = '----tada' + Math.random().toString(16).slice(2);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return { body, type: `multipart/form-data; boundary=${boundary}` };
  };
  const cookieOf = (c: Client) => [...c.cookies].map(([k, v]) => `${k}=${v}`).join('; ');

  it('accepts a real PNG and rejects a disguised file', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8ffbf1e000502027f3d2b6b6d0000000049454e44ae426082', 'hex');
    const good = multipart('a.png', 'image/png', png);
    const r = await env.app.inject({ method: 'POST', url: `/api/staff/products/${fx.latte.id}/image`, headers: { cookie: cookieOf(owner), origin: 'http://localhost:3000', 'content-type': good.type }, payload: good.body });
    expect(r.statusCode).toBe(200);
    const url = r.json().imageUrl as string;
    expect(url).toMatch(/^\/uploads\/products\/[\w-]+\.png$/);
    expect((await env.app.inject({ method: 'GET', url })).statusCode).toBe(200);

    const fake = multipart('x.png', 'image/png', Buffer.from('<script>alert(1)</script>'));
    const bad = await env.app.inject({ method: 'POST', url: `/api/staff/products/${fx.latte.id}/image`, headers: { cookie: cookieOf(owner), origin: 'http://localhost:3000', 'content-type': fake.type }, payload: fake.body });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('file_content_mismatch');

    const svg = multipart('x.svg', 'image/svg+xml', Buffer.from('<svg/>'));
    const svgRes = await env.app.inject({ method: 'POST', url: `/api/staff/products/${fx.latte.id}/image`, headers: { cookie: cookieOf(owner), origin: 'http://localhost:3000', 'content-type': svg.type }, payload: svg.body });
    expect(svgRes.statusCode).toBe(400);
  });
});

describe('reports and exports', () => {
  it('sums paid orders by day, branch and product', async () => {
    const from = new Date(Date.now() - 86400_000).toISOString();
    const to = new Date(Date.now() + 86400_000).toISOString();
    const r = await owner.get(`/api/staff/reports/summary?from=${from}&to=${to}`);
    expect(r.status).toBe(200);
    const paid = await env.db.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { total: true }, _count: true });
    expect(r.body.totals.orders).toBe(paid._count);
    expect(r.body.totals.revenue).toBe(paid._sum.total ?? 0);
    expect(r.body.topProducts.length).toBeGreaterThan(0);
    expect((await barista.get(`/api/staff/reports/summary?from=${from}&to=${to}`)).status).toBe(403);
    const mine = await manager.get(`/api/staff/reports/summary?from=${from}&to=${to}`);
    expect(mine.body.range.branchId).toBe(fx.other.id);
  });

  it('exports invoices as CSV with formula injection neutralized', async () => {
    const o = await counterOrder();
    await env.db.order.update({ where: { id: o.id }, data: { customerName: '=HYPERLINK("http://evil")' } });
    await barista.post(`/api/staff/orders/${o.id}/mark-paid`);
    const from = new Date(Date.now() - 86400_000).toISOString();
    const to = new Date(Date.now() + 86400_000).toISOString();
    const r = await owner.get(`/api/staff/accounting/export.csv?from=${from}&to=${to}`);
    expect(r.status).toBe(200);
    expect(r.raw.headers['content-type']).toContain('text/csv');
    const text = r.raw.body as string;
    expect(text).toContain(`"TADA-${o.number}"`);
    expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it('writes an audit trail for staff actions', async () => {
    expect(await env.db.auditLog.count({ where: { action: 'order.status' } })).toBeGreaterThan(0);
    const r = await owner.get('/api/staff/audit');
    expect(r.body.logs.length).toBeGreaterThan(0);
  });
});
