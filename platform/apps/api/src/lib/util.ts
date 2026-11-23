import { createHash, createHmac, randomBytes, timingSafeEqual, randomInt } from 'node:crypto';
import type { z } from 'zod';
import { AppError, zodDetails } from './errors.js';

/** Validates with zod and throws a 400 AppError with field details. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(400, 'validation_failed', 'validation_failed', zodDetails(r.error));
  return r.data;
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const hmac = (secret: string, s: string) => createHmac('sha256', secret).update(s).digest('hex');

export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

/** Constant-time comparison of two strings (via their SHA-256, so lengths may differ). */
export function safeEqualText(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}

export const randomDigits = (n: number) => Array.from({ length: n }, () => randomInt(0, 10)).join('');

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export function pageParams(q: { page?: unknown; pageSize?: unknown }, max = 100) {
  const page = Math.max(1, Number(q.page) || 1);
  const pageSize = Math.min(max, Math.max(1, Number(q.pageSize) || 20));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
