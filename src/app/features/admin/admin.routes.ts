import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('../../layouts/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', title: 'Back office', loadComponent: () => import('./overview').then((m) => m.AdminOverview) },
      { path: 'users', title: 'Users', loadComponent: () => import('./users').then((m) => m.AdminUsers) },
      { path: 'users/:id', title: 'User', loadComponent: () => import('./user-detail').then((m) => m.AdminUserDetailPage) },
      { path: 'withdrawals', title: 'Withdrawals', loadComponent: () => import('./withdrawals').then((m) => m.AdminWithdrawals) },
      { path: 'deposits', title: 'Deposits', loadComponent: () => import('./deposits').then((m) => m.AdminDeposits) },
      { path: 'trades', title: 'Trades', loadComponent: () => import('./trades').then((m) => m.AdminTrades) },
      { path: 'treasury', title: 'Treasury', loadComponent: () => import('./treasury').then((m) => m.AdminTreasury) },
      { path: 'kyc', title: 'Verification queue', loadComponent: () => import('./kyc').then((m) => m.AdminKyc) },
      { path: 'kyc/:id', title: 'Verification review', loadComponent: () => import('./kyc-detail').then((m) => m.AdminKycDetail) },
      { path: 'aml', title: 'Compliance alerts', loadComponent: () => import('./aml-alerts').then((m) => m.AdminAlerts) },
      { path: 'aml/rules', title: 'Monitoring rules', loadComponent: () => import('./aml-rules').then((m) => m.AdminAmlRules) },
      { path: 'aml/blocklist', title: 'Block list', loadComponent: () => import('./blocklist').then((m) => m.AdminBlocklist) },
      { path: 'p2p/disputes', title: 'P2P disputes', loadComponent: () => import('./disputes').then((m) => m.AdminDisputes) },
      { path: 'p2p/disputes/:id', title: 'Dispute', loadComponent: () => import('./dispute-detail').then((m) => m.AdminDisputeDetail) },
      { path: 'p2p/ads', title: 'P2P ads', loadComponent: () => import('./p2p-ads').then((m) => m.AdminP2PAds) },
      { path: 'p2p/orders', title: 'P2P orders', loadComponent: () => import('./p2p-orders').then((m) => m.AdminP2POrders) },
      { path: 'settings', title: 'Settings', loadComponent: () => import('./settings').then((m) => m.AdminSettingsPage) },
      { path: 'reports', title: 'Reports', loadComponent: () => import('./reports').then((m) => m.AdminReports) },
      { path: 'audit', title: 'Audit log', loadComponent: () => import('./audit').then((m) => m.AdminAuditLog) },
      { path: 'system', title: 'System health', loadComponent: () => import('./system').then((m) => m.AdminSystem) },
    ],
  },
];
