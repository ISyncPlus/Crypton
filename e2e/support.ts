import { APIRequestContext, Browser, BrowserContext, Page, expect } from '@playwright/test';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const DEMO_PASSWORD = process.env['E2E_DEMO_PASSWORD'] ?? 'Demo-Password-2026';
export const ADMIN = { email: process.env['E2E_ADMIN_EMAIL'] ?? 'admin@crypton.local', password: process.env['E2E_ADMIN_PASSWORD'] ?? 'Admin-Password-2026' };
export const ADA = { email: 'ada@demo.crypton.local', password: DEMO_PASSWORD };
export const TUNDE = { email: 'tunde@demo.crypton.local', password: DEMO_PASSWORD };
export const MAILPIT = process.env['E2E_MAILPIT_URL'] ?? 'http://localhost:8025';

const SCREENS = join(process.cwd(), 'test-results', 'screens');

export async function shot(page: Page, name: string, fullPage = true): Promise<void> {
  mkdirSync(SCREENS, { recursive: true });
  // Let fonts and charts settle so screenshots are representative.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SCREENS, `${name}.png`), fullPage });
}

export async function newUserContext(browser: Browser, theme: 'light' | 'dark' = 'light'): Promise<BrowserContext> {
  const context = await browser.newContext({ colorScheme: theme });
  await context.addInitScript((mode) => localStorage.setItem('crypton.theme', mode), theme);
  return context;
}

export async function signIn(page: Page, account: { email: string; password: string }, totpSecret?: string): Promise<void> {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  if (totpSecret) {
    await expect(page.getByRole('heading', { name: 'Two-factor check' })).toBeVisible();
    await page.getByLabel('Authentication code').fill(await nextTotp(totpSecret));
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/auth'));
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${randomBytes(3).toString('hex')}@e2e.crypton.local`;
}

export function randomEthereumAddress(): string {
  return `0x${randomBytes(20).toString('hex')}`;
}

/** Latest confirmation or reset link sent to an address, read from Mailpit's API. */
export async function linkFromEmail(request: APIRequestContext, to: string, path: '/auth/confirm-email' | '/auth/reset-password'): Promise<string> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${to}"` } });
    if (search.ok()) {
      const body = (await search.json()) as { messages?: { ID: string }[] };
      for (const message of body.messages ?? []) {
        const detail = await request.get(`${MAILPIT}/api/v1/message/${message.ID}`);
        const json = (await detail.json()) as { Text?: string; HTML?: string };
        const text = `${json.Text ?? ''} ${(json.HTML ?? '').replace(/&amp;/g, '&')}`;
        const match = new RegExp(`https?://[^\\s"'<>]+${path.replace(/\//g, '\\/')}\\?[^\\s"'<>]+`).exec(text);
        if (match) {
          return match[0];
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`No email with ${path} arrived for ${to}`);
}

// ---------------------------------------------------------------- TOTP (RFC 6238) for two-factor flows
const usedSteps = new Map<string, number>();

function base32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/[\s=]/g, '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index >= 0) {
      bits += index.toString(2).padStart(5, '0');
    }
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

export function totp(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

/** A code from a time step the server has not seen yet (the API rejects reused steps). */
export async function nextTotp(secret: string): Promise<string> {
  const last = usedSteps.get(secret) ?? -1;
  let step = Math.floor(Date.now() / 30_000);
  while (step <= last) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    step = Math.floor(Date.now() / 30_000);
  }

  usedSteps.set(secret, step);
  return totp(secret, step);
}
