import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { latLngSchema } from '@tada/shared';
import { notFound } from '../../lib/errors.js';
import { parse } from '../../lib/util.js';
import { loadMenu, loadProductBySlug, serializeBranch } from '../catalog/catalog.service.js';
import { findDeliveryBranch } from '../orders/pricing.js';

const branchQuery = z.object({ branch: z.string().max(60).optional() });

export default async function publicRoutes(app: FastifyInstance) {
  const { db } = app.ctx;

  async function resolveBranchId(ref?: string) {
    if (!ref) return undefined;
    const isUuid = z.uuid().safeParse(ref).success;
    const b = await db.branch.findFirst({ where: { isActive: true, ...(isUuid ? { id: ref } : { slug: ref }) }, select: { id: true } });
    if (!b) throw notFound('branch_not_found');
    return b.id;
  }

  app.get('/branches', async (_req, reply) => {
    const branches = await db.branch.findMany({ where: { isActive: true }, orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }] });
    reply.header('cache-control', 'public, max-age=30');
    return { branches: branches.map((b) => serializeBranch(b)) };
  });

  app.get('/menu', async (req, reply) => {
    const { branch } = parse(branchQuery, req.query);
    const branchId = await resolveBranchId(branch);
    reply.header('cache-control', 'public, max-age=15');
    return { branchId: branchId ?? null, ...(await loadMenu(db, branchId)) };
  });

  app.get('/products/:slug', async (req) => {
    const { slug } = parse(z.object({ slug: z.string().min(1).max(80) }), req.params);
    const { branch } = parse(branchQuery, req.query);
    const product = await loadProductBySlug(db, slug, await resolveBranchId(branch));
    if (!product) throw notFound('product_not_found');
    return { product };
  });

  app.get('/tables/:token', async (req) => {
    const { token } = parse(z.object({ token: z.string().min(8).max(64) }), req.params);
    const table = await db.diningTable.findUnique({ where: { token }, include: { branch: true } });
    if (!table || !table.isActive || !table.branch.isActive) throw notFound('table_not_found');
    return { table: { number: table.number, label: table.label }, branch: serializeBranch(table.branch) };
  });

  app.post('/delivery/check', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const loc = parse(latLngSchema, req.body);
    const r = await findDeliveryBranch(db, loc);
    if (!r) return { available: false };
    return { available: true, branch: serializeBranch(r.branch), distanceKm: r.distanceKm, fee: r.fee, minOrder: r.branch.deliveryMinOrder, freeAbove: r.branch.deliveryFreeAbove };
  });
}
