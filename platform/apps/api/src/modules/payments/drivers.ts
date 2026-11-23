// Payment gateways. The order total is always taken from our database, never from the callback,
// and a payment only counts once the gateway's verify call confirms the exact amount.
import type { Config } from '../../config.js';
import { randomToken } from '../../lib/util.js';

export interface PaymentRequest {
  amount: number; // rial
  description: string;
  callbackUrl: string;
  mobile?: string | null;
  orderId: string;
}

export interface PaymentStart {
  authority: string;
  redirectUrl: string;
}

export type VerifyResult =
  | { ok: true; refId: string; cardPan?: string; raw: unknown }
  | { ok: false; error: string; raw: unknown };

export interface PaymentDriver {
  readonly name: string;
  request(p: PaymentRequest): Promise<PaymentStart>;
  verify(authority: string, amount: number): Promise<VerifyResult>;
}

/** Development/test gateway: a local page lets you approve or cancel. Refused in production by config. */
export class MockGateway implements PaymentDriver {
  readonly name = 'mock';
  /** authority -> amount, so verify checks the amount like a real gateway. */
  private pending = new Map<string, number>();
  private approved = new Set<string>();
  constructor(private apiBase: string) {}

  async request(p: PaymentRequest): Promise<PaymentStart> {
    const authority = `MOCK${randomToken(12)}`;
    this.pending.set(authority, p.amount);
    const q = new URLSearchParams({ cb: p.callbackUrl, amount: String(p.amount) });
    return { authority, redirectUrl: `${this.apiBase}/api/payments/mock/${authority}?${q}` };
  }

  approve(authority: string) {
    if (this.pending.has(authority)) this.approved.add(authority);
  }

  async verify(authority: string, amount: number): Promise<VerifyResult> {
    const expected = this.pending.get(authority);
    if (expected === undefined) return { ok: false, error: 'unknown_authority', raw: null };
    if (expected !== amount) return { ok: false, error: 'amount_mismatch', raw: { expected, amount } };
    if (!this.approved.has(authority)) return { ok: false, error: 'not_paid', raw: null };
    return { ok: true, refId: `R${authority.slice(4, 12)}`, cardPan: '6037********1234', raw: { mock: true } };
  }
}

interface ZarinpalResponse<T> {
  data: T | [] | null;
  errors: { code?: number; message?: string } | [] | null;
}

/** Zarinpal REST v4. Amounts are sent in rials (currency IRR). */
export class ZarinpalGateway implements PaymentDriver {
  readonly name = 'zarinpal';
  private base: string;
  constructor(private merchantId: string, sandbox: boolean, private fetchImpl: typeof fetch = fetch) {
    this.base = sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
  }

  private async post<T>(path: string, body: unknown): Promise<ZarinpalResponse<T>> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    return (await res.json()) as ZarinpalResponse<T>;
  }

  async request(p: PaymentRequest): Promise<PaymentStart> {
    const r = await this.post<{ code: number; authority: string }>('/pg/v4/payment/request.json', {
      merchant_id: this.merchantId,
      amount: p.amount,
      currency: 'IRR',
      description: p.description,
      callback_url: p.callbackUrl,
      metadata: { ...(p.mobile ? { mobile: p.mobile } : {}), order_id: p.orderId },
    });
    const data = r.data && !Array.isArray(r.data) ? r.data : null;
    if (!data || data.code !== 100 || !data.authority) {
      const e = r.errors && !Array.isArray(r.errors) ? r.errors : null;
      throw new Error(`zarinpal request failed: ${e?.code ?? data?.code ?? 'unknown'} ${e?.message ?? ''}`.trim());
    }
    return { authority: data.authority, redirectUrl: `${this.base}/pg/StartPay/${data.authority}` };
  }

  async verify(authority: string, amount: number): Promise<VerifyResult> {
    const r = await this.post<{ code: number; ref_id: number; card_pan?: string }>('/pg/v4/payment/verify.json', {
      merchant_id: this.merchantId,
      amount,
      authority,
    });
    const data = r.data && !Array.isArray(r.data) ? r.data : null;
    // 100 = verified now, 101 = already verified earlier (idempotent).
    if (data && (data.code === 100 || data.code === 101)) {
      return { ok: true, refId: String(data.ref_id), cardPan: data.card_pan, raw: r };
    }
    const e = r.errors && !Array.isArray(r.errors) ? r.errors : null;
    return { ok: false, error: `zarinpal_${e?.code ?? data?.code ?? 'unknown'}`, raw: r };
  }
}

export function createPayments(cfg: Config, apiBase: string): PaymentDriver {
  return cfg.PAYMENT_DRIVER === 'zarinpal'
    ? new ZarinpalGateway(cfg.ZARINPAL_MERCHANT_ID, cfg.ZARINPAL_SANDBOX)
    : new MockGateway(apiBase);
}
