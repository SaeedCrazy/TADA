import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, createTestApp, loginCustomer, loginStaff, OTP, OWNER_PASSWORD, type TestEnv } from './helpers.js';
import { hashPassword } from '../modules/auth/auth.routes.js';

let env: TestEnv;
beforeAll(async () => { env = await createTestApp(); });
afterAll(async () => { await env.close(); });

describe('customer OTP login', () => {
  it('sends a code, verifies it and opens a session', async () => {
    const c = new Client(env.app);
    const r = await c.post('/api/auth/otp/request', { phone: '+98 912 000 1111' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, expiresIn: 120 });
    expect(env.sms.sent.at(-1)).toEqual({ phone: '09120001111', text: `otp:${OTP}` });

    const v = await c.post('/api/auth/otp/verify', { phone: '09120001111', code: '۱۲۳۴۵', name: 'نیما' });
    expect(v.status).toBe(200);
    expect(v.body.customer).toMatchObject({ phone: '09120001111', name: 'نیما' });
    expect(c.cookies.has('tada_sid')).toBe(true);
    const sid = v.raw.cookies.find((x: { name: string }) => x.name === 'tada_sid') as { httpOnly?: boolean; sameSite?: string };
    expect(sid.httpOnly).toBe(true);
    expect(sid.sameSite).toBe('Lax');

    const me = await c.get('/api/auth/me');
    expect(me.body.customer.phone).toBe('09120001111');

    // The session token is stored hashed, never in clear.
    const sessions = await env.db.session.findMany();
    expect(sessions.some((s) => s.id === c.cookies.get('tada_sid'))).toBe(false);

    await c.post('/api/auth/logout');
    expect((await c.get('/api/auth/me')).body.customer).toBeNull();
  });

  it('rejects invalid numbers and throttles resends', async () => {
    const c = new Client(env.app);
    expect((await c.post('/api/auth/otp/request', { phone: '12345' })).status).toBe(400);
    expect((await c.post('/api/auth/otp/request', { phone: '09120002222' })).status).toBe(200);
    const again = await c.post('/api/auth/otp/request', { phone: '09120002222' });
    expect(again.status).toBe(429);
    expect(again.body.error.code).toBe('otp_wait');
  });

  it('locks a code after five wrong attempts', async () => {
    const c = new Client(env.app);
    await c.post('/api/auth/otp/request', { phone: '09120003333' });
    for (let i = 0; i < 5; i++) {
      const r = await c.post('/api/auth/otp/verify', { phone: '09120003333', code: '00000' });
      expect(r.status).toBe(400);
    }
    const locked = await c.post('/api/auth/otp/verify', { phone: '09120003333', code: OTP });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('otp_locked');
  });

  it('does not let a code be used twice', async () => {
    const c = new Client(env.app);
    await c.post('/api/auth/otp/request', { phone: '09120004444' });
    expect((await c.post('/api/auth/otp/verify', { phone: '09120004444', code: OTP })).status).toBe(200);
    expect((await new Client(env.app).post('/api/auth/otp/verify', { phone: '09120004444', code: OTP })).status).toBe(400);
  });

  it('blocks blocked customers', async () => {
    await env.db.customer.create({ data: { phone: '09120005555', isBlocked: true } });
    const c = new Client(env.app);
    await c.post('/api/auth/otp/request', { phone: '09120005555' });
    expect((await c.post('/api/auth/otp/verify', { phone: '09120005555', code: OTP })).status).toBe(403);
  });
});

describe('staff login', () => {
  it('logs in the owner and returns the role', async () => {
    const c = await loginStaff(env.app);
    const me = await c.get('/api/staff/me');
    expect(me.body.staff).toMatchObject({ username: 'owner', role: 'OWNER' });
  });

  it('rejects wrong passwords and locks after five failures', async () => {
    await env.db.staff.create({ data: { username: 'lockme', name: 'L', role: 'OWNER', passwordHash: await hashPassword('right-password-123') } });
    const c = new Client(env.app);
    for (let i = 0; i < 5; i++) expect((await c.post('/api/staff/login', { username: 'lockme', password: 'wrong-password' })).status).toBe(401);
    const r = await c.post('/api/staff/login', { username: 'lockme', password: 'right-password-123' });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('account_locked');
  });

  it('records failed logins in the audit log', async () => {
    await new Client(env.app).post('/api/staff/login', { username: 'owner', password: 'definitely-wrong' });
    expect(await env.db.auditLog.count({ where: { action: 'staff.login_failed' } })).toBeGreaterThan(0);
  });

  it('keeps customers out of staff routes', async () => {
    const customer = await loginCustomer(env.app, '09120006666');
    expect((await customer.get('/api/staff/orders')).status).toBe(401);
    expect((await new Client(env.app).get('/api/staff/reports/summary?from=2026-01-01&to=2026-02-01')).status).toBe(401);
  });
});

describe('CSRF protection', () => {
  it('refuses cookie-authenticated writes from another origin', async () => {
    const owner = await loginStaff(env.app);
    const evil = new Client(env.app, 'https://evil.example');
    evil.cookies = owner.cookies;
    const r = await evil.post('/api/staff/categories', { nameFa: 'x', nameEn: 'x' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('bad_origin');

    const noOrigin = new Client(env.app, null);
    noOrigin.cookies = owner.cookies;
    expect((await noOrigin.post('/api/staff/logout')).status).toBe(403);
  });

  it('allows the same request from our origin', async () => {
    const owner = await loginStaff(env.app, 'owner', OWNER_PASSWORD);
    expect((await owner.post('/api/staff/categories', { nameFa: 'تست', nameEn: 'Test cat' })).status).toBe(201);
  });
});

describe('security headers', () => {
  it('sends a locked-down CSP and no framing', async () => {
    const r = await new Client(env.app).get('/api/branches');
    expect(r.raw.headers['content-security-policy']).toContain("default-src 'none'");
    expect(r.raw.headers['x-content-type-options']).toBe('nosniff');
    expect(r.raw.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});
