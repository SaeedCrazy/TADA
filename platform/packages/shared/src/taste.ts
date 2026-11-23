// The Tada taste engine: a short quiz builds a taste profile, and products are scored against it.
// Pure functions, so the API, the web app and the tests all get the same answer.

export const TASTE_NOTES = [
  'chocolate', 'nutty', 'caramel', 'fruity', 'citrus', 'floral', 'earthy', 'vanilla', 'spicy', 'creamy',
] as const;
export type TasteNote = (typeof TASTE_NOTES)[number];

export const NOTE_LABELS: Record<TasteNote, { fa: string; en: string }> = {
  chocolate: { fa: 'شکلاتی', en: 'chocolatey' },
  nutty: { fa: 'مغزدار', en: 'nutty' },
  caramel: { fa: 'کاراملی', en: 'caramel' },
  fruity: { fa: 'میوه‌ای', en: 'fruity' },
  citrus: { fa: 'مرکباتی', en: 'citrus' },
  floral: { fa: 'گلی', en: 'floral' },
  earthy: { fa: 'علفی و خاکی', en: 'earthy' },
  vanilla: { fa: 'وانیلی', en: 'vanilla' },
  spicy: { fa: 'ادویه‌ای', en: 'spiced' },
  creamy: { fa: 'خامه‌ای', en: 'creamy' },
};

export type Temperature = 'HOT' | 'ICED' | 'BOTH';
export type ProductKind = 'DRINK' | 'FOOD' | 'PACKAGED';

/** Stored on each product. Scales run 0 (none) to 5 (a lot). */
export interface TasteAttributes {
  sweetness: number;
  bitterness: number;
  acidity: number;
  body: number;
  caffeine: number;
  milk: boolean;
  temperature: Temperature;
  notes: string[];
}

/** What a customer likes. Every field is optional: unknown means "no preference". */
export interface TasteProfile {
  sweetness?: number;
  bitterness?: number;
  acidity?: number;
  body?: number;
  caffeine?: number;
  milk?: 'yes' | 'no' | 'any';
  temperature?: 'HOT' | 'ICED' | 'any';
  notes?: string[];
}

export interface QuizOption {
  id: string;
  fa: string;
  en: string;
  set: TasteProfile;
}

export interface QuizQuestion {
  id: string;
  fa: string;
  en: string;
  multi?: boolean;
  options: QuizOption[];
}

export const TASTE_QUIZ: QuizQuestion[] = [
  {
    id: 'mood',
    fa: 'الان دنبال چه حسی هستید؟',
    en: 'What are you in the mood for?',
    options: [
      { id: 'wake', fa: 'بیدار شدن', en: 'Waking up', set: { caffeine: 5, body: 4 } },
      { id: 'calm', fa: 'یک چیز آرام', en: 'Something calm', set: { caffeine: 1, body: 2 } },
      { id: 'treat', fa: 'یک دلبری شیرین', en: 'A sweet treat', set: { sweetness: 4 } },
      { id: 'fresh', fa: 'خنک و سرحال', en: 'Cool and fresh', set: { temperature: 'ICED', acidity: 3 } },
    ],
  },
  {
    id: 'taste',
    fa: 'شیرین یا تلخ؟',
    en: 'Sweet or bitter?',
    options: [
      { id: 'sweet', fa: 'شیرین', en: 'Sweet', set: { sweetness: 4, bitterness: 1 } },
      { id: 'balanced', fa: 'متعادل', en: 'Balanced', set: { sweetness: 2, bitterness: 2 } },
      { id: 'bitter', fa: 'تلخ و پررنگ', en: 'Bold and bitter', set: { sweetness: 0, bitterness: 4 } },
    ],
  },
  {
    id: 'milk',
    fa: 'با شیر یا بی‌شیر؟',
    en: 'With milk or without?',
    options: [
      { id: 'milk', fa: 'با شیر', en: 'With milk', set: { milk: 'yes' } },
      { id: 'black', fa: 'بی‌شیر', en: 'No milk', set: { milk: 'no' } },
      { id: 'any', fa: 'فرقی نمی‌کند', en: 'Either', set: { milk: 'any' } },
    ],
  },
  {
    id: 'temperature',
    fa: 'گرم یا خنک؟',
    en: 'Hot or iced?',
    options: [
      { id: 'hot', fa: 'گرم', en: 'Hot', set: { temperature: 'HOT' } },
      { id: 'iced', fa: 'خنک', en: 'Iced', set: { temperature: 'ICED' } },
      { id: 'any', fa: 'فرقی نمی‌کند', en: 'Either', set: { temperature: 'any' } },
    ],
  },
  {
    id: 'notes',
    fa: 'کدام طعم‌ها را دوست دارید؟',
    en: 'Which flavors do you like?',
    multi: true,
    options: [
      { id: 'choco', fa: 'شکلاتی و مغزدار', en: 'Chocolate and nuts', set: { notes: ['chocolate', 'nutty', 'caramel'] } },
      { id: 'fruit', fa: 'میوه‌ای و مرکباتی', en: 'Fruity and citrus', set: { notes: ['fruity', 'citrus', 'floral'] } },
      { id: 'green', fa: 'علفی، مثل ماچا', en: 'Earthy, like matcha', set: { notes: ['earthy'] } },
      { id: 'soft', fa: 'وانیلی و خامه‌ای', en: 'Vanilla and creamy', set: { notes: ['vanilla', 'creamy'] } },
    ],
  },
];

