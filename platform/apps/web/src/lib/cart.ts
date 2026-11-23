'use client';
// The cart lives in the browser (localStorage) and is priced by the API at checkout.
// Unit prices kept here are only for display; the server recomputes every total.
import { useSyncExternalStore } from 'react';

export interface CartLine {
  key: string;
  productId: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  art: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  optionIds: string[];
  optionsFa: string[];
  optionsEn: string[];
  note?: string;
}

export interface TableContext { token: string; number: number; branchId: string; branchFa: string; branchEn: string; at: number }

export interface CartState {
  lines: CartLine[];
  branchId: string | null;
  table: TableContext | null;
  discountCode: string;
}

const KEY = 'tada.cart.v1';
const TABLE_TTL = 4 * 3600_000;
const empty: CartState = { lines: [], branchId: null, table: null, discountCode: '' };

let state: CartState = empty;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CartState;
      state = { ...empty, ...parsed, lines: Array.isArray(parsed.lines) ? parsed.lines.slice(0, 30) : [] };
      if (state.table && Date.now() - state.table.at > TABLE_TTL) state = { ...state, table: null };
    }
  } catch {
    state = empty;
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    listeners.forEach((l) => l());
  });
}

function save(next: CartState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode or full storage: the cart still works for this page view
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => {
  load();
  return state;
};
const serverSnapshot = () => empty;

export function useCart() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

const lineKey = (productId: string, optionIds: string[], note?: string) => `${productId}|${[...optionIds].sort().join(',')}|${note ?? ''}`;

export const cart = {
  get: snapshot,
  add(line: Omit<CartLine, 'key'>) {
    const key = lineKey(line.productId, line.optionIds, line.note);
    const lines = [...state.lines];
    const i = lines.findIndex((l) => l.key === key);
    if (i >= 0) lines[i] = { ...lines[i]!, quantity: Math.min(20, lines[i]!.quantity + line.quantity) };
    else lines.push({ ...line, key });
    save({ ...state, lines });
  },
  setQty(key: string, quantity: number) {
    const lines = state.lines
      .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, Math.min(20, quantity)) } : l))
      .filter((l) => l.quantity > 0);
    save({ ...state, lines });
  },
  remove(key: string) {
    save({ ...state, lines: state.lines.filter((l) => l.key !== key) });
  },
  clear() {
    save({ ...state, lines: [], discountCode: '' });
  },
  setBranch(branchId: string | null) {
    save({ ...state, branchId });
  },
  setTable(table: Omit<TableContext, 'at'> | null) {
    save({ ...state, table: table ? { ...table, at: Date.now() } : null, ...(table ? { branchId: table.branchId } : {}) });
  },
  setDiscount(code: string) {
    save({ ...state, discountCode: code.trim().toUpperCase().slice(0, 32) });
  },
  count: (s: CartState) => s.lines.reduce((n, l) => n + l.quantity, 0),
  estimate: (s: CartState) => s.lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0),
  items: (s: CartState) => s.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, optionIds: l.optionIds, ...(l.note ? { note: l.note } : {}) })),
};
