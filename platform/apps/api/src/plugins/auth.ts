// Cookie sessions for customers and staff. Tokens are random; only their SHA-256 is stored,
// so a database leak does not leak live sessions. Customer and staff sessions use separate cookies.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { StaffRole } from '@tada/shared';
import { forbidden, unauthorized } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/util.js';

export const CUSTOMER_COOKIE = 'tada_sid';
export const STAFF_COOKIE = 'tada_staff';
const CUSTOMER_TTL_MS = 30 * 24 * 3600 * 1000;
const STAFF_TTL_MS = 12 * 3600 * 1000;
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export interface AuthCustomer { id: string; phone: string; name: string | null; isBlocked: boolean }
export interface AuthStaff { id: string; username: string; name: string; role: StaffRole; branchId: string | null }

declare module 'fastify' {
  interface FastifyRequest {
    customer: AuthCustomer | null;
    staff: AuthStaff | null;
  }
}

export default fp(async function auth(app: FastifyInstance) {
  const { db, config } = app.ctx;
  app.decorateRequest('customer', null);
  app.decorateRequest('staff', null);

  app.addHook('onRequest', async (req) => {
    const cTok = req.cookies[CUSTOMER_COOKIE];
    const sTok = req.cookies[STAFF_COOKIE];
    if (!cTok && !sTok) return;
    const ids = [cTok, sTok].filter((t): t is string => typeof t === 'string' && t.length >= 20 && t.length <= 100).map(sha256);
    if (!ids.length) return;
    const sessions = await db.session.findMany({
      where: { id: { in: ids }, expiresAt: { gt: new Date() } },
      include: {
        customer: { select: { id: true, phone: true, name: true, isBlocked: true } },
        staff: { select: { id: true, username: true, name: true, role: true, branchId: true, isActive: true } },
      },
    });
    const now = Date.now();
    for (const s of sessions) {
      if (s.customer && cTok && s.id === sha256(cTok)) req.customer = s.customer;
      if (s.staff && s.staff.isActive && sTok && s.id === sha256(sTok)) {
        const { isActive: _a, ...staff } = s.staff;
        req.staff = staff;
      }
      if (now - s.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
        await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
      }
    }
  });

  app.decorate('sessions', {
    async create(reply: FastifyReply, req: FastifyRequest, kind: 'customer' | 'staff', subjectId: string) {
      const token = randomToken(32);
      const ttl = kind === 'customer' ? CUSTOMER_TTL_MS : STAFF_TTL_MS;
      await db.session.create({
        data: {
          id: sha256(token),
          customerId: kind === 'customer' ? subjectId : null,
          staffId: kind === 'staff' ? subjectId : null,
          expiresAt: new Date(Date.now() + ttl),
          ip: req.ip,
          userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
        },
      });
      reply.setCookie(kind === 'customer' ? CUSTOMER_COOKIE : STAFF_COOKIE, token, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: kind === 'customer' ? 'lax' : 'strict',
        path: '/',
        maxAge: Math.floor(ttl / 1000),
      });
    },
    async destroy(reply: FastifyReply, req: FastifyRequest, kind: 'customer' | 'staff') {
      const name = kind === 'customer' ? CUSTOMER_COOKIE : STAFF_COOKIE;
      const tok = req.cookies[name];
      if (tok) await db.session.deleteMany({ where: { id: sha256(tok) } });
      reply.clearCookie(name, { path: '/' });
    },
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    sessions: {
      create(reply: FastifyReply, req: FastifyRequest, kind: 'customer' | 'staff', subjectId: string): Promise<void>;
      destroy(reply: FastifyReply, req: FastifyRequest, kind: 'customer' | 'staff'): Promise<void>;
    };
  }
}

export function requireCustomer(req: FastifyRequest): AuthCustomer {
  if (!req.customer) throw unauthorized('login_required');
  if (req.customer.isBlocked) throw forbidden('account_blocked');
  return req.customer;
}

export function requireStaff(req: FastifyRequest, roles?: readonly StaffRole[]): AuthStaff {
  if (!req.staff) throw unauthorized('staff_login_required');
  if (roles && !roles.includes(req.staff.role)) throw forbidden('role_forbidden');
  return req.staff;
}

/** Owners see every branch; everyone else only their own. Returns the branch filter to apply. */
export function branchScope(staff: AuthStaff, requested?: string | null): string | undefined {
  if (staff.role === 'OWNER') return requested || undefined;
  if (!staff.branchId) throw forbidden('no_branch');
  if (requested && requested !== staff.branchId) throw forbidden('branch_forbidden');
  return staff.branchId;
}

export function assertBranchAccess(staff: AuthStaff, branchId: string) {
  if (staff.role !== 'OWNER' && staff.branchId !== branchId) throw forbidden('branch_forbidden');
}
