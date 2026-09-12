import { expect, test } from '@playwright/test';
import { ADA, shot, signIn } from './support';

test('buy USDT with naira at a held price', async ({ page }) => {
  await signIn(page, ADA);
  await page.goto('/trade');
  await expect(page.getByRole('heading', { name: 'Trade', exact: true })).toBeVisible();

  await page.getByLabel('Asset to receive').selectOption('USDT');
  await page.locator('#amount').fill('20000');
  await expect(page.getByText('Price held for')).toBeVisible();
  const buy = page.getByRole('button', { name: /^Buy .+ USDT for ₦20,000\.00$/ });
  await expect(buy).toBeEnabled();
  await shot(page, 'trade-quote');

  await buy.click();
  await expect(page.getByRole('heading', { name: 'You bought USDT' })).toBeVisible();
  await shot(page, 'trade-receipt');

  await page.getByRole('button', { name: 'New trade' }).click();
  await expect(page.locator('#amount')).toHaveValue('');
});

test('sell and swap validate against balances', async ({ page }) => {
  await signIn(page, ADA);
  await page.goto('/trade');
  await page.getByRole('group', { name: 'Trade type' }).getByRole('button', { name: 'Sell' }).click();
  await page.getByLabel('Asset to pay with').selectOption('BTC');
  await page.locator('#amount').fill('0.06');
  await expect(page.getByText(/You need 0\.06 BTC but have/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sell 0\.06 BTC for/ })).toBeDisabled();

  await page.getByRole('group', { name: 'Trade type' }).getByRole('button', { name: 'Swap' }).click();
  await page.getByLabel('Asset to pay with').selectOption('USDT');
  await page.getByLabel('Asset to receive').selectOption('ETH');
  await page.locator('#amount').fill('50');
  const swap = page.getByRole('button', { name: /^Swap to .+ ETH$/ });
  await expect(swap).toBeEnabled();
  await swap.click();
  await expect(page.getByRole('heading', { name: 'You swapped USDT to ETH' })).toBeVisible();
});
