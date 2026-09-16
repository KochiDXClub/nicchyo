import { test, expect } from '@playwright/test';

const OPT_OUT_KEY = 'nicchyo_analytics_opt_out';
const LEGACY_ANALYTICS_KEY = 'nicchyo_analytics_consent';

const readOptOut = (page: import('@playwright/test').Page) =>
  page.evaluate((key) => localStorage.getItem(key), OPT_OUT_KEY);

test('トップページに同意バナーは出ない', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  // バナーは useEffect で後から出るものだった。goto 直後に数えるだけでは
  // 「まだ出ていない」も 0 件になってしまうため、出るとしたら出きるまで待ってから数える
  await page.waitForTimeout(2000);

  await expect(page.getByText('当サイトはサービス改善のため')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'すべて許可' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '拒否する' })).toHaveCount(0);

  // 既定では解析は動いている（止める設定は保存されていない）
  expect(await readOptOut(page)).toBeNull();
});

test('プライバシーポリシーから解析を止めて、また再開できる', async ({ page }) => {
  await page.goto('/privacy');

  const toggle = page.getByRole('switch', { name: 'この端末でのアクセス解析' });
  await expect(toggle).toBeVisible({ timeout: 30000 });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(await readOptOut(page)).toBe('1');

  // 再訪しても止まったままであること
  await page.reload();
  const toggleAfterReload = page.getByRole('switch', { name: 'この端末でのアクセス解析' });
  await expect(toggleAfterReload).toHaveAttribute('aria-checked', 'false');

  await toggleAfterReload.click();
  await expect(toggleAfterReload).toHaveAttribute('aria-checked', 'true');
  expect(await readOptOut(page)).toBeNull();
});

test('バナーで「拒否する」を選んでいた人は、止めたまま引き継がれる', async ({ page }) => {
  await page.goto('/privacy');
  await page.evaluate((key) => localStorage.setItem(key, 'declined'), LEGACY_ANALYTICS_KEY);
  await page.reload();

  const toggle = page.getByRole('switch', { name: 'この端末でのアクセス解析' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 30000 });
  expect(await readOptOut(page)).toBe('1');
  expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_ANALYTICS_KEY)).toBeNull();
});
