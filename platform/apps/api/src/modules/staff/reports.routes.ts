// Sales reports. Days are counted in Tehran time; revenue counts paid, non-refunded orders.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '../../db.js';
import { badRequest } from '../../lib/errors.js';
import { parse } from '../../lib/util.js';
import { branchScope, requireStaff } from '../../plugins/auth.js';

const query = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  branchId: z.uuid().optional(),
});

export default async function staffReportRoutes(app: FastifyInstance) {
  const { db } = app.ctx;

  app.get('/reports/summary', async (req) => {
    const staff = requireStaff(req, ['OWNER', 'MANAGER']);
    const q = parse(query, req.query);
    if (q.to <= q.from) throw badRequest('bad_range');
    if (q.to.getTime() - q.from.getTime() > 400 * 86400_000) throw badRequest('range_too_large');
    const branchId = branchScope(staff, q.branchId);
    const branchSql = branchId ? Prisma.sql`AND o."branchId" = ${branchId}::uuid` : Prisma.empty;
    const range = Prisma.sql`o."createdAt" >= ${q.from} AND o."createdAt" < ${q.to}`;
    const paid = Prisma.sql`o."paymentStatus" = 'PAID'`;

    const [totals, byDay, byBranch, byType, byPayment, topProducts, byHour] = await Promise.all([
      db.$queryRaw<{ orders: bigint; revenue: bigint | null; discounts: bigint | null; delivery: bigint | null; cancelled: bigint }[]>`
        SELECT
          COUNT(*) FILTER (WHERE ${paid}) AS orders,
          SUM(o.total) FILTER (WHERE ${paid}) AS revenue,
          SUM(o."discountTotal") FILTER (WHERE ${paid}) AS discounts,
          SUM(o."deliveryFee") FILTER (WHERE ${paid}) AS delivery,
          COUNT(*) FILTER (WHERE o.status = 'CANCELLED') AS cancelled
        FROM "Order" o WHERE ${range} ${branchSql}`,
      db.$queryRaw<{ day: string; orders: bigint; revenue: bigint }[]>`
        SELECT to_char(date_trunc('day', o."createdAt" AT TIME ZONE 'Asia/Tehran'), 'YYYY-MM-DD') AS day,
               COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS revenue
        FROM "Order" o WHERE ${range} AND ${paid} ${branchSql}
        GROUP BY 1 ORDER BY 1`,
      db.$queryRaw<{ branchId: string; nameFa: string; orders: bigint; revenue: bigint }[]>`
        SELECT b.id AS "branchId", b."nameFa", COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS revenue
        FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
        WHERE ${range} AND ${paid} ${branchSql}
        GROUP BY b.id, b."nameFa" ORDER BY revenue DESC`,
      db.$queryRaw<{ type: string; orders: bigint; revenue: bigint }[]>`
        SELECT o.type::text AS type, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS revenue
        FROM "Order" o WHERE ${range} AND ${paid} ${branchSql} GROUP BY 1 ORDER BY 2 DESC`,
      db.$queryRaw<{ method: string; orders: bigint; revenue: bigint }[]>`
        SELECT o."paymentMethod"::text AS method, COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS revenue
        FROM "Order" o WHERE ${range} AND ${paid} ${branchSql} GROUP BY 1 ORDER BY 2 DESC`,
      db.$queryRaw<{ productId: string; nameFa: string; quantity: bigint; revenue: bigint }[]>`
        SELECT i."productId", MAX(i."nameFa") AS "nameFa", SUM(i.quantity) AS quantity, SUM(i."lineTotal") AS revenue
        FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
        WHERE ${range} AND ${paid} ${branchSql}
        GROUP BY i."productId" ORDER BY quantity DESC LIMIT 10`,
      db.$queryRaw<{ hour: number; orders: bigint }[]>`
        SELECT EXTRACT(HOUR FROM o."createdAt" AT TIME ZONE 'Asia/Tehran')::int AS hour, COUNT(*) AS orders
        FROM "Order" o WHERE ${range} AND ${paid} ${branchSql} GROUP BY 1 ORDER BY 1`,
    ]);

    const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
    const t = totals[0]!;
    const orders = n(t.orders);
    return {
      range: { from: q.from, to: q.to, branchId: branchId ?? null },
      totals: {
        orders,
        revenue: n(t.revenue),
        averageOrder: orders ? Math.round(n(t.revenue) / orders) : 0,
        discounts: n(t.discounts),
        delivery: n(t.delivery),
        cancelled: n(t.cancelled),
      },
      byDay: byDay.map((r) => ({ day: r.day, orders: n(r.orders), revenue: n(r.revenue) })),
      byBranch: byBranch.map((r) => ({ branchId: r.branchId, nameFa: r.nameFa, orders: n(r.orders), revenue: n(r.revenue) })),
      byType: byType.map((r) => ({ type: r.type, orders: n(r.orders), revenue: n(r.revenue) })),
      byPayment: byPayment.map((r) => ({ method: r.method, orders: n(r.orders), revenue: n(r.revenue) })),
      topProducts: topProducts.map((r) => ({ productId: r.productId, nameFa: r.nameFa, quantity: n(r.quantity), revenue: n(r.revenue) })),
      byHour: byHour.map((r) => ({ hour: Number(r.hour), orders: n(r.orders) })),
    };
  });

  /** Live counters for the dashboard header. */
  app.get('/reports/today', async (req) => {
    const staff = requireStaff(req);
    const branchId = branchScope(staff, parse(z.object({ branchId: z.uuid().optional() }), req.query).branchId);
    // Iran has used UTC+03:30 all year since 2022 (no daylight saving).
    const IRST = 210 * 60_000;
    const DAY = 86400_000;
    const from = new Date(Math.floor((Date.now() + IRST) / DAY) * DAY - IRST);
    const where = { createdAt: { gte: from }, ...(branchId ? { branchId } : {}) };
    const [paid, active, waiting] = await Promise.all([
      db.order.aggregate({ where: { ...where, paymentStatus: 'PAID' }, _sum: { total: true }, _count: true }),
      db.order.count({ where: { ...where, status: { in: ['PLACED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] } } }),
      db.order.count({ where: { ...where, status: 'PLACED' } }),
    ]);
    return { since: from, orders: paid._count, revenue: paid._sum.total ?? 0, active, waiting };
  });
}
