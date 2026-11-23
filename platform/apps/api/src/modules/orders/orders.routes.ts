import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createOrderSchema, quoteSchema } from '@tada/shared';
import { parse, pageParams } from '../../lib/util.js';
import { requireCustomer } from '../../plugins/auth.js';
import { priceCart, serializeQuote } from './pricing.js';
import { createOrder, getOrderForViewer, orderInclude, serializeOrder, startPayment } from './orders.service.js';

export default async function orderRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.post('/cart/quote', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const input = parse(quoteSchema, req.body);
    const quote = await priceCart(ctx.db, input, { customerId: req.customer?.id ?? null, strictDiscount: false });
    return { quote: serializeQuote(quote) };
  });

  app.post('/orders', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const input = parse(createOrderSchema, req.body);
    const { order, created } = await createOrder(ctx, input, req.customer);
    const payment = order.status === 'PENDING_PAYMENT' ? await startPayment(ctx, order) : null;
    reply.status(created ? 201 : 200);
    return { order: serializeOrder(order), payment };
  });

  app.get('/orders/:id', async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { t } = parse(z.object({ t: z.string().max(64).optional() }), req.query);
    const order = await getOrderForViewer(ctx.db, id, t, req.customer);
    return { order: serializeOrder(order) };
  });

  app.post('/orders/:id/pay', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }), req.params);
    const { t } = parse(z.object({ t: z.string().max(64).optional() }), req.query);
    const order = await getOrderForViewer(ctx.db, id, t, req.customer);
    return { payment: await startPayment(ctx, order) };
  });

  app.get('/me/orders', async (req) => {
    const customer = requireCustomer(req);
    const { skip, take, page, pageSize } = pageParams(req.query as Record<string, unknown>, 50);
    const [orders, total] = await Promise.all([
      ctx.db.order.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'desc' }, skip, take, include: orderInclude }),
      ctx.db.order.count({ where: { customerId: customer.id } }),
    ]);
    return { orders: orders.map((o) => serializeOrder(o)), page, pageSize, total };
  });
}