const NUMERIC_KEYS = ['sweetness', 'bitterness', 'acidity', 'body', 'caffeine'] as const;
const clamp = (n: number) => Math.max(0, Math.min(5, n));

/** Builds a profile from quiz answers ({ questionId: optionId | optionId[] }). Unknown ids are ignored. */
export function profileFromAnswers(answers: Record<string, string | string[]>): TasteProfile {
  const profile: TasteProfile = {};
  for (const q of TASTE_QUIZ) {
    const raw = answers[q.id];
    if (raw === undefined) continue;
    const ids = Array.isArray(raw) ? raw : [raw];
    for (const id of ids) {
      const opt = q.options.find((o) => o.id === id);
      if (!opt) continue;
      mergeProfile(profile, opt.set);
    }
  }
  return profile;
}

/** Later values win for scales and choices; notes accumulate. */
export function mergeProfile(into: TasteProfile, from: TasteProfile): TasteProfile {
  for (const k of NUMERIC_KEYS) {
    const v = from[k];
    if (typeof v === 'number' && Number.isFinite(v)) into[k] = clamp(v);
  }
  if (from.milk) into.milk = from.milk;
  if (from.temperature) into.temperature = from.temperature;
  if (from.notes?.length) {
    const set = new Set([...(into.notes ?? []), ...from.notes.filter((n) => (TASTE_NOTES as readonly string[]).includes(n))]);
    into.notes = [...set];
  }
  return into;
}

export type ReasonKey =
  | 'sweet' | 'notSweet' | 'bitter' | 'gentle' | 'strong' | 'lowCaffeine'
  | 'milk' | 'noMilk' | 'iced' | 'hot' | `note:${string}`;

export interface Scored<T> {
  item: T;
  score: number;
  reasons: ReasonKey[];
}

const WEIGHTS: Record<(typeof NUMERIC_KEYS)[number], number> = {
  sweetness: 6, bitterness: 6, caffeine: 5, acidity: 3, body: 3,
};

