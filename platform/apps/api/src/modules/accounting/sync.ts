// The accounting outbox worker: claims due jobs with SKIP LOCKED (safe with several API processes),
// pushes the invoice, and retries with exponential backoff.
import type { AppContext } from '../../context.js';
import type { Prisma } from '../../db.js';
import type { InvoicePayload } from './drivers.js';

const MAX_ATTEMPTS = 10;

type OrderForInvoice = Prisma.OrderGetPayload<{ include: { items: true; branch: true; payments: true } }>;

export function buildInvoice(o: OrderForInvoice): InvoicePayload {
  const paid = o.payments.find((p) => p.status === 'PAID');
  return {
    event: 'invoice.created',
    invoiceNumber: `TADA-${o.number}`,
    orderId: o.id,
    issuedAt: (o.paidAt ?? o.createdAt).toISOString(),
    branch: { id: o.branch.id, slug: o.branch.slug, name: o.branch.nameFa },
    customer: { name: o.customerName, phone: o.customerPhone },
    orderType: o.type,
    paymentMethod: o.paymentMethod,
    paymentRef: paid?.refId ?? null,
    currency: 'IRR',
    lines: o.items.map((i) => ({
      sku: i.productId,
      name: i.nameFa,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      options: (Array.isArray(i.options) ? (i.options as { nameFa?: string }[]) : []).map((x) => x.nameFa ?? '').filter(Boolean),
      lineTotal: i.lineTotal,
    })),
    subtotal: o.subtotal,
    discount: o.discountTotal,
    deliveryFee: o.deliveryFee,
    total: o.total,
  };
}

export const backoffMs = (attempt: number) => Math.min(2 ** attempt * 60_000, 6 * 3600_000);

export async function runAccountingSync(ctx: AppContext, batch = 10): Promise<{ done: number; failed: number }> {
  if (!ctx.accounting) return { done: 0, failed: 0 };
  const { db } = ctx;
  // Lease due jobs for 5 minutes so another worker does not pick them up meanwhile.
  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "AccountingJob" SET "nextAttemptAt" = now() + interval '5 minutes'
    WHERE id IN (
      SELECT id FROM "AccountingJob"
      WHERE status = 'PENDING' AND "nextAttemptAt" <= now()
      ORDER BY "nextAttemptAt" LIMIT ${batch}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  let done = 0;
  let failed = 0;
  for (const { id } of claimed) {
    const job = await db.accountingJob.findUniqueOrThrow({
      where: { id },
      include: { order: { include: { items: true, branch: true, payments: true } } },
    });
    try {
      const { externalId } = await ctx.accounting.pushInvoice(buildInvoice(job.order), job.id);
      await db.accountingJob.update({ where: { id }, data: { status: 'DONE', externalId, lastError: null, attempts: { increment: 1 } } });
      done++;
    } catch (err) {
      const attempts = job.attempts + 1;
      await db.accountingJob.update({
        where: { id },
        data: {
          attempts,
          lastError: String(err).slice(0, 500),
          status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
          nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
        },
      });
      ctx.log.warn({ err, jobId: id, attempts }, 'accounting push failed');
      failed++;
    }
  }
  return { done, failed };
}
