import { expect, test } from '@playwright/test';
import { ADA, signIn } from './support';

test('debug overlays', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`));
  await signIn(page, ADA);
  await expect(page.getByText('Total balance')).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Account menu' });
  await trigger.click();
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const container = document.querySelector('.cdk-overlay-container');
    const popovers = Array.from(document.querySelectorAll('[popover]')).map((p) => p.outerHTML.slice(0, 400));
    const btn = document.querySelector('[aria-label="Account menu"]');
    return {
      container: container ? container.outerHTML.slice(0, 1500) : null,
      popovers,
      triggerAttrs: btn ? Array.from(btn.attributes).map((a) => `${a.name}=${a.value}`) : null,
      bodyTail: Array.from(document.body.children).map((c) => c.tagName + '.' + c.className).join(' | '),
    };
  });
  console.log('DEBUG-INFO ' + JSON.stringify(info, null, 2));
  await page.keyboard.press('Escape');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  const afterKey = await page.evaluate(() => document.querySelector('.cdk-overlay-container')?.outerHTML.slice(0, 600) ?? null);
  console.log('DEBUG-AFTER-KEY ' + afterKey);
  await page.goto('/wallets/usdt/withdraw');
  await page.getByLabel('Recipient USDT address').fill('0x' + 'ab'.repeat(20));
  await page.locator('#withdraw-amount').fill('12');
  await page.getByRole('button', { name: 'Review and send' }).click();
  await page.waitForTimeout(1500);
  const dialog = await page.evaluate(() => ({
    container: document.querySelector('.cdk-overlay-container')?.outerHTML.slice(0, 1500) ?? null,
    dialogs: document.querySelectorAll('[role=dialog]').length,
  }));
  console.log('DEBUG-DIALOG ' + JSON.stringify(dialog, null, 2));
  console.log('DEBUG-LOGS\n' + logs.join('\n'));
});
