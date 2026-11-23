import { expect, test } from '@playwright/test';
import { addFromMenu, expectAccessible, staffLogin, trackErrors } from './helpers';

test('wrong staff passwords are refused', async ({ page }) => {
  await staffLogin(page, 'owner', 'not-the-password');
  await expect(page.getByText('نام کاربری یا رمز درست نیست.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('admin pages require a staff session', async ({ page }) => {
  await page.goto('/admin/orders');
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders/);
});

test('the owner changes a price and the shop follows', async ({ page, browser }) => {
  const errors = trackErrors(page);
  await staffLogin(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expectAccessible(page);
  await page.getByRole('link', { name: 'منو و محصولات' }).click();
  await page.getByRole('cell', { name: /^قهوه‌ی دمی/ }).click();
  const price = page.getByLabel('قیمت پایه (تومان)');
  await price.fill('199000');
  await page.getByRole('button', { name: 'ذخیره‌ی محصول' }).click();
  await expect(page.getByText('ذخیره شد')).toBeVisible();

  const shop = await (await browser.newContext()).newPage();
  await shop.goto('/shop/p/pour-over');
  await expect(shop.getByText('۱۹۹٬۰۰۰ تومان').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('a new discount code works at checkout', async ({ page, browser }) => {
  await staffLogin(page);
  await page.goto('/admin/discounts');
  await page.getByRole('button', { name: 'کد جدید' }).click();
  await page.getByLabel('کد (حروف انگلیسی و عدد)').fill('YALDA20');
  await page.getByRole('spinbutton', { name: 'درصد' }).fill('20');
  await page.getByRole('spinbutton', { name: 'دفعات برای هر مشتری' }).fill('');
  await page.getByRole('button', { name: 'ذخیره' }).click();
  await expect(page.getByRole('cell', { name: 'YALDA20' })).toBeVisible();

  const ctx = await browser.newContext();
  const shop = await ctx.newPage();
  const branches = await (await shop.request.get('/api/branches')).json();
  const tables = await (await page.request.get(`/api/staff/branches/${branches.branches[0].id}/tables`)).json();
  await shop.goto(new URL(tables.tables[4].url).pathname);
  await shop.waitForURL(/\/shop$/);
  await addFromMenu(shop, 'کوکی شکلاتی');
  await shop.goto('/shop/checkout');
  await shop.getByLabel('کد تخفیف').fill('yalda20');
  await shop.getByRole('button', { name: 'اعمال' }).click();
  await expect(shop.getByText('تخفیف (YALDA20)')).toBeVisible();
  await expect(shop.getByText('۸۸٬۰۰۰ تومان').last()).toBeVisible();
  await ctx.close();
});

test('reports, bar and the rest of the panel render for the owner', async ({ page }) => {
  const errors = trackErrors(page);
  await staffLogin(page);
  for (const [link, heading] of [
    ['سفارش‌ها', 'سفارش‌ها'], ['موجودی شعبه', 'موجودی شعبه'], ['شعبه‌ها', 'شعبه‌ها'], ['میزها و QR', 'میزها و QR'],
    ['مشتری‌ها', 'مشتری‌ها'], ['گزارش فروش', 'گزارش فروش'], ['حسابداری', 'اتصال به حسابداری'], ['دستیار تادا', 'دستیار تادا'],
    ['همکاران', 'همکاران'], ['گزارش تغییرات', 'گزارش تغییرات'], ['تنظیمات', 'تنظیمات'],
  ] as const) {
    await page.getByRole('navigation', { name: 'منوی پنل' }).getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
  }
  await page.goto('/admin/reports');
  await expect(page.getByRole('img', { name: 'فروش روزانه' })).toBeVisible();
  await expect(page.getByText('پرفروش‌ترین‌ها (تعداد)')).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('baristas only see what they need', async ({ page }) => {
  await staffLogin(page, 'bar-e2e', 'barista-e2e-password');
  await expect(page).toHaveURL(/\/bar$/);
  await page.goto('/admin');
  const nav = page.getByRole('navigation', { name: 'منوی پنل' });
  await expect(nav.getByRole('link', { name: 'سفارش‌ها' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'منو و محصولات' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'همکاران' })).toHaveCount(0);
  const res = await page.request.post('/api/staff/products', { data: {}, headers: { origin: 'http://localhost:3100' } });
  expect(res.status()).toBe(403);
});
