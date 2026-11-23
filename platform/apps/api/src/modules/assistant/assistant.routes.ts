import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  TASTE_QUIZ, chatMessageSchema, quizAnswerSchema, profileFromAnswers, mergeProfile, tasteProfileSchema,
  type TasteProfile, type Locale,
} from '@tada/shared';
import { Prisma } from '../../db.js';
import { AppError, notFound } from '../../lib/errors.js';
import { parse, randomToken, safeEqualHex, sha256 } from '../../lib/util.js';
import { guidedReply, llmReply, picksFor, availableProducts, type AssistantReply } from './engine.js';

const KEY_HEADER = 'x-conversation-key';

export default async function assistantRoutes(app: FastifyInstance) {
  const { ctx } = app;
  const { db } = ctx;

  async function ensureEnabled() {
    const s = await db.setting.findUnique({ where: { key: 'assistantEnabled' } });
    if (s && s.value === false) throw new AppError(503, 'assistant_disabled');
  }

  async function storedProfile(req: FastifyRequest): Promise<TasteProfile> {
    if (!req.customer) return {};
    const c = await db.customer.findUnique({ where: { id: req.customer.id }, select: { tasteConsent: true, tasteProfile: true } });
    if (!c?.tasteConsent || !c.tasteProfile) return {};
    const p = tasteProfileSchema.safeParse(c.tasteProfile);
    return p.success ? p.data : {};
  }

  async function saveProfile(req: FastifyRequest, profile: TasteProfile) {
    if (!req.customer) return false;
    const c = await db.customer.findUnique({ where: { id: req.customer.id }, select: { tasteConsent: true } });
    if (!c?.tasteConsent) return false;
    await db.customer.update({ where: { id: req.customer.id }, data: { tasteProfile: profile as Prisma.InputJsonValue } });
    return true;
  }

  /** Loads a conversation the caller may continue: their own (customer) or one whose key they hold (guest). */
  async function loadConversation(req: FastifyRequest, id: string) {
    const conv = await db.conversation.findUnique({ where: { id } });
    if (!conv) throw notFound('conversation_not_found');
    const key = String(req.headers[KEY_HEADER] ?? '');
    const ownByCustomer = req.customer && conv.customerId === req.customer.id;
    const ownByKey = key.length >= 16 && safeEqualHex(conv.clientKey, sha256(key));
    if (!ownByCustomer && !ownByKey) throw notFound('conversation_not_found');
    return conv;
  }

  function present(reply: AssistantReply) {
    return { text: reply.text, picks: reply.picks, pairing: reply.pairing, proposedCart: reply.proposedCart, quickReplies: reply.quickReplies, mode: reply.mode };
  }

  app.get('/assistant/quiz', async () => {
    await ensureEnabled();
    return { quiz: TASTE_QUIZ, mode: ctx.llm ? 'llm' : 'guided' };
  });

  app.post('/assistant/recommend', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    await ensureEnabled();
    const { answers, branchId, save } = parse(quizAnswerSchema, req.body);
    const locale: Locale = (req.headers['accept-language'] ?? '').toString().startsWith('en') ? 'en' : 'fa';
    const profile = mergeProfile(await storedProfile(req), profileFromAnswers(answers));
    const { picks, pairing } = picksFor(await availableProducts(ctx, branchId), profile, locale);
    const saved = save ? await saveProfile(req, profile) : false;
    return { profile, picks, pairing, saved };
  });

  /** Personal picks for a returning customer: taste profile plus what they order most. */
  app.get('/assistant/for-me', async (req) => {
    await ensureEnabled();
    const { branchId } = parse(z.object({ branchId: z.uuid().optional() }), req.query);
    if (!req.customer) return { picks: [], favorites: [] };
    const locale: Locale = (req.headers['accept-language'] ?? '').toString().startsWith('en') ? 'en' : 'fa';
    const products = await availableProducts(ctx, branchId);
    const profile = await storedProfile(req);
    const fav = await db.orderItem.groupBy({
      by: ['productId'],
      where: { order: { customerId: req.customer.id, paymentStatus: 'PAID' } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 3,
    });
    const favorites = fav.map((f) => products.find((p) => p.id === f.productId)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const picks = Object.keys(profile).length ? picksFor(products, profile, locale).picks : [];
    return { picks, favorites, profile };
  });

  app.post('/assistant/chat', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    await ensureEnabled();
    const input = parse(chatMessageSchema, req.body);
    let clientKey: string | null = null;
    let conv = input.conversationId ? await loadConversation(req, input.conversationId) : null;
    if (!conv) {
      clientKey = randomToken(24);
      conv = await db.conversation.create({
        data: { customerId: req.customer?.id ?? null, branchId: input.branchId ?? null, clientKey: sha256(clientKey), locale: input.locale, mode: ctx.llm ? 'llm' : 'guided' },
      });
    }
    const count = await db.message.count({ where: { conversationId: conv.id } });
    if (count >= 80) throw new AppError(429, 'conversation_too_long');

    const profileRaw = tasteProfileSchema.safeParse(conv.profile ?? {});
    const profile = mergeProfile(await storedProfile(req), profileRaw.success ? profileRaw.data : {});
    await db.message.create({ data: { conversationId: conv.id, role: 'user', content: input.message } });

    let reply: AssistantReply;
    if (ctx.llm) {
      try {
        const history = await db.message.findMany({
          where: { conversationId: conv.id, role: { in: ['user', 'assistant'] } },
          orderBy: { createdAt: 'asc' },
          select: { role: true, content: true },
        });
        reply = await llmReply(ctx, history as { role: 'user' | 'assistant'; content: string }[], profile, input.locale, input.branchId);
      } catch (err) {
        req.log.warn({ err }, 'llm failed, using guided mode');
        reply = await guidedReply(ctx, input.message, profile, input.locale, input.branchId);
      }
    } else {
      reply = await guidedReply(ctx, input.message, profile, input.locale, input.branchId);
    }

    await db.message.create({
      data: {
        conversationId: conv.id,
        role: 'assistant',
        content: reply.text,
        data: { picks: reply.picks.map((p) => p.product.id), proposedCart: reply.proposedCart, mode: reply.mode } as unknown as Prisma.InputJsonValue,
      },
    });
    await db.conversation.update({ where: { id: conv.id }, data: { profile: reply.profile as Prisma.InputJsonValue } });
    return { conversationId: conv.id, ...(clientKey ? { clientKey } : {}), reply: present(reply) };
  });
}
