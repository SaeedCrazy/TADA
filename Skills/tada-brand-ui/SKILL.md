---
name: tada-brand-ui
description: Tada identity and UI rules for the shop, admin panel and bar screen. Use for any visual or copy change in platform/apps/web, new pages or components, colors, fonts, icons/illustrations, Persian/English text, RTL layout, or accessibility fixes.
---

# Tada brand and UI

The platform must look and read like the Tada website (repository root, branch `v2`): the designer's
night/lilac palette, the Doran typeface, the arch, and line illustrations cut from the mural.

## Tokens (platform/apps/web/src/styles/globals.css)

| Token | Value | Use |
|---|---|---|
| `--night` | #1C0727 | headers, hero, bar screen, dark cards |
| `--plum` | #35084C | headings |
| `--tada` | #662482 | primary actions, selected state, chart marks |
| `--mauve` | #926D8F | icons and large text only (4.36:1 on white) |
| `--mauve-ink` | #7A5677 | small muted text on white |
| `--lilac` / `--cream` / `--paper` | #EFE9F2 / #F6F0F8 / #FCFAFD | day surfaces |
| `--haze` | #C3ADCF | text on night, borders |
| `--soft` | #5E4A68 | secondary text |

Never introduce raw hex in components; add a token. Status colors (`--ok`, `--warn`, `--bad`) are for state only.

## Shapes and art

- The arch is the signature: `border-radius: 999px 999px 14px 14px` (`.arch`, product cards, tickets, quiz nodes).
- Illustrations: `<Art name="glass" />` (components/ui.tsx) renders `/public/art/<name>.svg` through a CSS mask,
  so it takes `color`. Names come from the mural (glass, glass2, icedCup, coffeeCup, cup, leaf, croissant,
  cookie, beans, kettle, teapot, lemon, scooter, map, hand, espresso…). Regenerate with
  `node apps/web/scripts/export-art.mjs`. Do not draw new icons in another style; use emoji never.
- Brand marks are in `public/brand/` (wordmarks, mark, pattern tile). Use them as images, unmodified.

## Type and language

- Font stack `Doran, Peyda, Tahoma`. Body 16px, line-height 1.75; headings 800 weight in `--plum`.
- Persian is the default locale (`/shop`), English at `/en/shop`. All copy lives in `src/lib/i18n.ts`;
  Persian is written natively, short and warm (the website's voice), never translated word for word.
- Numbers in Persian text use Persian digits: `toPersianDigits` / `localizeDigits` from `@tada/shared`.
  Money is stored in rials and shown in toman with `formatToman(rial, locale)`.
- Admin and bar screens are Persian only.

## Layout and interaction

- Logical properties only (`inset-inline-start`, `margin-inline-end`); test both `dir="rtl"` and `dir="ltr"`.
- Mobile first; touch targets ≥ 44px (`--tap`); bottom sheets on phones, dialogs on desktop (`<Sheet>`).
- Every form field has a visible `<label>`; errors appear next to the field; keep input after errors.
- Motion is short (≤ .45s) and respects `prefers-reduced-motion` (handled globally).
- Charts follow the dataviz rules (one hue `--tada`, thin marks, table view); see components/admin/charts.tsx.

## Before you ship UI

1. `pnpm --filter @tada/web e2e` — the suite runs axe (WCAG 2.1 AA, serious/critical must be empty).
2. Look at it: screenshot mobile (Pixel 7) and desktop; check RTL and English.
3. For general UX questions use `ui-ux-pro-max` (`python3 Skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux`)
   and `frontend-design`, but the Tada tokens above always win over generic palettes.
