import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { formatToman } from '@tada/shared';
import { badRequest, notFound } from '../../lib/errors.js';
import { parse } from '../../lib/util.js';
import { completePayment, trackingUrl } from '../orders/orders.service.js';
import { MockGateway } from './drivers.js';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const callbackQuery = z.object({
  o: z.uuid(),
  Authority: z.string().min(4).max(80),
  Status: z.string().max(10),
});

export default async function paymentRoutes(app: FastifyInstance) {
  const { ctx } = app;
  const base = ctx.config.PUBLIC_WEB_URL.replace(/\/$/, '');

  // The gateway sends the customer back here. We verify server-to-server, then send them to the order page.
  app.get('/payments/callback', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const q = callbackQuery.safeParse(req.query);
    if (!q.success) return reply.redirect(`${base}/shop`, 302);
    try {
      const { paid, order } = await completePayment(ctx, q.data.o, q.data.Authority, q.data.Status);
      return reply.redirect(`${trackingUrl(ctx, order)}&paid=${paid ? 1 : 0}`, 302);
    } catch (err) {
      req.log.warn({ err }, 'payment callback failed');
      return reply.redirect(`${base}/shop?payment=error`, 302);
    }
  });

  if (!(ctx.payments instanceof MockGateway)) return;
  const mock = ctx.payments;

  const mockParams = z.object({ authority: z.string().regex(/^MOCK[A-Za-z0-9_-]{8,40}$/) });
  const mockQuery = z.object({ cb: z.string().max(400), amount: z.coerce.number().int().nonnegative().optional() });

  /** Only our own callback URL may be the target, so the mock page cannot become an open redirect. */
  function checkedCallback(cb: string) {
    if (!cb.startsWith(`${base}/api/payments/callback?`)) throw badRequest('bad_callback');
    return cb;
  }

  app.get('/payments/mock/:authority', async (req, reply) => {
    const { authority } = parse(mockParams, req.params);
    const { cb, amount } = parse(mockQuery, req.query);
    checkedCallback(cb);
    const q = new URLSearchParams({ cb });
    const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>درگاه آزمایشی</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#1C0727;color:#F6F0F8;font-family:Tahoma,sans-serif}
main{width:min(360px,90vw);border:1px solid #C3ADCF;border-radius:180px 180px 16px 16px;padding:72px 24px 28px;text-align:center}
h1{font-size:18px;margin:0 0 6px}p{color:#C3ADCF;margin:0 0 22px;font-size:14px}b{display:block;font-size:26px;margin-bottom:24px;color:#fff}
a{display:block;padding:14px;border-radius:12px;text-decoration:none;margin-top:10px;font-weight:bold}
.ok{background:#662482;color:#fff}.no{border:1px solid #926D8F;color:#F6F0F8}</style></head>
<body><main><h1>درگاه پرداخت آزمایشی</h1><p>فقط برای محیط توسعه؛ پولی جابه‌جا نمی‌شود.</p>
<b>${amount !== undefined ? formatToman(amount, 'fa') : ''}</b>
<a class="ok" id="approve" href="/api/payments/mock/${esc(authority)}/approve?${esc(q.toString())}">پرداخت موفق</a>
<a class="no" id="cancel" href="${esc(`${cb}&Authority=${authority}&Status=NOK`)}">انصراف</a></main></body></html>`;
    reply
      .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'")
      .type('text/html; charset=utf-8');
    return html;
  });

  app.get('/payments/mock/:authority/approve', async (req, reply) => {
    const { authority } = parse(mockParams, req.params);
    const { cb } = parse(mockQuery, req.query);
    const payment = await ctx.db.payment.findUnique({ where: { authority } });
    if (!payment) throw notFound('payment_not_found');
    mock.approve(authority);
    return reply.redirect(`${checkedCallback(cb)}&Authority=${authority}&Status=OK`, 302);
  });
}
