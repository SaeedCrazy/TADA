// The bar screen and order management for staff, including a live Server-Sent Events stream.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ORDER_STATUSES, ORDER_TYPES, ACTIVE_STATUSES, orderStatusUpdateSchema } from '@tada/shared';
import type { Prisma } from '../../db.js';
import { notFound } from '../../lib/errors.js';
import { pageParams, parse } from '../../lib/util.js';
import { assertBranchAccess, branchScope, requireStaff } from '../../plugins/auth.js';
import { changeStatus, markPaid, markRefunded, orderInclude, serializeOrder } from '../orders/orders.service.js';
import { audit } from './audit.js';

const listQuery = z.object({
  branchId: z.uuid().optional(),
  status: z.union([z.enum(ORDER_STATUSES), z.literal('ACTIVE')]).optional(),
  type: z.enum(ORDER_TYPES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(40).optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

export default async function staffOrderRoutes(app: FastifyInstance) {
  const { ctx } = app;
  const { db, bus } = ctx;

  app.get('/orders', async (req) => {
    const staff = requireStaff(req);
    const q = parse(listQuery, req.query);
    const branchId = branchScope(staff, q.branchId);
    const { skip, take, page, pageSize } = pageParams(q, 200);
    const num = q.q && /^\d+$/.test(q.q) ? Number(q.q) : null;
    const where: Prisma.OrderWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(q.status === 'ACTIVE' ? { status: { in: [...ACTIVE_STATUSES] } } : q.status ? { status: q.status } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } } : {}),
      ...(q.q ? { OR: [...(num ? [{ number: num }] : []), { customerName: { contains: q.q, mode: 'insensitive' as const } }, { customerPhone: { contains: q.q } }] } : {}),
    };
    const [orders, total] = await Promise.all([
      db.order.findMany({ where, orderBy: { createdAt: q.status === 'ACTIVE' ? 'asc' : 'desc' }, skip, take, include: orderInclude }),
      db.order.count({ where }),
    ]);
    return { orders: orders.map((o) => serializeOrder(o, { staff: true })), page, pageSize, total };
  });

  app.get('/orders/stream', async (req, reply) => {
    const staff = requireStaff(req);
    const { branchId: requested } = parse(z.object({ branchId: z.uuid().optional() }), req.query);
    const branchId = branchScope(staff, requested);

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.write(`retry: 3000\n\n`);
    res.write(`event: ready\ndata: {}\n\n`);
    const off = bus.onOrder((e) => {
      if (branchId && e.branchId !== branchId) return;
      res.write(`event: order\ndata: ${JSON.stringify(e)}\n\n`);
    });
    const ping = setInterval(() => res.write(`: ping\n\n`), 25_000);
    req.raw.on('close', () => {
      clearInterval(ping);
      off();
    });
  });

  app.get('/orders/:id', async (req) => {
    const staff = requireStaff(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const order = await db.order.findUnique({
      where: { id },
      include: { ...orderInclude, payments: { select: { provider: true, amount: true, status: true, refId: true, cardPan: true, error: true, createdAt: true, verifiedAt: true } } },
    });
    if (!order) throw notFound('order_not_found');
    assertBranchAccess(staff, order.branchId);
    return { order: { ...serializeOrder(order, { staff: true }), payments: order.payments } };
  });

  app.post('/orders/:id/status', async (req) => {
    const staff = requireStaff(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { status, note } = parse(orderStatusUpdateSchema, req.body);
    const updated = await changeStatus(ctx, staff, id, status, note);
    await audit(db, { staffId: staff.id, action: 'order.status', entity: 'order', entityId: id, data: { status }, ip: req.ip });
    return { order: { id: updated.id, status: updated.status, paymentStatus: updated.paymentStatus } };
  });

  app.post('/orders/:id/mark-paid', async (req) => {
    const staff = requireStaff(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const updated = await markPaid(ctx, staff, id);
    await audit(db, { staffId: staff.id, action: 'order.mark_paid', entity: 'order', entityId: id, ip: req.ip });
    return { order: { id: updated.id, status: updated.status, paymentStatus: updated.paymentStatus } };
  });

  app.post('/orders/:id/refunded', async (req) => {
    const staff = requireStaff(req, ['OWNER', 'MANAGER']);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    await markRefunded(ctx, staff, id);
    await audit(db, { staffId: staff.id, action: 'order.refunded', entity: 'order', entityId: id, ip: req.ip });
    return { ok: true };
  });
}
