// Environment configuration, validated once at startup. Unsafe combinations fail closed.
import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.string().min(1),
    /** Used to HMAC OTP codes. 32+ random characters. */
    SESSION_SECRET: z.string().min(32),
    /** Public origin of the site, e.g. https://tada.ir. Used for callbacks, QR codes and the CSRF origin check. */
    PUBLIC_WEB_URL: z.url(),
    /** Extra allowed origins for state-changing requests (comma separated), e.g. a staging domain. */
    EXTRA_ORIGINS: z.string().default(''),
    TRUST_PROXY: bool.default(false),
    COOKIE_SECURE: bool.optional(),

    PAYMENT_DRIVER: z.enum(['mock', 'zarinpal']).default('mock'),
    ALLOW_MOCK_PAYMENTS: bool.default(false),
    ZARINPAL_MERCHANT_ID: z.string().default(''),
    ZARINPAL_SANDBOX: bool.default(false),
    PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().min(5).max(120).default(20),

    SMS_DRIVER: z.enum(['console', 'kavenegar']).default('console'),
    KAVENEGAR_API_KEY: z.string().default(''),
    KAVENEGAR_OTP_TEMPLATE: z.string().default('tada-otp'),
    KAVENEGAR_SENDER: z.string().default(''),
    SMS_ORDER_UPDATES: bool.default(true),

    ACCOUNTING_DRIVER: z.enum(['none', 'webhook']).default('none'),
    ACCOUNTING_WEBHOOK_URL: z.string().default(''),
    ACCOUNTING_WEBHOOK_SECRET: z.string().default(''),

    /** OpenAI-compatible chat completions endpoint (self-hosted model or a provider you may legally use). Empty = guided mode. */
    LLM_BASE_URL: z.string().default(''),
    LLM_API_KEY: z.string().default(''),
    LLM_MODEL: z.string().default(''),
    LLM_TIMEOUT_MS: z.coerce.number().int().default(20000),

    UPLOAD_DIR: z.string().default('./uploads'),
    /** Non-production only: every OTP equals this code, for automated tests. Ignored in production. */
    OTP_TEST_CODE: z.string().regex(/^\d{5}$/).optional(),
    WORKERS: bool.default(true),
    /** Only for automated tests that hammer endpoints from one address. Always on in production. */
    RATE_LIMIT: bool.default(true),
  })
  .superRefine((c, ctx) => {
    if (c.NODE_ENV === 'production') {
      if (c.PAYMENT_DRIVER === 'mock' && !c.ALLOW_MOCK_PAYMENTS) {
        ctx.addIssue({ code: 'custom', path: ['PAYMENT_DRIVER'], message: 'mock payments are disabled in production' });
      }
      if (c.PAYMENT_DRIVER === 'zarinpal' && !c.ZARINPAL_MERCHANT_ID) {
        ctx.addIssue({ code: 'custom', path: ['ZARINPAL_MERCHANT_ID'], message: 'required for zarinpal' });
      }
      if (c.SESSION_SECRET.includes('dev-only') || c.SESSION_SECRET.includes('change-me')) {
        ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'set a real secret in production' });
      }
      if (!c.PUBLIC_WEB_URL.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['PUBLIC_WEB_URL'], message: 'must be https in production' });
      }
    }
    if (c.SMS_DRIVER === 'kavenegar' && !c.KAVENEGAR_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['KAVENEGAR_API_KEY'], message: 'required for kavenegar' });
    }
    if (c.ACCOUNTING_DRIVER === 'webhook' && (!c.ACCOUNTING_WEBHOOK_URL || c.ACCOUNTING_WEBHOOK_SECRET.length < 16)) {
      ctx.addIssue({ code: 'custom', path: ['ACCOUNTING_WEBHOOK_URL'], message: 'webhook needs a URL and a 16+ char secret' });
    }
  });

export type Config = z.output<typeof schema> & {
  isProd: boolean;
  cookieSecure: boolean;
  allowedOrigins: string[];
  otpTestCode: string | null;
  llmEnabled: boolean;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${lines}`);
  }
  const c = parsed.data;
  const isProd = c.NODE_ENV === 'production';
  const origins = new Set<string>([new URL(c.PUBLIC_WEB_URL).origin]);
  for (const o of c.EXTRA_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)) origins.add(new URL(o).origin);
  return {
    ...c,
    isProd,
    cookieSecure: c.COOKIE_SECURE ?? isProd,
    allowedOrigins: [...origins],
    otpTestCode: isProd ? null : (c.OTP_TEST_CODE ?? null),
    llmEnabled: Boolean(c.LLM_BASE_URL && c.LLM_MODEL),
    RATE_LIMIT: isProd ? true : c.RATE_LIMIT,
  };
}
