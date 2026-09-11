import { expect, test } from '@playwright/test';
import { ADA, ADMIN, newUserContext, shot, signIn } from './support';

for (const theme of ['light', 'dark'] as const) {
  test(`key screens render cleanly in ${theme} mode`, async ({ browser }) => {
    const context = await newUserContext(browser, theme);
    const page = await context.newPage();
    await signIn(page, ADA);

    await expect(page.getByText('Total balance')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Naira rates' })).toBeVisible();
    await shot(page, `visual-${theme}-dashboard`);

    await page.goto('/trade');
    await expect(page.locator('cx-line-chart svg, cx-line-chart .empty-chart').first()).toBeVisible();
    await shot(page, `visual-${theme}-trade`);

    await page.goto('/p2p');
    await expect(page.getByRole('heading', { name: 'P2P' })).toBeVisible();
    await shot(page, `visual-${theme}-p2p`);

    await page.goto('/account/security');
    await expect(page.getByRole('heading', { name: 'Two-factor authentication' })).toBeVisible();
    await shot(page, `visual-${theme}-security`);

    await context.close();
  });
}

test('mobile layout keeps navigation reachable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await signIn(page, ADA);
  await expect(page.getByText('Total balance')).toBeVisible();
  await shot(page, 'visual-mobile-dashboard');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const wallets = page.locator('.rail').getByRole('link', { name: 'Wallets', exact: true });
  await expect(wallets).toBeVisible();
  await shot(page, 'visual-mobile-menu', false);
  await wallets.click();
  await expect(page).toHaveURL(/\/wallets$/);
  await shot(page, 'visual-mobile-wallets');

  await context.close();
});

test('admin overview in dark mode', async ({ browser }) => {
  const context = await newUserContext(browser, 'dark');
  const page = await context.newPage();
  await signIn(page, ADMIN);
  await expect(page.getByRole('heading', { name: 'Back office' })).toBeVisible();
  await shot(page, 'visual-dark-admin');
  await context.close();
});
