// The Tada assistant. Two modes share one set of tools:
//  - guided: deterministic keyword understanding + the taste engine. Always available, no external service.
//  - llm: a chat model (OpenAI-compatible endpoint) that may call the same tools.
// The assistant can suggest and propose a cart, but only the customer can add it to the cart and pay.
import {
  mergeProfile, recommend, reasonText, openState, formatToman, type TasteProfile, type Locale,
} from '@tada/shared';
import type { AppContext } from '../../context.js';
import { branchHours, loadMenu, serializeBranch, type PublicProduct } from '../catalog/catalog.service.js';
import type { LlmMessage, LlmToolDef } from './llm.js';

export interface Pick { product: PublicProduct; reasons: string[] }
export interface ProposedLine { productId: string; quantity: number; optionIds: string[] }
export interface AssistantReply {
  text: string;
  picks: Pick[];
  pairing: PublicProduct | null;
  proposedCart: ProposedLine[];
  quickReplies: string[];
  profile: TasteProfile;
  mode: 'guided' | 'llm';
}

const t = (locale: Locale, fa: string, en: string) => (locale === 'fa' ? fa : en);

export async function availableProducts(ctx: AppContext, branchId?: string) {
  const menu = await loadMenu(ctx.db, branchId);
  return menu.products.filter((p) => p.available);
}

export function picksFor(products: PublicProduct[], profile: TasteProfile, locale: Locale, limit = 3) {
  const rec = recommend(products.map((p) => ({ ...p, name: p.nameEn })), profile, limit);
  return {
    picks: rec.picks.map((s) => ({ product: stripName(s.item), reasons: s.reasons.slice(0, 3).map((r) => reasonText(r, locale)) })),
    pairing: rec.pairing ? stripName(rec.pairing) : null,
  };
}

function stripName<T extends { name?: string }>(p: T): PublicProduct {
  const { name: _n, ...rest } = p as T & { name: string };
  return rest as unknown as PublicProduct;
}

// ------------------------------------------------------------------ guided mode

// English words match on word boundaries ("hot" must not match "photo"); Persian on substrings.
const has = (text: string, words: (string | RegExp)[]) =>
  words.some((w) => {
    if (w instanceof RegExp) return w.test(text);
    const word = w.trim();
    if (/^[\x20-\x7e]+$/.test(word)) return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text);
    return text.includes(word);
  });
// "شیر" (milk) must not match inside "شیرین" (sweet).
const MILK = /(^|[\s،,.!؟?])(با\s*)?شیر(?!ین)(دار)?([\s،,.!؟?]|$)|لاته|\bmilk\b|\blatte\b|\bmilky\b/;
const NO_MILK = /(بی|بدون)\s*شیر(?!ین)|\bno milk\b|\bblack\b|\bwithout milk\b/;

