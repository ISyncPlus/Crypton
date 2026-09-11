import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from './core/auth.service';
import { authGuard, guestGuard, staffGuard } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      const auth = inject(AuthService);
      return auth.isAuthenticated() ? auth.homeFor() : '/auth/sign-in';
    },
  },
  {
    path: 'auth',
    loadComponent: () => import('./layouts/auth-layout').then((m) => m.AuthLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'sign-in' },
      { path: 'sign-in', title: 'Sign in', canActivate: [guestGuard], loadComponent: () => import('./features/auth/sign-in').then((m) => m.SignIn) },
      { path: 'sign-up', title: 'Create account', canActivate: [guestGuard], loadComponent: () => import('./features/auth/sign-up').then((m) => m.SignUp) },
      { path: 'check-email', title: 'Check your email', loadComponent: () => import('./features/auth/check-email').then((m) => m.CheckEmail) },
      { path: 'confirm-email', title: 'Confirm email', loadComponent: () => import('./features/auth/confirm-email').then((m) => m.ConfirmEmail) },
      {
        path: 'forgot-password',
        title: 'Reset password',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/forgot-password').then((m) => m.ForgotPassword),
      },
      { path: 'reset-password', title: 'Choose a new password', loadComponent: () => import('./features/auth/reset-password').then((m) => m.ResetPassword) },
    ],
  },
  {
    path: 'admin',
    canActivate: [staffGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/shell').then((m) => m.Shell),
    children: [
      { path: 'dashboard', title: 'Overview', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'trade', title: 'Trade', loadComponent: () => import('./features/trade/trade').then((m) => m.Trade) },
      { path: 'wallets', loadChildren: () => import('./features/wallets/wallets.routes').then((m) => m.walletRoutes) },
      { path: 'p2p', loadChildren: () => import('./features/p2p/p2p.routes').then((m) => m.p2pRoutes) },
      { path: 'account', loadChildren: () => import('./features/account/account.routes').then((m) => m.accountRoutes) },
    ],
  },
  { path: '**', title: 'Page not found', loadComponent: () => import('./features/not-found').then((m) => m.NotFound) },
];
