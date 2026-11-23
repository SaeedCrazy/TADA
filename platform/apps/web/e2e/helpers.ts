import { expect, type Page, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const OTP = '11111';

export async function staffLogin(page: Page, username = 'owner', password = 'owner-e2e-password', next?: string) {
  await page.goto(`/admin/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  await page.getByLabel('نام کاربری').fill(username);
  await page.getByLabel('رمز عبور').fill(password);
  await page.getByRole('button', { name: 'ورود' }).click();
  if (password.length >= 8) await page.waitForURL((u) => !u.pathname.startsWith('/admin/login'), { timeout: 15_000 }).catch(() => undefined);
}

/** Adds a product from the menu grid, picking options in the sheet when it opens. */
export async function addFromMenu(page: Page, name: string, options: string[] = []) {
  await page.getByRole('button', { name: `افزودن ${name}`, exact: true }).first().click();
  const sheet = page.getByRole('dialog');
  if (await sheet.isVisible().catch(() => false)) {
    for (const o of options) await sheet.getByText(o, { exact: true }).click();
    await sheet.getByRole('button', { name: /افزودن به سبد/ }).click();
    await expect(sheet).toBeHidden();
  }
}

export async function otpLogin(page: Page, phone: string) {
  await page.getByLabel('شماره‌ی موبایل').fill(phone);
  await page.getByRole('button', { name: 'ارسال کد' }).click();
  await page.getByLabel('کد تأیید').fill(OTP);
  await page.getByRole('button', { name: 'تأیید و ورود' }).click();
}

export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|tile\.openstreetmap/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/** Fails on serious or critical WCAG violations. */
export async function expectAccessible(page: Page, exclude: string[] = []) {
  // Judge the settled page, not a frame in the middle of an entrance animation.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  for (const e of ['.leaflet-container', ...exclude]) builder = builder.exclude(e);
  const r = await builder.analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')})`)).toEqual([]);
}

export async function newPhone(context: BrowserContext) {
  return context.newPage();
}
