// Owner/manager tools: discount codes, customers, staff accounts, accounting sync, audit log, assistant review.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { STAFF_ROLES } from '@tada/shared';
import type { Prisma } from '../../db.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { pageParams, parse } from '../../lib/util.js';
import { requireStaff } from '../../plugins/auth.js';
import { hashPassword } from '../auth/auth.routes.js';
import { orderInclude } from '../orders/orders.service.js';
import { buildInvoice } from '../accounting/sync.js';
import { audit } from './audit.js';

const discountInput = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.number().int().min(1).max(1_000_000_000),
    maxDiscount: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
    minSubtotal: z.number().int().min(0).max(1_000_000_000).default(0),
    startsAt: z.coerce.date().nullable().default(null),
    endsAt: z.coerce.date().nullable().default(null),
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().default(null),
    perCustomerLimit: z.number().int().min(1).max(1000).nullable().default(null),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.type !== 'PERCENT' || d.value <= 100, { message: 'percent_over_100', path: ['value'] })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt < d.endsAt, { message: 'ends_before_start', path: ['endsAt'] });

const staffInput = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/),
  name: z.string().trim().min(1).max(60),
  role: z.enum(STAFF_ROLES),
  branchId: z.uuid().nullable().default(null),
  password: z.string().min(10).max(200).optional(),
  isActive: z.boolean().default(true),
});

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralize spreadsheet formulas (CSV injection) and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export default async function staffAdminRoutes(app: FastifyInstance) {
  const { ctx } = app;
  const { db } = ctx;

  // ------------------------------------------------------------ discounts (owner)

  app.get('/discounts', async (req) => {
    requireStaff(req, ['OWNER', 'MANAGER']);
    return { discounts: await db.discountCode.findMany({ orderBy: { createdAt: 'desc' } }) };
  });

  app.post('/discounts', async (req, reply) => {
    const staff = requireStaff(req, ['OWNER']);
    const d = parse(discountInput, req.body);
    const discount = await db.discountCode.create({ data: d });
    await audit(db, { staffId: staff.id, action: 'discount.create', entity: 'discount', entityId: discount.id, data: { code: d.code }, ip: req.ip });
    reply.status(201);
    return { discount };
  });

  app.put('/discounts/:id', async (req) => {
    const staff = requireStaff(req, ['OWNER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const d = parse(discountInput, req.body);
    const discount = await db.discountCode.update({ where: { id }, data: d });
    await audit(db, { staffId: staff.id, action: 'discount.update', entity: 'discount', entityId: id, ip: req.ip });
    return { discount };
  });

  app.delete('/discounts/:id', async (req) => {
    const staff = requireStaff(req, ['OWNER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const used = await db.discountRedemption.count({ where: { codeId: id } });
    if (used) await db.discountCode.update({ where: { id }, data: { isActive: false } });
    else await db.discountCode.delete({ where: { id } });
    await audit(db, { staffId: staff.id, action: 'discount.delete', entity: 'discount', entityId: id, ip: req.ip });
    return { ok: true, archived: used > 0 };
  });

  // ------------------------------------------------------------ customers

  app.get('/customers', async (req) => {
    requireStaff(req, ['OWNER', 'MANAGER']);
    const q = parse(z.object({ q: z.string().trim().max(40).optional(), page: z.coerce.number().optional() }), req.query);
    const { skip, take, page, pageSize } = pageParams(q);
    const where: Prisma.CustomerWhereInput = q.q ? { OR: [{ phone: { contains: q.q } }, { name: { contains: q.q, mode: 'insensitive' } }] } : {};
    const [rows, total] = await Promise.all([
      db.customer.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        select: { id: true, phone: true, name: true, createdAt: true, isBlocked: true, tasteConsent: true, _count: { select: { orders: true } } },
      }),
      db.customer.count({ where }),
    ]);
    return { customers: rows, page, pageSize, total };
  });

  app.get('/customers/:id', async (req) => {
    requireStaff(req, ['OWNER', 'MANAGER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const customer = await db.customer.findUnique({
      where: { id },
      include: { orders: { orderBy: { createdAt: 'desc' }, take: 50, include: orderInclude }, addresses: true },
    });
    if (!customer) throw notFound('customer_not_found');
    const spent = await db.order.aggregate({ where: { customerId: id, paymentStatus: 'PAID' }, _sum: { total: true } });
    return { customer: { ...customer, totalSpent: spent._sum.total ?? 0 } };
  });

  app.patch('/customers/:id', async (req) => {
    const staff = requireStaff(req, ['OWNER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { isBlocked } = parse(z.object({ isBlocked: z.boolean() }), req.body);
    await db.customer.update({ where: { id }, data: { isBlocked } });
    if (isBlocked) await db.session.deleteMany({ where: { customerId: id } });
    await audit(db, { staffId: staff.id, action: isBlocked ? 'customer.block' : 'customer.unblock', entity: 'customer', entityId: id, ip: req.ip });
    return { ok: true };
  });

  // ------------------------------------------------------------ staff accounts (owner)

  app.get('/staff-users', async (req) => {
    requireStaff(req, ['OWNER']);
    const staff = await db.staff.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, name: true, role: true, branchId: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    return { staff };
  });

  app.post('/staff-users', async (req, reply) => {
    const me = requireStaff(req, ['OWNER']);
    const d = parse(staffInput, req.body);
    if (!d.password) throw badRequest('password_required');
    if (d.role !== 'OWNER' && !d.branchId) throw badRequest('branch_required');
    const created = await db.staff.create({
      data: { username: d.username, name: d.name, role: d.role, branchId: d.role === 'OWNER' ? null : d.branchId, isActive: d.isActive, passwordHash: await hashPassword(d.password) },
      select: { id: true, username: true, name: true, role: true, branchId: true, isActive: true },
    });
    await audit(db, { staffId: me.id, action: 'staff.create', entity: 'staff', entityId: created.id, data: { role: d.role }, ip: req.ip });
    reply.status(201);
    return { staff: created };
  });

  app.put('/staff-users/:id', async (req) => {
    const me = requireStaff(req, ['OWNER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const d = parse(staffInput, req.body);
    if (d.role !== 'OWNER' && !d.branchId) throw badRequest('branch_required');
    if (id === me.id && (d.role !== 'OWNER' || !d.isActive)) throw conflict('cannot_demote_self');
    const updated = await db.staff.update({
      where: { id },
      data: {
        username: d.username, name: d.name, role: d.role, branchId: d.role === 'OWNER' ? null : d.branchId, isActive: d.isActive,
        ...(d.password ? { passwordHash: await hashPassword(d.password) } : {}),
      },
      select: { id: true, username: true, name: true, role: true, branchId: true, isActive: true },
    });
    // Any change to access ends the person's open sessions.
    await db.session.deleteMany({ where: { staffId: id, ...(id === me.id ? { NOT: { staffId: me.id } } : {}) } });
    await audit(db, { staffId: me.id, action: 'staff.update', entity: 'staff', entityId: id, data: { role: d.role, isActive: d.isActive, passwordChanged: Boolean(d.password) }, ip: req.ip });
    return { staff: updated };
  });

  app.post('/me/password', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req) => {
    const me = requireStaff(req);
    const { password } = parse(z.object({ password: z.string().min(10).max(200) }), req.body);
    await db.staff.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(password) } });
    await audit(db, { staffId: me.id, action: 'staff.password', entity: 'staff', entityId: me.id, ip: req.ip });
    return { ok: true };
  });

  // ------------------------------------------------------------ accounting

  app.get('/accounting/jobs', async (req) => {
    requireStaff(req, ['OWNER']);
    const q = parse(z.object({ status: z.enum(['PENDING', 'DONE', 'FAILED']).optional(), page: z.coerce.number().optional() }), req.query);
    const { skip, take, page, pageSize } = pageParams(q);
    const where = q.status ? { status: q.status } : {};
    const [jobs, total, counts] = await Promise.all([
      db.accountingJob.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { order: { select: { number: true, total: true } } } }),
      db.accountingJob.count({ where }),
      db.accountingJob.groupBy({ by: ['status'], _count: true }),
    ]);
    return { driver: ctx.accounting?.name ?? 'none', jobs, page, pageSize, total, counts };
  });

  app.post('/accounting/jobs/:id/retry', async (req) => {
    const staff = requireStaff(req, ['OWNER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    await db.accountingJob.update({ where: { id }, data: { status: 'PENDING', nextAttemptAt: new Date(), attempts: 0, lastError: null } });
    await audit(db, { staffId: staff.id, action: 'accounting.retry', entity: 'accounting_job', entityId: id, ip: req.ip });
    return { ok: true };
  });

  /** Paid orders as invoice lines, importable by any accounting package. */
  app.get('/accounting/export.csv', async (req, reply) => {
    const staff = requireStaff(req, ['OWNER']);
    const q = parse(z.object({ from: z.coerce.date(), to: z.coerce.date(), branchId: z.uuid().optional() }), req.query);
    if (q.to.getTime() - q.from.getTime() > 400 * 86400_000) throw badRequest('range_too_large');
    const orders = await db.order.findMany({
      where: { paymentStatus: 'PAID', paidAt: { gte: q.from, lt: q.to }, ...(q.branchId ? { branchId: q.branchId } : {}) },
      orderBy: { number: 'asc' },
      include: { items: true, branch: true, payments: { where: { status: 'PAID' } } },
    });
    const header = ['invoice', 'date', 'branch', 'customer', 'phone', 'type', 'payment', 'ref', 'sku', 'item', 'options', 'qty', 'unit_price_rial', 'line_total_rial', 'discount_rial', 'delivery_rial', 'order_total_rial'];
    const rows = [header.map(csvCell).join(',')];
    for (const o of orders) {
      const inv = buildInvoice(o);
      inv.lines.forEach((l, i) => {
        rows.push([
          inv.invoiceNumber, inv.issuedAt, inv.branch.name, inv.customer.name, inv.customer.phone, inv.orderType, inv.paymentMethod, inv.paymentRef,
          l.sku, l.name, l.options.join(' / '), l.quantity, l.unitPrice, l.lineTotal,
          i === 0 ? inv.discount : 0, i === 0 ? inv.deliveryFee : 0, i === 0 ? inv.total : 0,
        ].map(csvCell).join(','));
      });
    }
    await audit(db, { staffId: staff.id, action: 'accounting.export', entity: 'order', data: { from: q.from, to: q.to, count: orders.length }, ip: req.ip });
    reply
      .type('text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="tada-invoices-${q.from.toISOString().slice(0, 10)}.csv"`);
    return '﻿' + rows.join('\r\n');
  });

  // ------------------------------------------------------------ audit, sms, assistant review

  app.get('/audit', async (req) => {
    requireStaff(req, ['OWNER']);
    const q = parse(z.object({ page: z.coerce.number().optional(), entity: z.string().max(30).optional() }), req.query);
    const { skip, take, page, pageSize } = pageParams(q);
    const where = q.entity ? { entity: q.entity } : {};
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { staff: { select: { name: true, username: true } } } }),
      db.auditLog.count({ where }),
    ]);
    return { logs, page, pageSize, total };
  });

  app.get('/sms-log', async (req) => {
    requireStaff(req, ['OWNER']);
    const { skip, take, page, pageSize } = pageParams(req.query as Record<string, unknown>);
    const [logs, total] = await Promise.all([
      db.smsLog.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      db.smsLog.count(),
    ]);
    return { logs: logs.map((l) => ({ ...l, phone: `${l.phone.slice(0, 4)}***${l.phone.slice(7)}` })), page, pageSize, total };
  });

  app.get('/conversations', async (req) => {
    requireStaff(req, ['OWNER', 'MANAGER']);
    const { skip, take, page, pageSize } = pageParams(req.query as Record<string, unknown>);
    const [conversations, total] = await Promise.all([
      db.conversation.findMany({ skip, take, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { messages: true } }, messages: { take: 1, orderBy: { createdAt: 'asc' }, where: { role: 'user' } } } }),
      db.conversation.count(),
    ]);
    return {
      conversations: conversations.map((c) => ({
        id: c.id, mode: c.mode, locale: c.locale, createdAt: c.createdAt, updatedAt: c.updatedAt,
        messages: c._count.messages, firstMessage: c.messages[0]?.content.slice(0, 120) ?? null, customer: Boolean(c.customerId),
      })),
      page, pageSize, total,
    };
  });

  app.get('/conversations/:id', async (req) => {
    requireStaff(req, ['OWNER', 'MANAGER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const c = await db.conversation.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!c) throw notFound('conversation_not_found');
    return { conversation: { id: c.id, mode: c.mode, locale: c.locale, profile: c.profile, createdAt: c.createdAt, messages: c.messages } };
  });

  // ------------------------------------------------------------ settings

  app.get('/settings', async (req) => {
    requireStaff(req, ['OWNER']);
    const rows = await db.setting.findMany();
    return {
      settings: Object.fromEntries(rows.map((r) => [r.key, r.value])),
      integrations: {
        payments: ctx.payments.name,
        sms: ctx.sms.name,
        accounting: ctx.accounting?.name ?? 'none',
        assistant: ctx.llm ? 'llm' : 'guided',
      },
    };
  });

  app.put('/settings/:key', async (req) => {
    const staff = requireStaff(req, ['OWNER']);
    const { key } = parse(z.object({ key: z.enum(['assistantEnabled', 'announcementFa', 'announcementEn']) }), req.params);
    const value = parse(key === 'assistantEnabled' ? z.boolean() : z.string().trim().max(200), (req.body as { value?: unknown })?.value);
    await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await audit(db, { staffId: staff.id, action: 'setting.update', entity: 'setting', entityId: key, ip: req.ip });
    return { ok: true };
  });
}
