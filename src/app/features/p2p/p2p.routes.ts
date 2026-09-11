import { Routes } from '@angular/router';

export const p2pRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./p2p-layout').then((m) => m.P2PLayout),
    children: [
      { path: '', title: 'P2P market', loadComponent: () => import('./market').then((m) => m.Market) },
      { path: 'orders', title: 'P2P orders', loadComponent: () => import('./orders').then((m) => m.Orders) },
      { path: 'ads', title: 'My P2P ads', loadComponent: () => import('./my-ads').then((m) => m.MyAds) },
    ],
  },
  { path: 'ads/new', title: 'Post an ad', loadComponent: () => import('./ad-form').then((m) => m.AdForm) },
  { path: 'ads/:id', title: 'Edit ad', loadComponent: () => import('./ad-form').then((m) => m.AdForm) },
  { path: 'orders/:id', title: 'P2P order', loadComponent: () => import('./order-room').then((m) => m.OrderRoom) },
  { path: 'traders/:userId', title: 'Trader profile', loadComponent: () => import('./trader-profile').then((m) => m.TraderProfilePage) },
];
