// SMS providers. OTP codes go through a provider template (Kavenegar "verify/lookup");
// order updates are plain messages from a dedicated sender line.
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../../config.js';
import { maskMobile } from '@tada/shared';

export interface SmsDriver {
  readonly name: string;
  sendOtp(phone: string, code: string): Promise<void>;
  sendText(phone: string, text: string): Promise<void>;
}

export class ConsoleSms implements SmsDriver {
  readonly name = 'console';
  readonly sent: { phone: string; text: string }[] = [];
  constructor(private log: FastifyBaseLogger) {}
  async sendOtp(phone: string, code: string) {
    this.sent.push({ phone, text: `otp:${code}` });
    this.log.info({ phone: maskMobile(phone), code }, 'SMS (console driver) OTP');
  }
  async sendText(phone: string, text: string) {
    this.sent.push({ phone, text });
    this.log.info({ phone: maskMobile(phone), text }, 'SMS (console driver)');
  }
}

export class KavenegarSms implements SmsDriver {
  readonly name = 'kavenegar';
  constructor(private cfg: Pick<Config, 'KAVENEGAR_API_KEY' | 'KAVENEGAR_OTP_TEMPLATE' | 'KAVENEGAR_SENDER'>, private fetchImpl: typeof fetch = fetch) {}

  private async call(path: string, params: Record<string, string>) {
    const url = new URL(`https://api.kavenegar.com/v1/${encodeURIComponent(this.cfg.KAVENEGAR_API_KEY)}/${path}`);
    const body = new URLSearchParams(params);
    const res = await this.fetchImpl(url, { method: 'POST', body, signal: AbortSignal.timeout(10_000) });
    const json = (await res.json().catch(() => null)) as { return?: { status?: number; message?: string } } | null;
    if (!res.ok || json?.return?.status !== 200) {
      throw new Error(`kavenegar ${path} failed: ${json?.return?.status ?? res.status} ${json?.return?.message ?? ''}`.trim());
    }
  }

  sendOtp(phone: string, code: string) {
    return this.call('verify/lookup.json', { receptor: phone, token: code, template: this.cfg.KAVENEGAR_OTP_TEMPLATE });
  }

  sendText(phone: string, text: string) {
    if (!this.cfg.KAVENEGAR_SENDER) return Promise.resolve();
    return this.call('sms/send.json', { receptor: phone, sender: this.cfg.KAVENEGAR_SENDER, message: text });
  }
}

export function createSms(cfg: Config, log: FastifyBaseLogger): SmsDriver {
  return cfg.SMS_DRIVER === 'kavenegar' ? new KavenegarSms(cfg) : new ConsoleSms(log);
}
