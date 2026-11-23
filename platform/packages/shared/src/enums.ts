// Domain enums. The API's Prisma enums use the same string values.

export const ORDER_TYPES = ['DINE_IN', 'PICKUP', 'DELIVERY'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const PAYMENT_METHODS = ['ONLINE', 'COUNTER', 'ON_DELIVERY'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PLACED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STAFF_ROLES = ['OWNER', 'MANAGER', 'BARISTA'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Which payment methods each order type accepts. */
export const PAYMENT_METHODS_BY_TYPE: Record<OrderType, readonly PaymentMethod[]> = {
  DINE_IN: ['ONLINE', 'COUNTER'],
  PICKUP: ['ONLINE'],
  DELIVERY: ['ONLINE', 'ON_DELIVERY'],
};

/** Order types that need a verified customer (phone checked by OTP). */
export const LOGIN_REQUIRED_TYPES: readonly OrderType[] = ['PICKUP', 'DELIVERY'];

/** Status changes staff may make. PENDING_PAYMENT -> PLACED only happens through payment verification. */
export const STAFF_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PLACED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus, type: OrderType): boolean {
  if (!STAFF_TRANSITIONS[from].includes(to)) return false;
  if (to === 'OUT_FOR_DELIVERY' && type !== 'DELIVERY') return false;
  if (from === 'READY' && to === 'COMPLETED' && type === 'DELIVERY') return false;
  return true;
}

/** Statuses that show on the bar screen. */
export const ACTIVE_STATUSES: readonly OrderStatus[] = ['PLACED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

type Labels = Record<'fa' | 'en', string>;

export const ORDER_STATUS_LABELS: Record<OrderStatus, Labels> = {
  PENDING_PAYMENT: { fa: 'در انتظار پرداخت', en: 'Awaiting payment' },
  PLACED: { fa: 'ثبت شد', en: 'Placed' },
  PREPARING: { fa: 'در حال آماده‌سازی', en: 'Preparing' },
  READY: { fa: 'آماده است', en: 'Ready' },
  OUT_FOR_DELIVERY: { fa: 'در راه', en: 'On the way' },
  COMPLETED: { fa: 'تحویل شد', en: 'Completed' },
  CANCELLED: { fa: 'لغو شد', en: 'Cancelled' },
};

export const ORDER_TYPE_LABELS: Record<OrderType, Labels> = {
  DINE_IN: { fa: 'سر میز', en: 'At the table' },
  PICKUP: { fa: 'تحویل در شعبه', en: 'Pickup' },
  DELIVERY: { fa: 'دلیوری', en: 'Delivery' },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, Labels> = {
  ONLINE: { fa: 'پرداخت آنلاین', en: 'Pay online' },
  COUNTER: { fa: 'پرداخت پای صندوق', en: 'Pay at the counter' },
  ON_DELIVERY: { fa: 'پرداخت دم در', en: 'Pay on delivery' },
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, Labels> = {
  UNPAID: { fa: 'پرداخت نشده', en: 'Unpaid' },
  PAID: { fa: 'پرداخت شده', en: 'Paid' },
  FAILED: { fa: 'ناموفق', en: 'Failed' },
  REFUNDED: { fa: 'بازگشت داده شد', en: 'Refunded' },
};

export const STAFF_ROLE_LABELS: Record<StaffRole, Labels> = {
  OWNER: { fa: 'مدیر کل', en: 'Owner' },
  MANAGER: { fa: 'مدیر شعبه', en: 'Branch manager' },
  BARISTA: { fa: 'بار', en: 'Barista' },
};
