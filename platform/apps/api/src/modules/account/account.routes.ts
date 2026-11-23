import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addressSchema, profileUpdateSchema } from '@tada/shared';
import { Prisma } from '../../db.js';
import { conflict, notFound } from '../../lib/errors.js';
import { parse } from '../../lib/util.js';
import { requireCustomer } from '../../plugins/auth.js';

const MAX_ADDRESSES = 10;

export default async function accountRoutes(app: FastifyInstance) {
  const { db } = app.ctx;

  app.patch('/me', async (req) => {
    const c = requireCustomer(req);
    const data = parse(profileUpdateSchema, req.body);
    const updated = await db.customer.update({
      where: { id: c.id },
      data: {
        ...data,
        // Withdrawing consent also forgets the stored taste profile.
        ...(data.tasteConsent === false ? { tasteProfile: Prisma.DbNull } : {}),
      },
      select: { id: true, phone: true, name: true, locale: true, tasteConsent: true },
    });
    return { customer: updated };
  });

  app.get('/me/addresses', async (req) => {
    const c = requireCustomer(req);
    return { addresses: await db.address.findMany({ where: { customerId: c.id }, orderBy: { createdAt: 'desc' } }) };
  });

  app.post('/me/addresses', async (req, reply) => {
    const c = requireCustomer(req);
    const data = parse(addressSchema, req.body);
    if ((await db.address.count({ where: { customerId: c.id } })) >= MAX_ADDRESSES) throw conflict('too_many_addresses');
    reply.status(201);
    return { address: await db.address.create({ data: { ...data, customerId: c.id } }) };
  });

  app.delete('/me/addresses/:id', async (req) => {
    const c = requireCustomer(req);
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const r = await db.address.deleteMany({ where: { id, customerId: c.id } });
    if (r.count === 0) throw notFound('address_not_found');
    return { ok: true };
  });

  app.delete('/me/taste', async (req) => {
    const c = requireCustomer(req);
    await db.customer.update({ where: { id: c.id }, data: { tasteProfile: Prisma.DbNull } });
    return { ok: true };
  });
}
