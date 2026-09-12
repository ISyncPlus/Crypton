import { expect, test } from '@playwright/test';
import { ADA, randomEthereumAddress, shot, signIn } from './support';

test('balances, activity and deposit address', async ({ page }) => {
  await signIn(page, ADA);
  await page.goto('/wallets');
  await expect(page.getByRole('cell', { name: /Tether USD/ })).toBeVisible();
  await shot(page, 'wallets-balances');

  await page.goto('/wallets/activity');
  await expect(page.getByText('Balance adjustment').first()).toBeVisible();

  await page.goto('/wallets/eth/deposit');
  await expect(page.getByRole('heading', { name: 'Your ETH address' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'ETH deposit address QR code' })).toBeVisible();
  await expect(page.getByText(/^0x[0-9a-fA-F]{40}$/)).toBeVisible();
  await shot(page, 'wallets-deposit-eth');
});

test('a simulated crypto deposit is credited after confirmations', async ({ page }) => {
  await signIn(page, ADA);
  await page.goto('/wallets/eth/deposit');
  await page.locator('#test-amount').fill('0.25');
  await page.getByRole('button', { name: 'Send test deposit' }).click();
  await expect(page.getByText('Test deposit sent')).toBeVisible();
  await expect(page.locator('.deposit').first()).toContainText('0.25 ETH');
  await expect(page.locator('.deposit').first()).toContainText('Credited', { timeout: 120_000 });
});

test('add naira through the test checkout', async ({ page }) => {
  await signIn(page, ADA);
  await page.goto('/wallets/naira/deposit');
  await page.locator('#deposit-amount').fill('5000');
  await expect(page.getByText('Added to your wallet')).toBeVisible();
  await shot(page, 'wallets-naira-deposit');
  await page.getByRole('button', { name: 'Pay ₦5,000.00' }).click();

  await expect(page.getByText('Test payment. No real money moves.')).toBeVisible();
  await shot(page, 'wallets-test-checkout');
  await page.getByRole('button', { name: 'Pay ₦5,000.00' }).click();
  await expect(page.getByRole('heading', { name: 'Naira added' })).toBeVisible({ timeout: 60_000 });
});

test('crypto withdrawals require two-factor authentication by default', async ({ page }) => {
  await signIn(page, ADA);
  await page.goto('/wallets/usdt/withdraw');
  await page.getByLabel('Recipient USDT address').fill(randomEthereumAddress());
  await page.locator('#withdraw-amount').fill('12');
  await expect(page.getByText('Total deducted')).toBeVisible();
  await shot(page, 'wallets-withdraw');
  await page.getByRole('button', { name: 'Review and send' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Send now' }).click();
  await expect(page.getByRole('link', { name: 'Turn on two-factor authentication' })).toBeVisible();
});

test('bank accounts resolve the account name before saving', async ({ page }) => {
  await signIn(page, ADA);
  await page.goto('/wallets/bank-accounts');
  const bank = page.getByLabel('Bank', { exact: true });
  await expect(bank.locator('option').nth(1)).toBeAttached();
  const value = await bank.locator('option').nth(1).getAttribute('value');
  await bank.selectOption(value ?? '');
  await page.getByLabel('Account number').fill('0000000001');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Account number').fill('0123456781');
  await expect(page.getByText('DEMO ACCOUNT 6781')).toBeVisible();
});
