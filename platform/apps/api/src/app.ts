import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fstatic from '@fastify/static';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config } from './config.js';
import { createDb, type Db } from './db.js';
import { createContext, type AppContext, type ContextOverrides } from './context.js';
import { errorHandler, forbidden } from './lib/errors.js';
import authPlugin from './plugins/auth.js';
import publicRoutes from './modules/public/catalog.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import accountRoutes from './modules/account/account.routes.js';
import orderRoutes from './modules/orders/orders.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import assistantRoutes from './modules/assistant/assistant.routes.js';
import staffOrderRoutes from './modules/staff/orders.routes.js';
import staffCatalogRoutes from './modules/staff/catalog.routes.js';
import staffBranchRoutes from './modules/staff/branches.routes.js';
import staffAdminRoutes from './modules/staff/admin.routes.js';
import staffReportRoutes from './modules/staff/reports.routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export interface BuildOptions {
  config: Config;
  db?: Db;
  overrides?: ContextOverrides;
  logger?: FastifyServerOptions['logger'];
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const { config } = opts;
  const app = Fastify({
    logger: opts.logger ?? {
      level: config.LOG_LEVEL,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      ...(config.isProd ? {} : { transport: { target: 'pino-pretty', options: { singleLine: true } } }),
    },
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 256 * 1024,
  });

  const db = opts.db ?? createDb(config.DATABASE_URL);
  app.decorate('ctx', createContext(config, db, app.log, opts.overrides));
  if (!opts.db) app.addHook('onClose', async () => db.$disconnect());

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: 'not_found', message: 'not_found' } }));

  await app.register(cookie);
  await app.register(helmet, {
    // JSON API: lock everything down. The only HTML page (mock gateway) sets its own CSP.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], imgSrc: ["'self'", 'data:'] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  });
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute', allowList: () => !config.RATE_LIMIT });
  await app.register(multipart, { limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 5 } });

  const uploadDir = resolve(config.UPLOAD_DIR);
  mkdirSync(resolve(uploadDir, 'products'), { recursive: true });
  await app.register(fstatic, { root: uploadDir, prefix: '/uploads/', decorateReply: false, index: false, dotfiles: 'deny' });

  // CSRF: a state-changing request that carries a session cookie must come from our own origin.
  app.addHook('onRequest', async (req) => {
    if (SAFE_METHODS.has(req.method)) return;
    const hasSession = Boolean(req.headers.cookie && /tada_(sid|staff)=/.test(req.headers.cookie));
    if (!hasSession) return;
    const origin = req.headers.origin ?? (req.headers.referer ? safeOrigin(req.headers.referer) : undefined);
    if (!origin || !config.allowedOrigins.includes(origin)) throw forbidden('bad_origin');
  });

  await app.register(authPlugin);

  app.get('/api/health', async () => {
    await app.ctx.db.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  await app.register(publicRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(accountRoutes, { prefix: '/api' });
  await app.register(orderRoutes, { prefix: '/api' });
  await app.register(paymentRoutes, { prefix: '/api' });
  await app.register(assistantRoutes, { prefix: '/api' });
  await app.register(staffOrderRoutes, { prefix: '/api/staff' });
  await app.register(staffCatalogRoutes, { prefix: '/api/staff' });
  await app.register(staffBranchRoutes, { prefix: '/api/staff' });
  await app.register(staffAdminRoutes, { prefix: '/api/staff' });
  await app.register(staffReportRoutes, { prefix: '/api/staff' });

  return app;
}

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
