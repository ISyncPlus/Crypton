import { expect, test } from '@playwright/test';
import { ADA, ADMIN, shot, signIn } from './support';

test('staff land in the back office and the ledger balances', async ({ page }) => {
  await signIn(page, ADMIN);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Back office' })).toBeVisible();
  await expect(page.getByText('Waiting on staff')).toBeVisible();
  await expect(page.getByText('Blockchain: Simulated')).toBeVisible();
  await shot(page, 'admin-overview');

  await page.goto('/admin/users');
  await page.getByLabel('Search users').fill('ada@demo');
  await page.getByRole('link', { name: 'Ada Okafor' }).click();
  await expect(page.getByRole('heading', { name: 'Ada Okafor' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Balances' })).toBeVisible();
  await shot(page, 'admin-user');

  await page.goto('/admin/withdrawals');
  await expect(page.getByRole('heading', { name: 'Withdrawals' })).toBeVisible();

  await page.goto('/admin/treasury');
  await expect(page.getByRole('heading', { name: 'USDT' })).toBeVisible();
  await expect(page.getByText('House position negative')).toHaveCount(0);
  await shot(page, 'admin-treasury');

  await page.goto('/admin/settings');
  await expect(page.getByRole('heading', { name: 'Instant trading' })).toBeVisible();

  await page.goto('/admin/audit');
  await expect(page.getByRole('cell', { name: 'auth.login_succeeded' }).first()).toBeVisible();

  await page.goto('/admin/system');
  await expect(page.getByText('All ledger checks passed')).toBeVisible();
  await shot(page, 'admin-system');
});

test('regular users cannot open the back office', async ({ page }) => {
  await signIn(page, ADA);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard$/);
});