export function profileFromText(raw: string): { delta: TasteProfile; intents: Set<string> } {
  const text = ` ${raw.toLowerCase()} `;
  const delta: TasteProfile = {};
  const intents = new Set<string>();

  if (has(text, ['سلام', 'درود', 'hello', 'hi ', 'hey'])) intents.add('greet');
  if (has(text, ['ساعت', 'کی باز', 'باز است', 'بازه', 'تعطیل', 'hours', 'open', 'close'])) intents.add('hours');
  if (has(text, ['شعبه', 'آدرس', 'کجا', 'branch', 'address', 'where'])) intents.add('branches');
  if (has(text, ['آلرژی', 'حساسیت', 'گلوتن', 'لاکتوز', 'allerg', 'gluten', 'lactose', 'vegan'])) intents.add('allergy');
  if (has(text, ['منو', 'menu', 'چی دارید', 'چه دارید'])) intents.add('menu');

  if (has(text, ['شیرین', 'شکلات', 'کارامل', 'sweet', 'dessert', 'treat'])) Object.assign(delta, { sweetness: 4 });
  if (has(text, ['تلخ', 'قوی', 'پررنگ', 'غلیظ', 'bitter', 'strong', 'bold', 'espresso', 'اسپرسو'])) Object.assign(delta, { bitterness: 4, body: 4 });
  if (has(text, ['بیدار', 'انرژی', 'خسته', 'خوابم', 'wake', 'energy', 'tired', 'sleepy'])) Object.assign(delta, { caffeine: 5 });
  if (has(text, ['بی‌کافئین', 'بی کافئین', 'بدون کافئین', 'کافئین کم', 'decaf', 'no caffeine', 'caffeine free', 'آرام', 'calm'])) Object.assign(delta, { caffeine: 0 });
  if (has(text, ['سرد', 'خنک', 'یخ', 'گرمه', 'iced', 'cold', 'chilled', 'hot day'])) delta.temperature = 'ICED';
  else if (has(text, ['گرم', 'داغ', 'hot', 'warm'])) delta.temperature = 'HOT';
  if (NO_MILK.test(text)) delta.milk = 'no';
  else if (MILK.test(text)) delta.milk = 'yes';

  const notes: string[] = [];
  if (has(text, ['شکلات', 'فندق', 'مغز', 'کارامل', 'chocolate', 'nutty', 'hazelnut', 'caramel'])) notes.push('chocolate', 'nutty', 'caramel');
  if (has(text, ['میوه', 'ترش', 'مرکبات', 'لیمو', 'fruit', 'citrus', 'sour', 'lemon'])) { notes.push('fruity', 'citrus'); delta.acidity = 3; }
  if (has(text, ['ماچا', 'چای سبز', 'matcha', 'green tea'])) notes.push('earthy');
  if (has(text, ['وانیل', 'خامه', 'اوبه', 'vanilla', 'creamy', 'ube'])) notes.push('vanilla', 'creamy');
  if (notes.length) delta.notes = notes;

  if (Object.keys(delta).length) intents.add('taste');
  return { delta, intents };
}

async function branchesText(ctx: AppContext, locale: Locale) {
  const branches = await ctx.db.branch.findMany({ where: { isActive: true }, orderBy: { sort: 'asc' } });
  return branches
    .map((b) => {
      const s = openState(branchHours(b), new Date(), b.timezone);
      const name = locale === 'fa' ? b.nameFa : b.nameEn;
      const addr = locale === 'fa' ? b.addressFa : b.addressEn;
      const state = s.open
        ? t(locale, `باز تا ${s.closesAt}`, `open until ${s.closesAt}`)
        : t(locale, `بسته، ${s.tomorrow ? 'فردا ' : ''}${s.opensAt} باز می‌کنیم`, `closed, opens ${s.tomorrow ? 'tomorrow ' : ''}at ${s.opensAt}`);
      return `• ${name}: ${addr} (${state})`;
    })
    .join('\n');
}

export async function guidedReply(ctx: AppContext, message: string, profile: TasteProfile, locale: Locale, branchId?: string): Promise<AssistantReply> {
  const { delta, intents } = profileFromText(message);
  const next = mergeProfile({ ...profile, notes: [...(profile.notes ?? [])] }, delta);
  const products = await availableProducts(ctx, branchId);
  const quick = locale === 'fa'
    ? ['یک چیز شیرین و خنک', 'تلخ و قوی', 'بی‌کافئین', 'ساعت کاری']
    : ['Something sweet and iced', 'Bold and strong', 'No caffeine', 'Opening hours'];
  const parts: string[] = [];

  if (intents.has('hours') || intents.has('branches')) {
    parts.push(t(locale, 'شعبه‌های تادا:', 'Tada branches:'), await branchesText(ctx, locale));
  }
  if (intents.has('allergy')) {
    parts.push(t(locale,
      'برای حساسیت غذایی، لطفاً پیش از سفارش با همکاران پشت بار هماهنگ کنید؛ ترکیبات هر نوشیدنی را در صفحه‌ی همان محصول می‌بینید.',
      'For allergies, please check with the bar team before ordering; each product page lists its allergens.'));
  }

  let picks: Pick[] = [];
  let pairing: PublicProduct | null = null;
  if (intents.has('taste') || intents.has('menu') || (!intents.size && products.length)) {
    const r = picksFor(products, next, locale);
    picks = r.picks;
    pairing = r.pairing;
    if (picks.length) {
      parts.push(intents.has('taste')
        ? t(locale, 'از روی ذائقه‌تان، این‌ها را پیشنهاد می‌کنم:', "Going by your taste, here's what I'd pour:")
        : t(locale, 'چند پیشنهاد از منوی امروز:', "A few picks from today's menu:"));
      if (pairing) parts.push(t(locale, `و کنارش: ${pairing.nameFa}`, `And on the side: ${pairing.nameEn}`));
    } else {
      parts.push(t(locale, 'الان نوشیدنی آماده‌ای در این شعبه نداریم.', 'Nothing is available at this branch right now.'));
    }
  }
  if (intents.has('greet') && parts.length === 0) {
    parts.push(t(locale, 'سلام! به تادا خوش آمدید. بگویید چه حسی دارید، شیرین یا تلخ، گرم یا خنک؛ بقیه‌اش با من.',
      'Hi, welcome to Tada! Tell me what you feel like: sweet or bitter, hot or iced. I will do the rest.'));
  }
  if (!parts.length) {
    parts.push(t(locale, 'متوجه نشدم. مثلاً بگویید «یک چیز شیرین و خنک» یا «ساعت کاری».', 'I did not catch that. Try "something sweet and iced" or "opening hours".'));
  }
  return { text: parts.join('\n'), picks, pairing, proposedCart: [], quickReplies: quick, profile: next, mode: 'guided' };
}

