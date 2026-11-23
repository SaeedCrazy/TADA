import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers';

test('the taste quiz recommends drinks that go straight into the cart', async ({ page }) => {
  await page.goto('/shop/assistant');
  await expect(page.getByRole('heading', { name: 'دستیار تادا' })).toBeVisible();
  await page.getByRole('button', { name: 'یک دلبری شیرین' }).click();
  await page.getByRole('button', { name: 'شیرین', exact: true }).click();
  await page.getByRole('button', { name: 'با شیر', exact: true }).click();
  await page.getByRole('button', { name: 'خنک', exact: true }).click();
  await page.getByRole('button', { name: 'وانیلی و خامه‌ای' }).click();
  await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click();
  await expect(page.getByRole('heading', { name: 'پیشنهاد دستیار' })).toBeVisible();
  const first = page.locator('.pick').first();
  await expect(first).toContainText('لاته‌ی اوبه');
  await expect(first).toContainText('خنک و یخ‌دار');
  await expectAccessible(page);
  await first.getByRole('button', { name: 'افزودن' }).click();
  await expect(page.getByText('به سبد اضافه شد')).toBeVisible();
  await expect(page.getByRole('link', { name: 'سبد (۱)' })).toBeVisible();
});

test('the chat understands a craving and answers questions about branches', async ({ page }) => {
  await page.goto('/shop/assistant');
  await page.getByRole('tab', { name: 'گفت‌وگو' }).click();
  await page.getByPlaceholder('مثلاً: یک چیز شیرین و خنک').fill('یک قهوه‌ی تلخ و قوی و گرم بدون شیر');
  await page.getByRole('button', { name: 'ارسال' }).click();
  await expect(page.locator('.bubble.bot').last()).toContainText('ذائقه');
  await expect(page.locator('.pick').first()).toContainText(/آمریکانو|اسپرسو/);
  await page.getByRole('button', { name: 'ساعت کاری' }).click();
  await expect(page.locator('.bubble.bot').last()).toContainText('ملاصدرا');
});
