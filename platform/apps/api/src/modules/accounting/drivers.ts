// Accounting integration. Every paid order becomes one sales invoice in the accounting system.
// The webhook driver posts a signed JSON invoice to any endpoint (a small adapter next to Holoo,
// Sepidar, Mahak, Hesabfa, ...). Orders can also be exported as CSV from the admin panel.
import type { Config } from '../../config.js';
import { hmac } from '../../lib/util.js';

export interface InvoiceLine {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number; // rial
  options: string[];
  lineTotal: number;
}

export interface InvoicePayload {
  event: 'invoice.created';
  invoiceNumber: string; // "TADA-1042"
  orderId: string;
  issuedAt: string; // ISO
  branch: { id: string; slug: string; name: string };
  customer: { name: string; phone: string | null };
  orderType: string;
  paymentMethod: string;
  paymentRef: string | null;
  currency: 'IRR';
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

export interface AccountingDriver {
  readonly name: string;
  pushInvoice(invoice: InvoicePayload, deliveryId: string): Promise<{ externalId: string | null }>;
}

export class WebhookAccounting implements AccountingDriver {
  readonly name = 'webhook';
  constructor(private url: string, private secret: string, private fetchImpl: typeof fetch = fetch) {}

  async pushInvoice(invoice: InvoicePayload, deliveryId: string) {
    const body = JSON.stringify(invoice);
    const ts = Math.floor(Date.now() / 1000).toString();
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tada-event': invoice.event,
        'x-tada-delivery': deliveryId,
        'x-tada-timestamp': ts,
        // Receivers recompute HMAC-SHA256(secret, `${timestamp}.${body}`) and compare in constant time.
        'x-tada-signature': `sha256=${hmac(this.secret, `${ts}.${body}`)}`,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`webhook responded ${res.status}`);
    const json = (await res.json().catch(() => null)) as { id?: unknown } | null;
    return { externalId: json && typeof json.id === 'string' ? json.id.slice(0, 100) : null };
  }
}

export function createAccounting(cfg: Config): AccountingDriver | null {
  if (cfg.ACCOUNTING_DRIVER === 'webhook') return new WebhookAccounting(cfg.ACCOUNTING_WEBHOOK_URL, cfg.ACCOUNTING_WEBHOOK_SECRET);
  return null;
}
