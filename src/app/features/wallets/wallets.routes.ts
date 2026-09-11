import { Routes } from '@angular/router';

export const walletRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./wallets-layout').then((m) => m.WalletsLayout),
    children: [
      { path: '', title: 'Wallets', loadComponent: () => import('./balances').then((m) => m.Balances) },
      { path: 'activity', title: 'Wallet activity', loadComponent: () => import('./activity').then((m) => m.Activity) },
      { path: 'deposits', title: 'Deposits', loadComponent: () => import('./deposits-history').then((m) => m.DepositsHistory) },
      { path: 'withdrawals', title: 'Withdrawals', loadComponent: () => import('./withdrawals-history').then((m) => m.WithdrawalsHistory) },
      { path: 'bank-accounts', title: 'Bank accounts', loadComponent: () => import('./bank-accounts').then((m) => m.BankAccounts) },
    ],
  },
  { path: 'naira/deposit', title: 'Add naira', loadComponent: () => import('./naira-deposit').then((m) => m.NairaDeposit) },
  { path: 'naira/withdraw', title: 'Withdraw naira', loadComponent: () => import('./naira-withdraw').then((m) => m.NairaWithdraw) },
  { path: 'fiat/deposit/return', title: 'Payment status', loadComponent: () => import('./deposit-return').then((m) => m.DepositReturn) },
  { path: 'fiat/simulated-checkout', title: 'Test payment', loadComponent: () => import('./simulated-checkout').then((m) => m.SimulatedCheckout) },
  { path: ':asset/deposit', title: 'Deposit crypto', loadComponent: () => import('./crypto-deposit').then((m) => m.CryptoDepositPage) },
  { path: ':asset/withdraw', title: 'Send crypto', loadComponent: () => import('./crypto-withdraw').then((m) => m.CryptoWithdrawPage) },
];
