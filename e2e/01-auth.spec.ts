import { expect, test } from '@playwright/test';
import { ADA, ADMIN, linkFromEmail, newUserContext, shot, signIn, uniqueEmail } from './support';

test('sign-in page explains wrong credentials', async ({ page }) => {
  await page.goto('/auth/sign-in');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Rates now')).toBeVisible();
  await shot(page, 'auth-sign-in');

  await page.getByLabel('Email').fill(ADA.email);
  await page.locator('#password').fill('Wrong-Password-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
});

test('protected pages send visitors to sign in and back again', async ({ page }) => {
  await page.goto('/wallets/activity');
  await expect(page).toHaveURL(/\/auth\/sign-in\?returnUrl=%2Fwallets%2Factivity/);
  await page.getByLabel('Email').fill(ADA.email);
  await page.locator('#password').fill(ADA.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/wallets\/activity$/);
  await expect(page.getByRole('heading', { name: 'Wallets' })).toBeVisible();
});

test('a session survives a reload and ends on sign out', async ({ page }) => {
  await signIn(page, ADA);
  await expect(page.getByText('Total balance')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Total balance')).toBeVisible();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/auth\/sign-in/);
});

test('new users confirm their email, verify identity and get approved by compliance', async ({ browser, request }) => {
  const email = uniqueEmail('newbie');
  const password = 'Strong-Pass-2026';
  const user = await newUserContext(browser);
  const page = await user.newPage();

  await page.goto('/auth/sign-up');
  await page.getByLabel('First name').fill('Chiamaka');
  await page.getByLabel('Last name').fill('Eze');
  await page.getByLabel('Email').fill(email);
  await page.locator('#new-password').fill('short');
  await page.getByLabel('Last name').click();
  await expect(page.getByText('At least 10 characters, with upper and lower case letters and a number.').first()).toBeVisible();
  await page.locator('#new-password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  // Signing in before confirming explains what to do.
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Confirm your email');

  const link = await linkFromEmail(request, email, '/auth/confirm-email');
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await expect(page.getByRole('heading', { name: 'Email confirmed' })).toBeVisible();

  await signIn(page, { email, password });
  await expect(page.getByText('Verify your identity').first()).toBeVisible();
  await page.goto('/account/verification');
  await page.getByLabel('Date of birth').fill('1994-05-17');
  await page.getByLabel('Phone number').fill('0803 123 4567');
  await page.getByLabel('Home address').fill('12 Admiralty Way');
  await page.getByLabel('City').fill('Lekki');
  await page.getByLabel('State').selectOption('Lagos');
  await page.getByLabel('NIN number').fill(String(Date.now()).slice(-11).padStart(11, '7'));
  await shot(page, 'account-verification-form');
  await page.getByRole('button', { name: 'Submit for verification' }).click();
  await expect(page.getByText('being reviewed')).toBeVisible();

  const staff = await newUserContext(browser);
  const admin = await staff.newPage();
  await signIn(admin, ADMIN);
  await admin.goto('/admin/kyc');
  await admin.getByRole('link', { name: 'Chiamaka Eze' }).first().click();
  await expect(admin.getByRole('heading', { name: 'Chiamaka Eze' })).toBeVisible();
  await admin.getByRole('button', { name: 'Reveal' }).click();
  await shot(admin, 'admin-kyc-review');
  await admin.getByRole('button', { name: 'Approve', exact: true }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
  await expect(admin.getByText('Verification approved')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Your level')).toBeVisible();
  await expect(page.locator('.tier.is-current')).toContainText('Verified');

  await user.close();
  await staff.close();
});
