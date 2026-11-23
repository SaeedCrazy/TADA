import { describe, expect, it } from 'vitest';
import {
  normalizeIranMobile, formatToman, toLatinDigits, toPersianDigits, canTransition,
  profileFromAnswers, scoreTaste, recommend, openState, isValidHours, createOrderSchema, otpVerifySchema,
  type TasteAttributes,
} from './index.js';

describe('format', () => {
  it('normalizes Iranian mobiles in every common shape', () => {
    for (const v of ['09121234567', '+989121234567', '00989121234567', '989121234567', '9121234567', '۰۹۱۲ ۱۲۳ ۴۵۶۷', '0912-123-4567']) {
      expect(normalizeIranMobile(v)).toBe('09121234567');
    }
    for (const v of ['0912123456', '08121234567', 'abc', '', '091212345678']) {
      expect(normalizeIranMobile(v)).toBeNull();
    }
  });
  it('formats rials as toman', () => {
    expect(formatToman(1_250_000, 'fa')).toBe('۱۲۵٬۰۰۰ تومان');
    expect(formatToman(1_250_000, 'en')).toBe('125,000 Toman');
    expect(formatToman(0, 'en')).toBe('0 Toman');
  });
  it('round-trips digits', () => {
    expect(toLatinDigits(toPersianDigits('0123456789'))).toBe('0123456789');
    expect(toLatinDigits('٠١٢')).toBe('012');
  });
});

describe('order transitions', () => {
  it('allows the kitchen path and blocks shortcuts', () => {
    expect(canTransition('PLACED', 'PREPARING', 'DINE_IN')).toBe(true);
    expect(canTransition('PREPARING', 'READY', 'PICKUP')).toBe(true);
    expect(canTransition('READY', 'COMPLETED', 'PICKUP')).toBe(true);
    expect(canTransition('READY', 'COMPLETED', 'DELIVERY')).toBe(false);
    expect(canTransition('READY', 'OUT_FOR_DELIVERY', 'DINE_IN')).toBe(false);
    expect(canTransition('PENDING_PAYMENT', 'PLACED', 'PICKUP')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED', 'PICKUP')).toBe(false);
  });
});

describe('taste engine', () => {
  const espresso: TasteAttributes = { sweetness: 0, bitterness: 5, acidity: 3, body: 5, caffeine: 5, milk: false, temperature: 'HOT', notes: ['chocolate', 'nutty'] };
  const ube: TasteAttributes = { sweetness: 4, bitterness: 0, acidity: 0, body: 3, caffeine: 0, milk: true, temperature: 'ICED', notes: ['vanilla', 'creamy'] };
  const matcha: TasteAttributes = { sweetness: 2, bitterness: 3, acidity: 1, body: 3, caffeine: 3, milk: true, temperature: 'BOTH', notes: ['earthy', 'creamy'] };

  it('builds a profile from quiz answers', () => {
    const p = profileFromAnswers({ mood: 'wake', taste: 'bitter', milk: 'black', temperature: 'hot', notes: ['choco'], junk: 'x' });
    expect(p).toMatchObject({ caffeine: 5, body: 4, bitterness: 4, sweetness: 0, milk: 'no', temperature: 'HOT' });
    expect(p.notes).toEqual(['chocolate', 'nutty', 'caramel']);
  });

  it('scores the obvious match highest', () => {
    const p = profileFromAnswers({ mood: 'treat', taste: 'sweet', milk: 'milk', temperature: 'iced', notes: ['soft'] });
    expect(scoreTaste(ube, p).score).toBeGreaterThan(scoreTaste(espresso, p).score);
    expect(scoreTaste(ube, p).reasons).toEqual(expect.arrayContaining(['sweet', 'milk', 'iced']));
  });

  it('recommends drinks in score order with a pairing and is deterministic', () => {
    const products = [
      { id: '1', name: 'Espresso', kind: 'DRINK' as const, taste: espresso },
      { id: '2', name: 'Ube latte', kind: 'DRINK' as const, taste: ube },
      { id: '3', name: 'Matcha latte', kind: 'DRINK' as const, taste: matcha },
      { id: '4', name: 'Cookie', kind: 'FOOD' as const, taste: { ...ube, sweetness: 5 } },
      { id: '5', name: 'Croissant', kind: 'FOOD' as const, taste: { ...ube, sweetness: 1 } },
      { id: '6', name: 'Beans 1kg', kind: 'PACKAGED' as const, taste: null },
    ];
    const p = profileFromAnswers({ mood: 'wake', taste: 'bitter', milk: 'black', temperature: 'hot' });
    const a = recommend(products, p, 2);
    expect(a.picks.map((x) => x.item.name)).toEqual(['Espresso', 'Matcha latte']);
    expect(a.pairing?.name).toBe('Croissant');
    expect(recommend(products, p, 2)).toEqual(a);
    expect(recommend(products, profileFromAnswers({ taste: 'sweet' }), 1).pairing?.name).toBe('Cookie');
  });
});

describe('opening hours', () => {
  const hours: [string, string][] = [['09:00', '16:00'], ['17:00', '23:00']];
  // Iran is UTC+03:30 all year.
  const at = (h: number, m: number) => new Date(Date.UTC(2026, 10, 23, h, m) - 210 * 60 * 1000);
  it('knows when a branch is open', () => {
    expect(openState(hours, at(10, 0))).toEqual({ open: true, closesAt: '16:00' });
    expect(openState(hours, at(16, 30))).toEqual({ open: false, opensAt: '17:00', tomorrow: false });
    expect(openState(hours, at(23, 10))).toEqual({ open: false, opensAt: '09:00', tomorrow: true });
    expect(openState(hours, at(8, 59))).toEqual({ open: false, opensAt: '09:00', tomorrow: false });
  });
  it('validates hours', () => {
    expect(isValidHours(hours)).toBe(true);
    expect(isValidHours([['10:00', '09:00']])).toBe(false);
    expect(isValidHours([])).toBe(false);
    expect(isValidHours('x')).toBe(false);
  });
});

describe('schemas', () => {
  it('accepts a valid order and normalizes the code', () => {
    const r = createOrderSchema.safeParse({
      type: 'PICKUP', branchId: '7c9e6679-7425-40de-944b-e07fc1f90ae7', paymentMethod: 'ONLINE', customerName: 'سارا',
      items: [{ productId: '7c9e6679-7425-40de-944b-e07fc1f90ae7', quantity: 2 }], discountCode: ' welcome ',
      idempotencyKey: '0b6f8a4e-1f4b-4c5e-9a57-2a1c9f1b7d10',
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.discountCode).toBe('WELCOME');
    expect(r.success && r.data.items[0]!.optionIds).toEqual([]);
  });
  it('rejects bad quantities and accepts Persian OTP digits', () => {
    expect(createOrderSchema.safeParse({ type: 'PICKUP', items: [{ productId: 'x', quantity: 0 }] }).success).toBe(false);
    const v = otpVerifySchema.safeParse({ phone: '۰۹۱۲۱۲۳۴۵۶۷', code: '۱۲۳۴۵' });
    expect(v.success && v.data).toEqual({ phone: '09121234567', code: '12345' });
  });
});
