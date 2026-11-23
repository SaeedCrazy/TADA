import { expect, test } from '@playwright/test';
import { expectAccessible, trackErrors } from './helpers';

test('the menu shows Tada products with toman prices and passes accessibility checks', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: 'سفارش از تادا' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'قهوه', exact: true })).toBeVisible();
  await expect(page.getByText('لاته‌ی اوبه').first()).toBeVisible();
  await expect(page.getByText(/۲۴۵٬۰۰۰ تومان/).first()).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('category filter and search narrow the menu', async ({ page }) => {
  await page.goto('/shop');
  await page.getByRole('button', { name: 'بیکری و کوکی' }).click();
  await expect(page.getByText('کروسان کره‌ای')).toBeVisible();
  await expect(page.getByText('اسپرسو', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'همه', exact: true }).click();
  await page.getByPlaceholder('جست‌وجو در منو').fill('ماچا');
  await expect(page.getByText('ماچا لاته').first()).toBeVisible();
  await expect(page.getByText('کوکی شکلاتی')).toHaveCount(0);
});

test('product pages are server-rendered with SEO metadata', async ({ page, request }) => {
  const html = await (await request.get('/shop/p/latte')).text();
  expect(html).toContain('<title>لاته | تادا</title>');
  expect(html).toContain('"@type":"Product"');
  expect(html).toContain('"priceCurrency":"IRR"');
  await page.goto('/shop/p/latte');
  await expect(page.getByRole('heading', { name: 'لاته', level: 1 })).toBeVisible();
  await expect(page.getByRole('meter', { name: 'کافئین' })).toBeVisible();
  await expectAccessible(page);
});

test('the English shop mirrors the Persian one', async ({ page }) => {
  await page.goto('/shop');
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/shop$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByText('Ube latte').first()).toBeVisible();
  await expect(page.getByText(/245,000 Toman/).first()).toBeVisible();
  await expectAccessible(page);
});

test('an unknown table code explains itself', async ({ page }) => {
  await page.goto('/t/not-a-real-table-code');
  await expect(page.getByText('این QR معتبر نیست')).toBeVisible();
});

test('sitemap and robots are served', async ({ request }) => {
  const sm = await (await request.get('/sitemap.xml')).text();
  expect(sm).toContain('/shop/p/ube-latte');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin');
});