/** 0..100-ish; higher is a better match. Deterministic. */
export function scoreTaste(attrs: TasteAttributes, profile: TasteProfile): { score: number; reasons: ReasonKey[] } {
  let score = 100;
  const reasons: ReasonKey[] = [];

  for (const k of NUMERIC_KEYS) {
    const want = profile[k];
    if (want === undefined) continue;
    const diff = Math.abs(clamp(attrs[k]) - want);
    score -= diff * WEIGHTS[k];
    if (diff <= 1) {
      if (k === 'sweetness') reasons.push(want >= 3 ? 'sweet' : 'notSweet');
      if (k === 'bitterness' && want >= 3) reasons.push('bitter');
      if (k === 'caffeine') reasons.push(want >= 4 ? 'strong' : want <= 1 ? 'lowCaffeine' : 'gentle');
    }
  }

  if (profile.milk === 'yes') {
    if (attrs.milk) { score += 5; reasons.push('milk'); } else score -= 15;
  } else if (profile.milk === 'no') {
    if (!attrs.milk) { score += 5; reasons.push('noMilk'); } else score -= 15;
  }

  if (profile.temperature === 'HOT') {
    if (attrs.temperature === 'ICED') score -= 30;
    else { score += 5; reasons.push('hot'); }
  } else if (profile.temperature === 'ICED') {
    if (attrs.temperature === 'HOT') score -= 30;
    else { score += 5; reasons.push('iced'); }
  }

  if (profile.notes?.length) {
    const hits = attrs.notes.filter((n) => profile.notes!.includes(n));
    score += Math.min(hits.length, 3) * 8;
    for (const n of hits.slice(0, 2)) reasons.push(`note:${n}`);
  }

  return { score: Math.round(score * 10) / 10, reasons: [...new Set(reasons)] };
}

export interface Recommendable {
  id: string;
  name: string;
  kind: ProductKind;
  taste: TasteAttributes | null;
}

/** Top drinks for a profile, plus one food pairing when there is a good one. */
export function recommend<T extends Recommendable>(
  products: T[],
  profile: TasteProfile,
  limit = 3,
): { picks: Scored<T>[]; pairing: T | null } {
  const drinks = products
    .filter((p) => p.kind === 'DRINK' && p.taste)
    .map((p) => ({ item: p, ...scoreTaste(p.taste!, profile) }))
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  const picks = drinks.slice(0, Math.max(1, limit));

  const foods = products.filter((p) => p.kind === 'FOOD');
  let pairing: T | null = null;
  if (foods.length) {
    const wantsSweet = (profile.sweetness ?? 2) >= 3;
    pairing = [...foods].sort((a, b) => {
      const sa = (a.taste?.sweetness ?? 2) >= 3 ? 1 : 0;
      const sb = (b.taste?.sweetness ?? 2) >= 3 ? 1 : 0;
      const pa = wantsSweet ? sa : 1 - sa;
      const pb = wantsSweet ? sb : 1 - sb;
      return pb - pa || a.name.localeCompare(b.name);
    })[0] ?? null;
  }
  return { picks, pairing };
}

const REASON_TEXT: Record<Exclude<ReasonKey, `note:${string}`>, { fa: string; en: string }> = {
  sweet: { fa: 'شیرینی‌اش همان‌قدر است که دوست دارید', en: 'as sweet as you like it' },
  notSweet: { fa: 'شیرینی کم و ملایم', en: 'gently sweet' },
  bitter: { fa: 'تلخ و پررنگ، همان‌طور که خواستید', en: 'bold and bitter, as you asked' },
  gentle: { fa: 'کافئین متعادل', en: 'a moderate kick' },
  strong: { fa: 'کافئین کافی برای بیدار شدن', en: 'enough caffeine to wake you up' },
  lowCaffeine: { fa: 'آرام و کم‌کافئین', en: 'calm and low in caffeine' },
  milk: { fa: 'با شیر', en: 'with milk' },
  noMilk: { fa: 'بدون شیر', en: 'no milk' },
  iced: { fa: 'خنک و یخ‌دار', en: 'served iced' },
  hot: { fa: 'گرم', en: 'served hot' },
};

export function reasonText(reason: ReasonKey, locale: 'fa' | 'en'): string {
  if (reason.startsWith('note:')) {
    const note = reason.slice(5) as TasteNote;
    const label = NOTE_LABELS[note]?.[locale] ?? note;
    return locale === 'fa' ? `نُت‌های ${label}` : `${label} notes`;
  }
  return REASON_TEXT[reason as Exclude<ReasonKey, `note:${string}`>][locale];
}
