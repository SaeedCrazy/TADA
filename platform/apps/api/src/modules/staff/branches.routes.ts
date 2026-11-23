// Branches (owner) and their tables with QR codes (owner and branch managers).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import QRCode from 'qrcode';
import { isValidHours } from '@tada/shared';
import { notFound } from '../../lib/errors.js';
import { parse, randomToken, slugify } from '../../lib/util.js';
import { assertBranchAccess, requireStaff } from '../../plugins/auth.js';
import { serializeBranch } from '../catalog/catalog.service.js';
import { audit } from './audit.js';

const money = z.number().int().min(0).max(1_000_000_000);
const branchInput = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60).optional(),
  nameFa: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  addressFa: z.string().trim().min(3).max(300),
  addressEn: z.string().trim().min(3).max(300),
  phone: z.string().trim().max(20).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  hours: z.custom<[string, string][]>((v) => isValidHours(v), { message: 'invalid_hours' }),
  isActive: z.boolean().default(true),
  acceptsOrders: z.boolean().default(true),
  deliveryEnabled: z.boolean().default(false),
  deliveryBaseFee: money.default(300000),
  deliveryPerKm: money.default(100000),
  deliveryMaxKm: z.number().min(0.5).max(30).default(5),
  deliveryMinOrder: money.default(0),
  deliveryFreeAbove: money.default(0),
  sort: z.number().int().min(0).max(1000).default(0),
});

export default async function staffBranchRoutes(app: FastifyInstance) {
  const { db, config } = app.ctx;
  const base = config.PUBLIC_WEB_URL.replace(/\/$/, '');

  app.get('/branches', async (req) => {
    const staff = requireStaff(req);
    const branches = await db.branch.findMany({
      where: staff.role === 'OWNER' ? {} : { id: staff.branchId ?? '00000000-0000-0000-0000-000000000000' },
      orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }],
    });
    return { branches: branches.map((b) => ({ ...serializeBranch(b), isActive: b.isActive, deliveryEnabledRaw: b.deliveryEnabled })) };
  });

  app.post('/branches', async (req, reply) => {
    const staff = requireStaff(req, ['OWNER']);
    const d = parse(branchInput, req.body);
    const branch = await db.branch.create({ data: { ...d, slug: d.slug ?? (slugify(d.nameEn) || randomToken(4).toLowerCase()) } });
    const products = await db.product.findMany({ select: { id: true } });
    await db.branchProduct.createMany({ data: products.map((p) => ({ branchId: branch.id, productId: p.id })), skipDuplicates: true });
    await audit(db, { staffId: staff.id, action: 'branch.create', entity: 'branch', entityId: branch.id, ip: req.ip });
    reply.status(201);
    return { branch: serializeBranch(branch) };
  });

  app.put('/branches/:id', async (req) => {
    const staff = requireStaff(req, ['OWNER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { slug, ...d } = parse(branchInput, req.body);
    const branch = await db.branch.update({ where: { id }, data: { ...d, ...(slug ? { slug } : {}) } });
    await audit(db, { staffId: staff.id, action: 'branch.update', entity: 'branch', entityId: id, ip: req.ip });
    return { branch: serializeBranch(branch) };
  });

  // Managers can pause online ordering for their own branch when the bar is overwhelmed.
  app.patch('/branches/:id/ordering', async (req) => {
    const staff = requireStaff(req, ['OWNER', 'MANAGER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    assertBranchAccess(staff, id);
    const { acceptsOrders } = parse(z.object({ acceptsOrders: z.boolean() }), req.body);
    const branch = await db.branch.update({ where: { id }, data: { acceptsOrders } });
    await audit(db, { staffId: staff.id, action: 'branch.ordering', entity: 'branch', entityId: id, data: { acceptsOrders }, ip: req.ip });
    return { branch: serializeBranch(branch) };
  });

  // ------------------------------------------------------------ tables

  app.get('/branches/:id/tables', async (req) => {
    const staff = requireStaff(req, ['OWNER', 'MANAGER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    assertBranchAccess(staff, id);
    const tables = await db.diningTable.findMany({ where: { branchId: id }, orderBy: { number: 'asc' } });
    return { tables: tables.map((t) => ({ ...t, url: `${base}/t/${t.token}` })) };
  });

  app.post('/branches/:id/tables', async (req, reply) => {
    const staff = requireStaff(req, ['OWNER', 'MANAGER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    assertBranchAccess(staff, id);
    const d = parse(z.object({ number: z.number().int().min(1).max(999), label: z.string().trim().max(40).optional() }), req.body);
    const table = await db.diningTable.create({ data: { branchId: id, number: d.number, label: d.label ?? null, token: randomToken(12) } });
    await audit(db, { staffId: staff.id, action: 'table.create', entity: 'table', entityId: table.id, ip: req.ip });
    reply.status(201);
    return { table: { ...table, url: `${base}/t/${table.token}` } };
  });

  async function loadTable(staffReq: Parameters<typeof requireStaff>[0], id: string) {
    const staff = requireStaff(staffReq, ['OWNER', 'MANAGER']);
    const table = await db.diningTable.findUnique({ where: { id } });
    if (!table) throw notFound('table_not_found');
    assertBranchAccess(staff, table.branchId);
    return { staff, table };
  }

  app.patch('/tables/:id', async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { staff } = await loadTable(req, id);
    const d = parse(z.object({ label: z.string().trim().max(40).nullable().optional(), isActive: z.boolean().optional() }), req.body);
    const table = await db.diningTable.update({ where: { id }, data: d });
    await audit(db, { staffId: staff.id, action: 'table.update', entity: 'table', entityId: id, ip: req.ip });
    return { table };
  });

  /** A new token invalidates the old printed QR (e.g. if a code was copied and abused). */
  app.post('/tables/:id/rotate', async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { staff } = await loadTable(req, id);
    const table = await db.diningTable.update({ where: { id }, data: { token: randomToken(12) } });
    await audit(db, { staffId: staff.id, action: 'table.rotate', entity: 'table', entityId: id, ip: req.ip });
    return { table: { ...table, url: `${base}/t/${table.token}` } };
  });

  app.delete('/tables/:id', async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { staff } = await loadTable(req, id);
    const used = await db.order.count({ where: { tableId: id } });
    if (used) await db.diningTable.update({ where: { id }, data: { isActive: false } });
    else await db.diningTable.delete({ where: { id } });
    await audit(db, { staffId: staff.id, action: 'table.delete', entity: 'table', entityId: id, ip: req.ip });
    return { ok: true, archived: used > 0 };
  });

  app.get('/tables/:id/qr.svg', async (req, reply) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { table } = await loadTable(req, id);
    const svg = await QRCode.toString(`${base}/t/${table.token}`, {
      type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#35084CFF', light: '#FFFFFF00' },
    });
    reply.type('image/svg+xml').header('cache-control', 'private, max-age=60');
    return svg;
  });
}
