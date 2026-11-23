import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createDb, type Db } from '../db.js';
import type { ContextOverrides } from '../context.js';
import { seed } from '../seed.js';
import type { SmsDriver } from '../modules/notify/sms.js';
import type { AccountingDriver, InvoicePayload } from '../modules/accounting/drivers.js';
import { TEST_DB } from './global-setup.js';

export const ORIGIN = 'http://localhost:3000';
export const OWNER_PASSWORD = 'owner-password-for-tests';
export const OTP = '12345';

export class FakeSms implements SmsDriver {
  readonly name = 'fake';
  sent: { phone: string; text: string }[] = [];
  async sendOtp(phone: string, code: string) { this.sent.push({ phone, text: `otp:${code}` }); }
  async sendText(phone: string, text: string) { this.sent.push({ phone, text }); }
}

export class FakeAccounting implements AccountingDriver {
  readonly name = 'fake';
  invoices: InvoicePayload[] = [];
  failNext = 0;
  async pushInvoice(inv: InvoicePayload) {
    if (this.failNext > 0) { this.failNext--; throw new Error('accounting down'); }
    this.invoices.push(inv);
    return { externalId: `EXT-${inv.invoiceNumber}` };
  }
}

export async function resetDb(db: Db) {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
}

export interface TestEnv {
  app: FastifyInstance;
  db: Db;
  sms: FakeSms;
  accounting: FakeAccounting;
  close(): Promise<void>;
}

export async function createTestApp(extra: Record<string, string> = {}, overrides: ContextOverrides = {}): Promise<TestEnv> {
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DB,
    SESSION_SECRET: 'test-secret-0123456789-0123456789-abcdef',
    PUBLIC_WEB_URL: ORIGIN,
    OTP_TEST_CODE: OTP,
    LOG_LEVEL: 'silent',
    RATE_LIMIT: 'false',
    UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'tada-uploads-')),
    ...extra,
  });
  const db = createDb(TEST_DB);
  await resetDb(db);
  await seed(db, { ownerPassword: OWNER_PASSWORD, quiet: true });
  // Tests must not depend on the wall clock: branches are open around the clock.
  await db.branch.updateMany({ data: { hours: [['00:00', '24:00']] } });
  const sms = new FakeSms();
  const accounting = new FakeAccounting();
  const app = await buildApp({ config, db, logger: false, overrides: { sms, accounting, ...overrides } });
  await app.ready();
  return {
    app, db, sms, accounting,
    async close() {
      await app.close();
      await db.$disconnect();
    },
  };
}

/** A browser-like client: keeps cookies and sends our Origin on writes. */
export class Client {
  cookies = new Map<string, string>();
  constructor(private app: FastifyInstance, private origin: string | null = ORIGIN) {}

  async req<T = any>(method: InjectOptions['method'], url: string, body?: unknown, headers: Record<string, string> = {}) {
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await this.app.inject({
      method, url,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(this.origin && method !== 'GET' ? { origin: this.origin } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    });
    for (const c of res.cookies as { name: string; value: string; maxAge?: number }[]) {
      if (!c.value || c.maxAge === 0) this.cookies.delete(c.name);
      else this.cookies.set(c.name, c.value);
    }
    let json: T | undefined;
    try { json = res.json() as T; } catch { json = undefined; }
    return { status: res.statusCode, body: json as T, raw: res };
  }
  get<T = any>(url: string, headers?: Record<string, string>) { return this.req<T>('GET', url, undefined, headers); }
  post<T = any>(url: string, body?: unknown, headers?: Record<string, string>) { return this.req<T>('POST', url, body ?? {}, headers); }
  put<T = any>(url: string, body?: unknown) { return this.req<T>('PUT', url, body ?? {}); }
  patch<T = any>(url: string, body?: unknown) { return this.req<T>('PATCH', url, body ?? {}); }
  del<T = any>(url: string) { return this.req<T>('DELETE', url); }
}

export async function loginCustomer(app: FastifyInstance, phone = '09121234567', name = 'سارا') {
  const c = new Client(app);
  const r1 = await c.post('/api/auth/otp/request', { phone });
  if (r1.status !== 200) throw new Error(`otp request ${r1.status} ${JSON.stringify(r1.body)}`);
  const r2 = await c.post('/api/auth/otp/verify', { phone, code: OTP, name });
  if (r2.status !== 200) throw new Error(`otp verify ${r2.status} ${JSON.stringify(r2.body)}`);
  return c;
}

export async function loginStaff(app: FastifyInstance, username = 'owner', password = OWNER_PASSWORD) {
  const c = new Client(app);
  const r = await c.post('/api/staff/login', { username, password });
  if (r.status !== 200) throw new Error(`staff login ${r.status} ${JSON.stringify(r.body)}`);
  return c;
}

export const uuid = () => crypto.randomUUID();

export async function fixtures(db: Db) {
  const branch = await db.branch.findUniqueOrThrow({ where: { slug: 'mollasadra' } });
  const other = await db.branch.findUniqueOrThrow({ where: { slug: 'jomhouri' } });
  const table = await db.diningTable.findFirstOrThrow({ where: { branchId: branch.id, number: 1 } });
  const latte = await db.product.findUniqueOrThrow({ where: { slug: 'latte' }, include: { optionGroups: { include: { options: true } } } });
  const espresso = await db.product.findUniqueOrThrow({ where: { slug: 'espresso' } });
  const cookie = await db.product.findUniqueOrThrow({ where: { slug: 'chocolate-cookie' } });
  const opt = (group: string, name: string) =>
    latte.optionGroups.find((g) => g.nameEn === group)!.options.find((o) => o.nameEn === name)!;
  return { branch, other, table, latte, espresso, cookie, opt };
}
