import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, createTestApp, loginCustomer, type TestEnv } from './helpers.js';
import { profileFromText } from '../modules/assistant/engine.js';
import type { LlmClient, LlmMessage, LlmReply } from '../modules/assistant/llm.js';

describe('keyword understanding', () => {
  it('tells milk from sweet in Persian', () => {
    expect(profileFromText('یک چیز شیرین').delta).toMatchObject({ sweetness: 4 });
    expect(profileFromText('یک چیز شیرین').delta.milk).toBeUndefined();
    expect(profileFromText('با شیر لطفاً').delta.milk).toBe('yes');
    expect(profileFromText('بدون شیر و تلخ').delta).toMatchObject({ milk: 'no', bitterness: 4 });
  });
  it('reads English on word boundaries', () => {
    expect(profileFromText('show me a photo').delta.temperature).toBeUndefined();
    expect(profileFromText('something hot please').delta.temperature).toBe('HOT');
    expect(profileFromText('iced and sweet').delta).toMatchObject({ temperature: 'ICED', sweetness: 4 });
    expect(profileFromText('what are your hours?').intents.has('hours')).toBe(true);
  });
});

describe('guided assistant', () => {
  let env: TestEnv;
  beforeAll(async () => { env = await createTestApp(); });
  afterAll(async () => { await env.close(); });

  it('serves the quiz and recommends from answers', async () => {
    const c = new Client(env.app);
    const quiz = await c.get('/api/assistant/quiz');
    expect(quiz.body.mode).toBe('guided');
    expect(quiz.body.quiz.map((q: { id: string }) => q.id)).toEqual(['mood', 'taste', 'milk', 'temperature', 'notes']);
    const r = await c.post('/api/assistant/recommend', { answers: { mood: 'wake', taste: 'bitter', milk: 'black', temperature: 'hot' } });
    expect(r.status).toBe(200);
    // Strong, bitter, black and hot: the black coffees lead and nothing milky makes the list.
    expect(['americano', 'espresso']).toContain(r.body.picks[0].product.slug);
    expect(r.body.picks.every((p: { product: { taste: { milk: boolean } } }) => p.product.taste.milk === false)).toBe(true);
    expect(r.body.picks[0].reasons.length).toBeGreaterThan(0);
    expect(r.body.saved).toBe(false);
  });

  it('recommends only what the branch has', async () => {
    const branch = await env.db.branch.findUniqueOrThrow({ where: { slug: 'mollasadra' } });
    const espresso = await env.db.product.findUniqueOrThrow({ where: { slug: 'espresso' } });
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: branch.id, productId: espresso.id } }, data: { isAvailable: false } });
    const r = await new Client(env.app).post('/api/assistant/recommend', { answers: { mood: 'wake', taste: 'bitter', milk: 'black', temperature: 'hot' }, branchId: branch.id });
    expect(r.body.picks.map((p: { product: { slug: string } }) => p.product.slug)).not.toContain('espresso');
    expect(r.body.picks.length).toBeGreaterThan(0);
    await env.db.branchProduct.update({ where: { branchId_productId: { branchId: branch.id, productId: espresso.id } }, data: { isAvailable: true } });
  });

  it('saves the taste profile only with consent', async () => {
    const c = await loginCustomer(env.app, '09123330000');
    await c.post('/api/assistant/recommend', { answers: { taste: 'sweet' }, save: true });
    expect((await env.db.customer.findUniqueOrThrow({ where: { phone: '09123330000' } })).tasteProfile).toBeNull();
    await c.patch('/api/me', { tasteConsent: true });
    const r = await c.post('/api/assistant/recommend', { answers: { taste: 'sweet' }, save: true });
    expect(r.body.saved).toBe(true);
    expect((await env.db.customer.findUniqueOrThrow({ where: { phone: '09123330000' } })).tasteProfile).toMatchObject({ sweetness: 4 });
    // Withdrawing consent forgets it.
    await c.patch('/api/me', { tasteConsent: false });
    expect((await env.db.customer.findUniqueOrThrow({ where: { phone: '09123330000' } })).tasteProfile).toBeNull();
  });

  it('chats in guided mode and keeps the conversation private to its key', async () => {
    const c = new Client(env.app);
    const first = await c.post('/api/assistant/chat', { message: 'سلام، یک نوشیدنی خنک و شیرین با شیر می‌خوام', locale: 'fa' });
    expect(first.status).toBe(200);
    expect(first.body.clientKey).toBeTruthy();
    expect(first.body.reply.mode).toBe('guided');
    expect(first.body.reply.picks[0].product.slug).toBe('ube-latte');
    const id = first.body.conversationId;

    const next = await c.post('/api/assistant/chat', { conversationId: id, message: 'ساعت کاری؟', locale: 'fa' }, { 'x-conversation-key': first.body.clientKey });
    expect(next.status).toBe(200);
    expect(next.body.reply.text).toContain('ملاصدرا');

    const stranger = await new Client(env.app).post('/api/assistant/chat', { conversationId: id, message: 'hi', locale: 'en' }, { 'x-conversation-key': 'x'.repeat(32) });
    expect(stranger.status).toBe(404);
    expect(await env.db.message.count({ where: { conversationId: id } })).toBe(4);
  });

  it('can be switched off by the owner', async () => {
    await env.db.setting.upsert({ where: { key: 'assistantEnabled' }, create: { key: 'assistantEnabled', value: false }, update: { value: false } });
    expect((await new Client(env.app).get('/api/assistant/quiz')).status).toBe(503);
    await env.db.setting.delete({ where: { key: 'assistantEnabled' } });
  });
});