// ------------------------------------------------------------------ llm mode

const SYSTEM_FA = `تو «دستیار تادا» هستی، هم‌صحبت کافه‌ی تادا لانژ. لحنت گرم، کوتاه و صمیمی است، مثل باریستایی که مشتری‌اش را می‌شناسد.
قوانین:
- فقط درباره‌ی تادا، منو، ذائقه، شعبه‌ها و سفارش صحبت کن. سؤال‌های بی‌ربط را مؤدبانه به منو برگردان.
- نام محصول، قیمت و موجودی را فقط از ابزارها بگیر؛ هرگز چیزی از خودت نساز.
- برای پیشنهاد، ابزار recommend را صدا بزن. اگر مشتری خواست سفارش بدهد، با propose_cart سبد پیشنهادی بساز؛ سفارش و پرداخت را خود مشتری تأیید می‌کند. هرگز نگو سفارش ثبت یا پرداخت شد.
- درباره‌ی حساسیت غذایی جدی، بگو با همکاران پشت بار هماهنگ کنند.
- جواب‌ها حداکثر سه چهار جمله، به فارسی.`;

const SYSTEM_EN = `You are the Tada assistant, the voice of Tada Lounge café. Warm, brief and friendly, like a barista who knows their regulars.
Rules:
- Talk only about Tada, the menu, taste, branches and ordering. Steer unrelated questions back to the menu.
- Product names, prices and availability come only from the tools; never invent any.
- Use the recommend tool for suggestions. If the customer wants to order, build a proposed cart with propose_cart; the customer confirms and pays themselves. Never say an order was placed or paid.
- For serious allergies, ask them to check with the bar team.
- Keep replies to three or four sentences, in English.`;

const TOOLS: LlmToolDef[] = [
  { name: 'get_menu', description: 'List the products available right now at the selected branch.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  {
    name: 'recommend',
    description: 'Recommend drinks for a taste profile. Scales are 0..5. Returns the top matches with reasons.',
    parameters: {
      type: 'object',
      properties: {
        sweetness: { type: 'number' }, bitterness: { type: 'number' }, caffeine: { type: 'number' }, acidity: { type: 'number' }, body: { type: 'number' },
        milk: { type: 'string', enum: ['yes', 'no', 'any'] },
        temperature: { type: 'string', enum: ['HOT', 'ICED', 'any'] },
        notes: { type: 'array', items: { type: 'string', enum: ['chocolate', 'nutty', 'caramel', 'fruity', 'citrus', 'floral', 'earthy', 'vanilla', 'spicy', 'creamy'] } },
      },
      additionalProperties: false,
    },
  },
  { name: 'get_branches', description: 'Tada branches with addresses and whether each is open now.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  {
    name: 'propose_cart',
    description: 'Propose a cart the customer can add with one tap. Use product ids from get_menu or recommend.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array', maxItems: 6,
          items: { type: 'object', properties: { productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 10 } }, required: ['productId', 'quantity'], additionalProperties: false },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
];

