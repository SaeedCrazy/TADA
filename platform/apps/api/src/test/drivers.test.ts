import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { ZarinpalGateway, MockGateway } from '../modules/payments/drivers.js';
import { KavenegarSms } from '../modules/notify/sms.js';
import { WebhookAccounting, type InvoicePayload } from '../modules/accounting/drivers.js';
import { OpenAiCompatibleClient } from '../modules/assistant/llm.js';
import { backoffMs } from '../modules/accounting/sync.js';
import { loadConfig } from '../config.js';

const fakeFetch = (handler: (url: string, init: RequestInit) => unknown, status = 200) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(handler(String(url), init ?? {})), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fn, calls };
};

describe('Zarinpal', () => {
  it('requests a payment in rials and builds the StartPay URL', async () => {
    const f = fakeFetch(() => ({ data: { code: 100, authority: 'A0000000000000000000000000000123' }, errors: [] }));
    const zp = new ZarinpalGateway('merchant-uuid', true, f.fn);
    const r = await zp.request({ amount: 1_250_000, description: 'x', callbackUrl: 'https://tada.ir/api/payments/callback?o=1', mobile: '09121234567', orderId: 'o1' });
    expect(r.redirectUrl).toBe('https://sandbox.zarinpal.com/pg/StartPay/A0000000000000000000000000000123');
    expect(f.calls[0]!.url).toBe('https://sandbox.zarinpal.com/pg/v4/payment/request.json');
    expect(JSON.parse(String(f.calls[0]!.init.body))).toMatchObject({ merchant_id: 'merchant-uuid', amount: 1_250_000, currency: 'IRR', metadata: { mobile: '09121234567' } });
  });

  it('treats 100 and 101 as verified and anything else as a failure', async () => {
    for (const code of [100, 101]) {
      const zp = new ZarinpalGateway('m', false, fakeFetch(() => ({ data: { code, ref_id: 987654, card_pan: '6037**1234' }, errors: [] })).fn);
      expect(await zp.verify('A1', 1000)).toMatchObject({ ok: true, refId: '987654' });
    }
    const bad = new ZarinpalGateway('m', false, fakeFetch(() => ({ data: [], errors: { code: -51, message: 'failed' } })).fn);
    expect(await bad.verify('A1', 1000)).toMatchObject({ ok: false, error: 'zarinpal_-51' });
  });

  it('throws when the request is refused', async () => {
    const zp = new ZarinpalGateway('m', false, fakeFetch(() => ({ data: [], errors: { code: -9, message: 'validation' } })).fn);
    await expect(zp.request({ amount: 1, description: 'x', callbackUrl: 'u', orderId: 'o' })).rejects.toThrow('-9');
  });
});

describe('mock gateway', () => {
  it('verifies only approved payments with the exact amount', async () => {
    const g = new MockGateway('http://localhost:3000');
    const { authority } = await g.request({ amount: 500, description: 'x', callbackUrl: 'cb', orderId: 'o' });
    expect((await g.verify(authority, 500)).ok).toBe(false);
    g.approve(authority);
    expect((await g.verify(authority, 499)).ok).toBe(false);
    expect((await g.verify(authority, 500)).ok).toBe(true);
  });
});

describe('Kavenegar', () => {
  it('sends OTPs through a template and fails loudly on errors', async () => {
    const ok = fakeFetch(() => ({ return: { status: 200, message: 'ok' } }));
    const sms = new KavenegarSms({ KAVENEGAR_API_KEY: 'KEY', KAVENEGAR_OTP_TEMPLATE: 'tada-otp', KAVENEGAR_SENDER: '1000' }, ok.fn);
    await sms.sendOtp('09121234567', '12345');
    expect(ok.calls[0]!.url).toBe('https://api.kavenegar.com/v1/KEY/verify/lookup.json');
    expect(String(ok.calls[0]!.init.body)).toBe('receptor=09121234567&token=12345&template=tada-otp');
    const bad = new KavenegarSms({ KAVENEGAR_API_KEY: 'KEY', KAVENEGAR_OTP_TEMPLATE: 't', KAVENEGAR_SENDER: '' }, fakeFetch(() => ({ return: { status: 418, message: 'no credit' } })).fn);
    await expect(bad.sendOtp('09121234567', '1')).rejects.toThrow('418');
  });
});

describe('accounting webhook', () => {
  it('signs the body so the receiver can verify it', async () => {
    const secret = 'a-very-long-shared-secret';
    let verified = false;
    let delivery = '';
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const ts = String(req.headers['x-tada-timestamp']);
        const expected = 'sha256=' + createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
        const got = String(req.headers['x-tada-signature']);
        verified = got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
        delivery = String(req.headers['x-tada-delivery']);
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id: 'INV-77' }));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    try {
      const hook = new WebhookAccounting(`http://127.0.0.1:${port}/invoices`, secret);
      const invoice = { event: 'invoice.created', invoiceNumber: 'TADA-1', total: 1000 } as InvoicePayload;
      expect(await hook.pushInvoice(invoice, 'job-1')).toEqual({ externalId: 'INV-77' });
      expect(verified).toBe(true);
      expect(delivery).toBe('job-1');
    } finally {
      server.close();
    }
  });

  it('backs off exponentially up to six hours', () => {
    expect(backoffMs(1)).toBe(120_000);
    expect(backoffMs(3)).toBe(480_000);
    expect(backoffMs(20)).toBe(6 * 3600_000);
  });
});

describe('LLM client', () => {
  it('speaks the OpenAI-compatible tool-calling format', async () => {
    const f = fakeFetch(() => ({ choices: [{ message: { content: null, tool_calls: [{ id: 't1', function: { name: 'get_menu', arguments: '{}' } }] } }] }));
    const llm = new OpenAiCompatibleClient('http://llm.local/v1/', 'sk-x', 'qwen', 5000, f.fn);
    const r = await llm.chat([{ role: 'user', content: 'hi' }], [{ name: 'get_menu', description: 'd', parameters: { type: 'object' } }]);
    expect(r.toolCalls).toEqual([{ id: 't1', name: 'get_menu', arguments: '{}' }]);
    expect(f.calls[0]!.url).toBe('http://llm.local/v1/chat/completions');
    expect((f.calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer sk-x');
  });
});

describe('configuration', () => {
  const base = { DATABASE_URL: 'postgresql://x', SESSION_SECRET: 'x'.repeat(40), PUBLIC_WEB_URL: 'https://tada.ir' };
  it('refuses mock payments and weak secrets in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow('mock payments are disabled');
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', PAYMENT_DRIVER: 'zarinpal', ZARINPAL_MERCHANT_ID: 'm', SESSION_SECRET: 'dev-only-' + 'x'.repeat(40) })).toThrow('real secret');
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', PAYMENT_DRIVER: 'zarinpal', ZARINPAL_MERCHANT_ID: 'm', PUBLIC_WEB_URL: 'http://tada.ir' })).toThrow('https');
  });
  it('ignores the test OTP code and rate-limit switch in production', () => {
    const c = loadConfig({ ...base, NODE_ENV: 'production', PAYMENT_DRIVER: 'zarinpal', ZARINPAL_MERCHANT_ID: 'm', OTP_TEST_CODE: '11111', RATE_LIMIT: 'false' });
    expect(c.otpTestCode).toBeNull();
    expect(c.RATE_LIMIT).toBe(true);
    expect(c.cookieSecure).toBe(true);
  });
});