/** A scripted model: asks for recommendations, then proposes a cart, then answers. */
class ScriptedLlm implements LlmClient {
  calls: LlmMessage[][] = [];
  constructor(private steps: ((msgs: LlmMessage[]) => LlmReply)[]) {}
  async chat(messages: LlmMessage[]): Promise<LlmReply> {
    this.calls.push(messages);
    const step = this.steps[this.calls.length - 1];
    if (!step) throw new Error('no more steps');
    return step(messages);
  }
}

describe('LLM assistant', () => {
  it('uses tools for facts and only proposes a cart', async () => {
    let latteId = '';
    const llm = new ScriptedLlm([
      () => ({ content: null, toolCalls: [{ id: 'c1', name: 'recommend', arguments: JSON.stringify({ milk: 'yes', temperature: 'HOT', sweetness: 1 }) }] }),
      (msgs) => {
        const tool = msgs.at(-1) as { role: 'tool'; content: string };
        const picks = JSON.parse(tool.content).picks as { id: string }[];
        latteId = picks[0]!.id;
        return { content: null, toolCalls: [{ id: 'c2', name: 'propose_cart', arguments: JSON.stringify({ items: [{ productId: latteId, quantity: 2 }, { productId: 'not-a-real-id', quantity: 1 }] }) }] };
      },
      () => ({ content: 'یک لاته‌ی گرم برایتان گذاشتم؛ اگر خواستید به سبد اضافه کنید.', toolCalls: [] }),
    ]);
    const env = await createTestApp({}, { llm });
    try {
      const r = await new Client(env.app).post('/api/assistant/chat', { message: 'یک چیز گرم با شیر، دو تا', locale: 'fa' });
      expect(r.status).toBe(200);
      expect(r.body.reply.mode).toBe('llm');
      expect(r.body.reply.text).toContain('لاته');
      expect(r.body.reply.proposedCart).toHaveLength(1); // the invented id was dropped
      expect(r.body.reply.proposedCart[0]).toMatchObject({ productId: latteId, quantity: 2 });
      expect(r.body.reply.proposedCart[0].optionIds.length).toBeGreaterThan(0); // required groups get defaults
      expect((llm.calls[0]![0] as { content: string }).content).toContain('هرگز نگو سفارش ثبت');
      // Nothing was ordered by the assistant.
      expect(await env.db.order.count()).toBe(0);
    } finally {
      await env.close();
    }
  });

  it('falls back to guided mode when the model fails', async () => {
    const env = await createTestApp({}, { llm: new ScriptedLlm([]) });
    try {
      const r = await new Client(env.app).post('/api/assistant/chat', { message: 'something sweet and iced', locale: 'en' });
      expect(r.status).toBe(200);
      expect(r.body.reply.mode).toBe('guided');
      expect(r.body.reply.picks.length).toBeGreaterThan(0);
    } finally {
      await env.close();
    }
  });
});
