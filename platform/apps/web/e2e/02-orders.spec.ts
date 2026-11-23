import { expect, test } from '@playwright/test';
import { addFromMenu, expectAccessible, otpLogin, staffLogin, trackErrors } from './helpers';

test.describe.configure({ mode: 'serial' });

test('a guest orders from a table QR and the bar takes it all the way to handover', async ({ browser, request }) => {
  const tableRes = await request.get('http://localhost:4100/api/menu'); // warm the API
  expect(tableRes.ok()).toBeTruthy();

  // Find table 3 of Mollasadra through the staff API.
  const staffCtx = await browser.newContext();
  const bar = await staffCtx.newPage();
  await staffLogin(bar, 'bar-e2e', 'barista-e2e-password', '/bar');
  await expect(bar).toHaveURL(/\/bar$/);
  const branches = await (await bar.request.get('/api/staff/branches')).json();
  const tables = await (await bar.request.get(`/api/staff/branches/${branches.branches[0].id}/tables`)).json().catch(() => null);
  // Baristas cannot list tables; fall back to the owner for the token.
  let token: string;
  if (!tables?.tables) {
    const ownerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    await staffLogin(owner);
    await expect(owner).toHaveURL(/\/admin$/);
    const ob = await (await owner.request.get('/api/staff/branches')).json();
    const molla = ob.branches.find((b: { slug: string }) => b.slug === 'mollasadra');
    const t = await (await owner.request.get(`/api/staff/branches/${molla.id}/tables`)).json();
    token = t.tables.find((x: { number: number }) => x.number === 3).url.split('/t/')[1];
    await ownerCtx.close();
  } else {
    token = tables.tables[2].url.split('/t/')[1];
  }

  const guestCtx = await browser.newContext({ ...test.info().project.use });
  const guest = await guestCtx.newPage();
  const errors = trackErrors(guest);
  await guest.goto(`/t/${token}`);
  await expect(guest.getByText('میز ۳').first()).toBeVisible();
  await guest.waitForURL(/\/shop$/);
  await expect(guest.getByText(/میز ۳ · شعبه‌ی ملاصدرا/)).toBeVisible();

  await addFromMenu(guest, 'لاته', ['شیر جو دوسر']);
  await addFromMenu(guest, 'کوکی شکلاتی');
  await guest.getByRole('link', { name: 'دیدن سبد' }).click();
  await expect(guest.getByText('شیر جو دوسر')).toBeVisible();
  await guest.getByRole('link', { name: 'ادامه‌ی خرید' }).click();

  await expect(guest.getByRole('button', { name: 'سر میز' })).toHaveAttribute('aria-pressed', 'true');
  await guest.getByLabel('نام شما').fill('مهمان میز سه');
  await guest.getByText('پرداخت پای صندوق').click();
  await expect(guest.getByText('مبلغ نهایی')).toBeVisible();
  await expect(guest.getByText('۳۳۵٬۰۰۰ تومان').last()).toBeVisible(); // 185k + 40k oat + 110k cookie
  await expectAccessible(guest);
  await guest.getByTestId('place-order').click();
  await guest.waitForURL(/\/shop\/orders\//);
  await expect(guest.getByText('ثبت شد').first()).toBeVisible();
  const number = (await guest.getByRole('heading', { level: 1 }).textContent())!.match(/#(.+)$/)![1]!.trim();

  // The bar sees it live and moves it along.
  const ticket = bar.locator('article.ticket', { hasText: `#${number}` });
  await expect(ticket).toBeVisible({ timeout: 15_000 });
  await expect(ticket.getByText('پرداخت نشده')).toBeVisible();
  await expect(ticket.getByText('شیر جو دوسر')).toBeVisible();
  await ticket.getByRole('button', { name: 'شروع' }).click();
  await expect(bar.locator('section[aria-label="در حال آماده‌سازی"] article.ticket', { hasText: `#${number}` })).toBeVisible();
  await bar.locator('article.ticket', { hasText: `#${number}` }).getByRole('button', { name: 'آماده شد' }).click();
  await bar.locator('article.ticket', { hasText: `#${number}` }).getByRole('button', { name: 'پرداخت شد' }).click();
  await bar.locator('article.ticket', { hasText: `#${number}` }).getByRole('button', { name: 'تحویل شد' }).click();
  await expect(bar.locator('article.ticket', { hasText: `#${number}` })).toHaveCount(0);

  // The customer's page follows.
  await expect(guest.locator('.tracker li.done').last()).toContainText('تحویل شد', { timeout: 20_000 });
  await expect(guest.getByText('نوش جان!')).toBeVisible();
  expect(errors).toEqual([]);
  await guestCtx.close();
  await staffCtx.close();
});

test('a signed-in customer pays online for pickup through the gateway', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/shop');
  await addFromMenu(page, 'آمریکانو');
  await page.goto('/shop/checkout');
  await page.getByRole('button', { name: 'تحویل در شعبه' }).click();
  await page.getByRole('radio', { name: /ملاصدرا/ }).check();
  await expect(page.getByText('برای این نوع سفارش، شماره‌ی موبایل را تأیید کنید.')).toBeVisible();
  await otpLogin(page, '09121112233');
  await page.getByLabel('نام شما').fill('رضا');
  await page.getByRole('button', { name: 'پرداخت و ثبت سفارش' }).click();
  await expect(page.getByText('درگاه پرداخت آزمایشی')).toBeVisible();
  await page.getByRole('link', { name: 'پرداخت موفق' }).click();
  await page.waitForURL(/\/shop\/orders\/.+paid=1/);
  await expect(page.getByText('پرداخت موفق بود. سفارش شما به بار رسید.')).toBeVisible();
  await expect(page.getByText('پرداخت آنلاین · پرداخت شده')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a cancelled payment leaves the order waiting with a retry button', async ({ page }) => {
  await page.goto('/shop');
  await addFromMenu(page, 'اسپرسو');
  await page.goto('/shop/checkout');
  await page.getByRole('button', { name: 'تحویل در شعبه' }).click();
  await page.getByRole('radio', { name: /ملاصدرا/ }).check();
  await otpLogin(page, '09121112244');
  await page.getByLabel('نام شما').fill('نگار');
  await page.getByRole('button', { name: 'پرداخت و ثبت سفارش' }).click();
  await page.getByRole('link', { name: 'انصراف' }).click();
  await page.waitForURL(/paid=0/);
  await expect(page.getByText('پرداخت انجام نشد')).toBeVisible();
  await page.getByRole('button', { name: 'پرداخت دوباره' }).click();
  await expect(page.getByText('درگاه پرداخت آزمایشی')).toBeVisible();
});

test('delivery uses the customer location, prices the distance and accepts cash on delivery', async ({ browser }) => {
  const ctx = await browser.newContext({ ...test.info().project.use, geolocation: { latitude: 35.775, longitude: 51.405 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errors = trackErrors(page);
  await page.goto('/shop');
  await addFromMenu(page, 'لاته‌ی اوبه');
  await addFromMenu(page, 'لاته‌ی اوبه');
  await page.goto('/shop/checkout');
  await page.getByRole('button', { name: 'دلیوری' }).click();
  await otpLogin(page, '09121112255');
  await page.getByRole('button', { name: 'استفاده از موقعیت من' }).click();
  await page.getByLabel('نشانی دقیق').fill('خیابان نمونه، کوچه‌ی دوم، پلاک ۸');
  await page.getByLabel('نام آدرس').fill('خانه');
  await page.getByLabel('نام شما').fill('سامان');
  await page.getByText('پرداخت دم در').click();
  await expect(page.getByText('هزینه‌ی ارسال')).toBeVisible();
  await expect(page.getByText(/فاصله .+ کیلومتر/)).toBeVisible();
  await page.getByRole('button', { name: 'ثبت سفارش' }).click();
  await page.waitForURL(/\/shop\/orders\//);
  await expect(page.getByText('دلیوری').first()).toBeVisible();
  await expect(page.getByText('خیابان نمونه، کوچه‌ی دوم، پلاک ۸')).toBeVisible();
  // The address was saved for next time.
  await page.goto('/shop/account');
  await expect(page.getByText('خانه', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});
