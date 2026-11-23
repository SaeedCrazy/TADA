// Digits, money and phone helpers shared by the API and the web app.
// Money is stored and computed as integer rials everywhere; it is shown to people in toman.

export type Locale = 'fa' | 'en';

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Persian and Arabic-Indic digits to ASCII digits. */
export function toLatinDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa >= 0) { out += String(fa); continue; }
    const ar = AR_DIGITS.indexOf(ch);
    if (ar >= 0) { out += String(ar); continue; }
    out += ch;
  }
  return out;
}

/** ASCII digits to Persian digits. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!);
}

export function localizeDigits(input: string | number, locale: Locale): string {
  return locale === 'fa' ? toPersianDigits(input) : String(input);
}

export const RIALS_PER_TOMAN = 10;

export function rialToToman(rial: number): number {
  return Math.round(rial / RIALS_PER_TOMAN);
}

export function tomanToRial(toman: number): number {
  return Math.round(toman * RIALS_PER_TOMAN);
}

/** Groups thousands with the Persian separator (٬) or a comma. */
export function groupThousands(n: number, locale: Locale): string {
  const sign = n < 0 ? '-' : '';
  const s = String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'fa' ? '٬' : ',');
  return sign + localizeDigits(s, locale);
}

/** 1250000 rial -> "۱۲۵٬۰۰۰ تومان" / "125,000 Toman". */
export function formatToman(rial: number, locale: Locale = 'fa'): string {
  const t = groupThousands(rialToToman(rial), locale);
  return locale === 'fa' ? `${t} تومان` : `${t} Toman`;
}

/**
 * Normalizes an Iranian mobile number to 09XXXXXXXXX.
 * Accepts Persian digits, spaces, dashes, +98, 0098, 98 and 9XXXXXXXXX. Returns null when invalid.
 */
export function normalizeIranMobile(input: string): string | null {
  if (typeof input !== 'string') return null;
  let s = toLatinDigits(input).replace(/[\s\-()]/g, '');
  if (s.startsWith('+98')) s = '0' + s.slice(3);
  else if (s.startsWith('0098')) s = '0' + s.slice(4);
  else if (s.startsWith('98') && s.length === 12) s = '0' + s.slice(2);
  else if (s.startsWith('9') && s.length === 10) s = '0' + s;
  return /^09\d{9}$/.test(s) ? s : null;
}

/** 09121234567 -> 0912***4567 for logs and staff screens. */
export function maskMobile(phone: string): string {
  return phone.length === 11 ? `${phone.slice(0, 4)}***${phone.slice(7)}` : '***';
}
