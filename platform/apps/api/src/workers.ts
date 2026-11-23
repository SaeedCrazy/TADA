// Background jobs inside the API process: payment timeouts, the accounting outbox and session cleanup.
import type { AppContext } from './context.js';
import { expireUnpaidOrders } from './modules/orders/orders.service.js';
import { runAccountingSync } from './modules/accounting/sync.js';

export function startWorkers(ctx: AppContext): () => void {
  const timers: NodeJS.Timeout[] = [];
  const every = (ms: number, name: string, fn: () => Promise<unknown>) => {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await fn();
      } catch (err) {
        ctx.log.error({ err, worker: name }, 'worker failed');
      } finally {
        running = false;
      }
    };
    timers.push(setInterval(tick, ms));
  };

  every(60_000, 'payment-timeout', async () => {
    const n = await expireUnpaidOrders(ctx);
    if (n) ctx.log.info({ cancelled: n }, 'expired unpaid orders');
  });
  every(30_000, 'accounting', () => runAccountingSync(ctx));
  every(3600_000, 'cleanup', async () => {
    const now = new Date();
    await ctx.db.session.deleteMany({ where: { expiresAt: { lt: now } } });
    await ctx.db.otpCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
  });

  return () => timers.forEach(clearInterval);
}
