---
name: tada-assistant
description: The Tada assistant — taste quiz, taste engine scoring, guided keyword chat, and LLM chat with tools. Use when changing recommendations, adding taste notes or keywords, editing the assistant's voice or safety rules, connecting a language model, or reviewing conversations.
---

# Tada assistant

## Pieces
- `packages/shared/src/taste.ts`: quiz (`TASTE_QUIZ`), `profileFromAnswers`, `scoreTaste`, `recommend`,
  reason texts. Pure and deterministic — unit-tested in `shared.test.ts`.
- Product taste attributes (0..5 sweetness, bitterness, acidity, body, caffeine; milk; HOT/ICED/BOTH; notes)
  are edited per product in the admin menu editor. Packaged goods have none.
- `apps/api/src/modules/assistant/engine.ts`:
  - `guidedReply`: keyword understanding in Persian and English → profile delta → `recommend`.
    Persian pitfall: «شیر» (milk) must not match inside «شیرین» (sweet); English words match on word boundaries.
  - `llmReply`: OpenAI-compatible chat with tools `get_menu`, `recommend`, `get_branches`, `propose_cart`.
- Routes: `/api/assistant/quiz|recommend|chat|for-me`; conversations reviewed at `/admin/assistant`.

## Rules that must hold
- Recommend only products **available at the selected branch**.
- The assistant never places orders or takes payment; `propose_cart` returns lines the customer adds
  themselves. Product ids from the model are checked against the menu; unknown ids are dropped.
- Names, prices and availability come from tools, never from the model's memory.
- Voice: warm, short (3–4 sentences), Persian by default. Serious allergies → ask the bar team.
- Taste profiles are saved only with the customer's consent; withdrawing consent deletes them.
- If the model errors or times out, fall back to guided mode silently.

## Changing behaviour
- New flavor note: add to `TASTE_NOTES` and `NOTE_LABELS`, then to quiz options or keywords, then tag products.
- New keywords: extend `profileFromText` and add a case to `src/test/assistant.test.ts`.
- New tool: add to `TOOLS`, handle in `runTool`, keep results small, add a scripted-LLM test.

## Model provider
`LLM_BASE_URL`/`LLM_MODEL`/`LLM_API_KEY` point at any OpenAI-compatible endpoint the business may legally use
(a self-hosted open model via vLLM or Ollama keeps customer data on the server). Without them the assistant
runs in guided mode with no external calls.
