import { expect, test } from '@playwright/test';
import { ADA, TUNDE, newUserContext, nextTotp, shot, signIn } from './support';

test('a full P2P trade: ad, order, payment, release with two-factor, feedback', async ({ browser }) => {
  test.setTimeout(300_000);

  // Seller: bank account, two-factor, sell ad.
  const sellerContext = await newUserContext(browser);
  const seller = await sellerContext.newPage();
  await signIn(seller, TUNDE);

  await seller.goto('/wallets/bank-accounts');
  const bank = seller.getByLabel('Bank', { exact: true });
  await expect(bank.locator('option').nth(1)).toBeAttached();
  await bank.selectOption((await bank.locator('option').nth(1).getAttribute('value')) ?? '');
  await seller.getByLabel('Account number').fill('0123450987');
  await expect(seller.getByText('DEMO ACCOUNT 0987')).toBeVisible();
  await seller.getByRole('button', { name: 'Save account' }).click();
  await expect(seller.getByText('Bank account saved')).toBeVisible();

  await seller.goto('/account/security');
  await seller.getByRole('button', { name: 'Set up two-factor authentication' }).click();
  const key = (await seller.locator('.key span').first().textContent())?.trim() ?? '';
  expect(key.length).toBeGreaterThan(10);
  await shot(seller, 'account-2fa-setup');
  await seller.getByLabel('Code from the app').fill(await nextTotp(key));
  await expect(seller.getByText('Save these recovery codes')).toBeVisible();
  await seller.getByRole('button', { name: "I've saved them" }).click();

  await seller.goto('/p2p/ads/new');
  await seller.locator('input[cxAmount]').nth(0).fill('500');
  await seller.getByLabel('Maximum order').fill('2000000');
  await shot(seller, 'p2p-ad-form');
  await seller.getByRole('button', { name: 'Post ad' }).click();
  await expect(seller.getByText('Ad posted')).toBeVisible();
  await expect(seller).toHaveURL(/\/p2p\/ads$/);
  await shot(seller, 'p2p-my-ads');

  // Buyer: take the ad and pay.
  const buyerContext = await newUserContext(browser);
  const buyer = await buyerContext.newPage();
  await signIn(buyer, ADA);
  await buyer.goto('/p2p');
  const row = buyer.locator('.ad', { hasText: 'tunde_otc' }).first();
  await expect(row).toBeVisible();
  await shot(buyer, 'p2p-market');
  await row.getByRole('button', { name: 'Buy USDT' }).click();
  await buyer.locator('#take-amount').fill('20000');
  await expect(buyer.getByText(/You pay ₦.+ and get .+ USDT\./)).toBeVisible();
  await buyer.getByRole('dialog').getByRole('button', { name: 'Buy USDT' }).click();
  await expect(buyer).toHaveURL(/\/p2p\/orders\/[0-9a-f-]{36}$/);
  await expect(buyer.getByText('Awaiting payment').first()).toBeVisible();
  await shot(buyer, 'p2p-order-pay');
  const orderUrl = new URL(buyer.url()).pathname;

  await buyer.getByRole('button', { name: "I've sent the payment" }).click();
  await buyer.getByRole('dialog').getByRole('button', { name: "Yes, I've paid" }).click();
  await expect(buyer.getByText('Paid, awaiting release').first()).toBeVisible();

  // Seller: release with a fresh authenticator code.
  await seller.goto(orderUrl);
  await expect(seller.getByRole('heading', { name: 'Check your bank account, then release' })).toBeVisible();
  await shot(seller, 'p2p-order-release');
  await seller.getByRole('button', { name: /^Release .+ USDT$/ }).click();
  await seller.getByRole('dialog').getByRole('button', { name: 'Release crypto' }).click();
  const code = await nextTotp(key);
  await seller.getByRole('dialog').getByRole('textbox').fill(code);
  await expect(seller.getByText('Crypto released')).toBeVisible();
  await expect(seller.getByText('Completed').first()).toBeVisible();

  // Buyer: sees completion and leaves feedback.
  await buyer.reload();
  await expect(buyer.getByRole('heading', { name: /^You received .+ USDT$/ })).toBeVisible();
  await buyer.getByRole('button', { name: 'Good' }).click();
  await buyer.getByRole('button', { name: 'Leave feedback' }).click();
  await expect(buyer.getByText('Thanks, your feedback is saved.')).toBeVisible();
  await shot(buyer, 'p2p-order-complete');

  await sellerContext.close();
  await buyerContext.close();
});
