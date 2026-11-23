// Shapes returned by the Tada API (see apps/api serializers).
import type { OpenState, OrderStatus, OrderType, PaymentMethod, PaymentStatus, TasteAttributes, ProductKind, HoursRange } from '@tada/shared';

export interface Branch {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  addressFa: string;
  addressEn: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  hours: HoursRange[];
  timezone: string;
  open: OpenState;
  acceptsOrders: boolean;
  delivery: { enabled: boolean; baseFee: number; perKm: number; maxKm: number; minOrder: number; freeAbove: number };
}

export interface Option { id: string; nameFa: string; nameEn: string; priceDelta: number; isDefault: boolean }
export interface OptionGroup { id: string; nameFa: string; nameEn: string; minSelect: number; maxSelect: number; options: Option[] }

export interface Product {
  id: string;
  slug: string;
  categoryId: string;
  kind: ProductKind;
  nameFa: string;
  nameEn: string;
  descFa: string;
  descEn: string;
  art: string | null;
  imageUrl: string | null;
  price: number;
  available: boolean;
  stock: number | null;
  isFeatured: boolean;
  allergens: string[];
  taste: TasteAttributes | null;
  optionGroups: OptionGroup[];
  category?: { slug: string; nameFa: string; nameEn: string };
}

export interface Category { id: string; slug: string; nameFa: string; nameEn: string; art: string | null }
export interface Menu { branchId: string | null; categories: Category[]; products: Product[] }

export interface QuoteLine {
  productId: string;
  nameFa: string;
  nameEn: string;
  quantity: number;
  unitPrice: number;
  options: { id: string; nameFa: string; nameEn: string; priceDelta: number }[];
  note: string | null;
  lineTotal: number;
}

export interface Quote {
  type: OrderType;
  branch: { id: string; slug: string; nameFa: string; nameEn: string };
  table: { number: number } | null;
  lines: QuoteLine[];
  subtotal: number;
  discount: { code: string; amount: number } | null;
  discountError: string | null;
  delivery: { distanceKm: number; fee: number } | null;
  total: number;
}

export interface Order {
  id: string;
  number: number;
  type: OrderType;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  branch: { id: string; slug: string; nameFa: string; nameEn: string; addressFa: string; addressEn: string; phone: string | null };
  table: { number: number; label: string | null } | null;
  items: (QuoteLine & { id: string })[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  customerName: string;
  customerPhone: string | null;
  addressText: string | null;
  location?: { lat: number; lng: number } | null;
  distanceKm: number | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
  events: { status: OrderStatus; note: string | null; createdAt: string }[];
  accessToken?: string;
  customerId?: string | null;
  payments?: { provider: string; amount: number; status: string; refId: string | null; cardPan: string | null; error: string | null; createdAt: string }[];
}

export interface Customer { id: string; phone: string; name: string | null; locale?: string; tasteConsent?: boolean; tasteProfile?: unknown }
export interface Address { id: string; title: string; line: string; lat: number; lng: number }

export interface Pick { product: Product; reasons: string[] }
export interface AssistantReply {
  text: string;
  picks: Pick[];
  pairing: Product | null;
  proposedCart: { productId: string; quantity: number; optionIds: string[] }[];
  quickReplies: string[];
  mode: 'guided' | 'llm';
}
