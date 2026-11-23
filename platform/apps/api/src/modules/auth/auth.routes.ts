// Customers sign in with a one-time SMS code; staff with a username and an Argon2id password.
import type { FastifyInstance } from 'fastify';
import { hash, verify } from '@node-rs/argon2';
import { otpRequestSchema, otpVerifySchema, staffLoginSchema } from '@tada/shared';
import { AppError, badRequest, forbidden, unauthorized } from '../../lib/errors.js';
import { hmac, parse, randomDigits, safeEqualHex } from '../../lib/util.js';
import { audit } from '../staff/audit.js';

const OTP_TTL_MS = 2 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_PER_HOUR = 5;
const OTP_MAX_ATTEMPTS = 5;
const STAFF_MAX_FAILS = 5;
const STAFF_LOCK_MS = 15 * 60 * 1000;

export const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const hashPassword = (pw: string) => hash(pw, ARGON_OPTS);

export default async function authRoutes(app: FastifyInstance) {
  const { db, config, sms } = app.ctx;
  const otpHash = (phone: string, code: string) => hmac(config.SESSION_SECRET, `otp:${phone}:${code}`);
  // Spend the same time on unknown usernames as on wrong passwords.
  const dummyHash = await hashPassword('not-a-real-password-just-for-timing');
  const staffFails = new Map<string, { count: number; until: number }>();

  // ---------------------------------------------------------------- customers

  app.post('/auth/otp/request', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req) => {
    const { phone } = parse(otpRequestSchema, req.body);
    const now = Date.now();
    const recent = await db.otpCode.findMany({
      where: { phone, createdAt: { gt: new Date(now - 3600_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (recent[0] && now - recent[0].createdAt.getTime() < OTP_RESEND_MS) {
      throw new AppError(429, 'otp_wait', 'otp_wait', { retryAfter: Math.ceil((OTP_RESEND_MS - (now - recent[0].createdAt.getTime())) / 1000) });
    }
    if (recent.length >= OTP_PER_HOUR) throw new AppError(429, 'otp_hourly_limit');

    const code = config.otpTestCode ?? randomDigits(5);
    await db.otpCode.create({ data: { phone, codeHash: otpHash(phone, code), expiresAt: new Date(now + OTP_TTL_MS), ip: req.ip } });
    try {
      await sms.sendOtp(phone, code);
    } catch (err) {
      req.log.error({ err }, 'otp sms failed');
      throw new AppError(502, 'sms_unavailable');
    }
    // Same answer for new and existing numbers: no account enumeration.
    return { ok: true, expiresIn: OTP_TTL_MS / 1000, resendIn: OTP_RESEND_MS / 1000 };
  });

  app.post('/auth/otp/verify', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { phone, code, name } = parse(otpVerifySchema, req.body);
    const otp = await db.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw badRequest('otp_invalid');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new AppError(429, 'otp_locked');
    if (!safeEqualHex(otp.codeHash, otpHash(phone, code))) {
      await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw badRequest('otp_invalid');
    }
    const consumed = await db.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) throw badRequest('otp_invalid');

    const customer = await db.customer.upsert({
      where: { phone },
      create: { phone, name: name ?? null },
      update: {},
    });
    if (customer.isBlocked) throw forbidden('account_blocked');
    if (name && !customer.name) await db.customer.update({ where: { id: customer.id }, data: { name } });
    await app.sessions.create(reply, req, 'customer', customer.id);
    return { customer: { id: customer.id, phone: customer.phone, name: customer.name ?? name ?? null } };
  });

  app.post('/auth/logout', async (req, reply) => {
    await app.sessions.destroy(reply, req, 'customer');
    return { ok: true };
  });

  app.get('/auth/me', async (req) => {
    if (!req.customer) return { customer: null };
    const c = await db.customer.findUnique({
      where: { id: req.customer.id },
      select: { id: true, phone: true, name: true, locale: true, tasteConsent: true, tasteProfile: true },
    });
    return { customer: c };
  });

  // ---------------------------------------------------------------- staff

  app.post('/staff/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { username, password } = parse(staffLoginSchema, req.body);
    const key = username.toLowerCase();
    const fails = staffFails.get(key);
    if (fails && fails.until > Date.now()) throw new AppError(429, 'account_locked', 'account_locked', { retryAfter: Math.ceil((fails.until - Date.now()) / 1000) });

    const staff = await db.staff.findUnique({ where: { username: key } });
    const ok = await verify(staff?.passwordHash ?? dummyHash, password).catch(() => false);
    if (!staff || !ok || !staff.isActive) {
      const n = (fails?.count ?? 0) + 1;
      staffFails.set(key, { count: n, until: n >= STAFF_MAX_FAILS ? Date.now() + STAFF_LOCK_MS : 0 });
      await audit(db, { staffId: staff?.id ?? null, action: 'staff.login_failed', entity: 'staff', entityId: staff?.id ?? null, data: { username: key }, ip: req.ip });
      throw unauthorized('invalid_credentials');
    }
    staffFails.delete(key);
    await db.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });
    await app.sessions.create(reply, req, 'staff', staff.id);
    await audit(db, { staffId: staff.id, action: 'staff.login', entity: 'staff', entityId: staff.id, ip: req.ip });
    return { staff: { id: staff.id, username: staff.username, name: staff.name, role: staff.role, branchId: staff.branchId } };
  });

  app.post('/staff/logout', async (req, reply) => {
    await app.sessions.destroy(reply, req, 'staff');
    return { ok: true };
  });

  app.get('/staff/me', async (req) => ({ staff: req.staff }));
}
