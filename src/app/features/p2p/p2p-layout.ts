import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'cx-p2p-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">P2P</h1>
          <p class="lede">Trade directly with other people and pay by bank transfer. Crypto is held in escrow until the seller confirms payment.</p>
        </div>
        <a class="btn btn--primary" routerLink="/p2p/ads/new"><cx-icon name="plus" [size]="16" />Post an ad</a>
      </header>

      <nav class="tabs" aria-label="P2P sections">
        <a routerLink="/p2p" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Market</a>
        <a routerLink="/p2p/orders" routerLinkActive="is-active" ariaCurrentWhenActive="page">My orders</a>
        <a routerLink="/p2p/ads" routerLinkActive="is-active" ariaCurrentWhenActive="page">My ads</a>
      </nav>

      <router-outlet />
    </div>
  `,
})
export class P2PLayout {}