export async function llmReply(
  ctx: AppContext,
  history: { role: 'user' | 'assistant'; content: string }[],
  profile: TasteProfile,
  locale: Locale,
  branchId?: string,
): Promise<AssistantReply> {
  if (!ctx.llm) throw new Error('llm not configured');
  const products = await availableProducts(ctx, branchId);
  const byId = new Map(products.map((p) => [p.id, p]));
  let currentProfile = { ...profile };
  let picks: Pick[] = [];
  let pairing: PublicProduct | null = null;
  let proposedCart: ProposedLine[] = [];

  const messages: LlmMessage[] = [
    { role: 'system', content: locale === 'fa' ? SYSTEM_FA : SYSTEM_EN },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content }) as LlmMessage),
  ];

  const runTool = async (name: string, argsRaw: string): Promise<unknown> => {
    let args: Record<string, unknown> = {};
    try {
      args = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {};
    } catch {
      return { error: 'invalid_json' };
    }
    switch (name) {
      case 'get_menu':
        return products.map((p) => ({
          id: p.id, name: locale === 'fa' ? p.nameFa : p.nameEn, kind: p.kind, price: formatToman(p.price, locale),
          options: p.optionGroups.map((g) => (locale === 'fa' ? g.nameFa : g.nameEn)),
        }));
      case 'recommend': {
        currentProfile = mergeProfile({ ...currentProfile }, args as TasteProfile);
        const r = picksFor(products, currentProfile, locale);
        picks = r.picks;
        pairing = r.pairing;
        return {
          picks: r.picks.map((x) => ({ id: x.product.id, name: locale === 'fa' ? x.product.nameFa : x.product.nameEn, price: formatToman(x.product.price, locale), reasons: x.reasons })),
          pairing: r.pairing ? { id: r.pairing.id, name: locale === 'fa' ? r.pairing.nameFa : r.pairing.nameEn } : null,
        };
      }
      case 'get_branches':
        return (await ctx.db.branch.findMany({ where: { isActive: true } })).map((b) => {
          const s = serializeBranch(b);
          return { name: locale === 'fa' ? s.nameFa : s.nameEn, address: locale === 'fa' ? s.addressFa : s.addressEn, open: s.open };
        });
      case 'propose_cart': {
        const items = Array.isArray(args.items) ? (args.items as { productId?: unknown; quantity?: unknown }[]) : [];
        proposedCart = items
          .filter((i) => typeof i.productId === 'string' && byId.has(i.productId))
          .slice(0, 6)
          .map((i) => {
            const p = byId.get(i.productId as string)!;
            const defaults = p.optionGroups.flatMap((g) => (g.minSelect > 0 ? g.options.filter((o) => o.isDefault).slice(0, g.minSelect).map((o) => o.id) : []));
            return { productId: p.id, quantity: Math.max(1, Math.min(10, Number(i.quantity) || 1)), optionIds: defaults };
          });
        return { ok: true, items: proposedCart.length, note: 'The customer must confirm and pay in the app.' };
      }
      default:
        return { error: 'unknown_tool' };
    }
  };

  for (let i = 0; i < 4; i++) {
    const reply = await ctx.llm.chat(messages, TOOLS);
    if (!reply.toolCalls.length) {
      const text = (reply.content ?? '').trim().slice(0, 1200);
      return { text: text || t(locale, 'در خدمتم!', 'Happy to help!'), picks, pairing, proposedCart, quickReplies: [], profile: currentProfile, mode: 'llm' };
    }
    messages.push({
      role: 'assistant',
      content: reply.content,
      tool_calls: reply.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.arguments } })),
    });
    for (const call of reply.toolCalls.slice(0, 4)) {
      const result = await runTool(call.name, call.arguments);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, 6000) });
    }
  }
  return { text: t(locale, 'این‌ها را برایتان پیدا کردم:', 'Here is what I found:'), picks, pairing, proposedCart, quickReplies: [], profile: currentProfile, mode: 'llm' };
}
