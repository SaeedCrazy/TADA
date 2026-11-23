// Request schemas shared by the API (authoritative validation) and the web app (early feedback).
import { z } from 'zod';
import { ORDER_TYPES, PAYMENT_METHODS, ORDER_STATUSES, STAFF_ROLES } from './enums.js';
import { normalizeIranMobile, toLatinDigits } from './format.js';
import { TASTE_NOTES } from './taste.js';

export const id = z.uuid();

export const iranMobile = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizeIranMobile(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'invalid_mobile' });
      return z.NEVER;
    }
    return n;
  });

const shortText = (max: number) => z.string().trim().max(max);

export const cartLineSchema = z.object({
  productId: id,
  quantity: z.number().int().min(1).max(20),
  optionIds: z.array(id).max(10).default([]),
  note: shortText(140).optional(),
});
export type CartLineInput = z.input<typeof cartLineSchema>;

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const quoteSchema = z.object({
  type: z.enum(ORDER_TYPES),
  branchId: id.optional(),
  tableToken: z.string().min(8).max(64).optional(),
  items: z.array(cartLineSchema).min(1).max(30),
  discountCode: z.string().trim().toUpperCase().max(32).optional(),
  location: latLngSchema.optional(),
});
export type QuoteInput = z.input<typeof quoteSchema>;

export const createOrderSchema = quoteSchema.extend({
  paymentMethod: z.enum(PAYMENT_METHODS),
  customerName: z.string().trim().min(1).max(60),
  addressText: shortText(300).optional(),
  addressId: id.optional(),
  note: shortText(300).optional(),
  idempotencyKey: z.uuid(),
  locale: z.enum(['fa', 'en']).default('fa'),
});
export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const otpRequestSchema = z.object({ phone: iranMobile });
export const otpVerifySchema = z.object({
  phone: iranMobile,
  code: z.string().transform((v) => toLatinDigits(v).trim()).pipe(z.string().regex(/^\d{5}$/)),
  name: z.string().trim().min(1).max(60).optional(),
});

export const staffLoginSchema = z.object({
  username: z.string().trim().min(3).max(40),
  password: z.string().min(8).max(200),
});

export const addressSchema = z.object({
  title: z.string().trim().min(1).max(40),
  line: z.string().trim().min(5).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  tasteConsent: z.boolean().optional(),
  locale: z.enum(['fa', 'en']).optional(),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: shortText(200).optional(),
});

export const tasteProfileSchema = z.object({
  sweetness: z.number().min(0).max(5).optional(),
  bitterness: z.number().min(0).max(5).optional(),
  acidity: z.number().min(0).max(5).optional(),
  body: z.number().min(0).max(5).optional(),
  caffeine: z.number().min(0).max(5).optional(),
  milk: z.enum(['yes', 'no', 'any']).optional(),
  temperature: z.enum(['HOT', 'ICED', 'any']).optional(),
  notes: z.array(z.enum(TASTE_NOTES)).max(10).optional(),
});

export const quizAnswerSchema = z.object({
  answers: z.record(z.string().max(20), z.union([z.string().max(20), z.array(z.string().max(20)).max(6)])),
  branchId: id.optional(),
  save: z.boolean().default(false),
});

export const chatMessageSchema = z.object({
  conversationId: id.optional(),
  message: z.string().trim().min(1).max(600),
  branchId: id.optional(),
  locale: z.enum(['fa', 'en']).default('fa'),
});

export const staffRoleSchema = z.enum(STAFF_ROLES);
