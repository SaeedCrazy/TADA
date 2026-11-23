import type { FastifyBaseLogger } from 'fastify';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { EventBus } from './lib/events.js';
import { createSms, type SmsDriver } from './modules/notify/sms.js';
import { createPayments, type PaymentDriver } from './modules/payments/drivers.js';
import { createAccounting, type AccountingDriver } from './modules/accounting/drivers.js';
import { createLlm, type LlmClient } from './modules/assistant/llm.js';

/** Everything a route or worker needs. Tests swap drivers through `overrides`. */
export interface AppContext {
  config: Config;
  db: Db;
  bus: EventBus;
  sms: SmsDriver;
  payments: PaymentDriver;
  accounting: AccountingDriver | null;
  llm: LlmClient | null;
  log: FastifyBaseLogger;
}

export type ContextOverrides = Partial<Pick<AppContext, 'sms' | 'payments' | 'accounting' | 'llm'>>;

export function createContext(config: Config, db: Db, log: FastifyBaseLogger, o: ContextOverrides = {}): AppContext {
  const apiBase = config.PUBLIC_WEB_URL.replace(/\/$/, '');
  return {
    config,
    db,
    log,
    bus: new EventBus(),
    sms: o.sms ?? createSms(config, log),
    payments: o.payments ?? createPayments(config, apiBase),
    accounting: o.accounting !== undefined ? o.accounting : createAccounting(config),
    llm: o.llm !== undefined ? o.llm : createLlm(config),
  };
}
