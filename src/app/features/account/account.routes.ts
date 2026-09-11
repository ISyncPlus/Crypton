import { Routes } from '@angular/router';

export const accountRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./account-layout').then((m) => m.AccountLayout),
    children: [
      { path: '', title: 'Profile', loadComponent: () => import('./profile').then((m) => m.Profile) },
      { path: 'security', title: 'Security', loadComponent: () => import('./security').then((m) => m.Security) },
      { path: 'verification', title: 'Verification', loadComponent: () => import('./verification').then((m) => m.Verification) },
      { path: 'notifications', title: 'Notifications', loadComponent: () => import('./notifications').then((m) => m.Notifications) },
    ],
  },
];
