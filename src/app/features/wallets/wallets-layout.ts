import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ClockService } from '../../core/clock.service';
import { formatDateTime } from '../../core/format';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'cx-wallets-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Wallets</h1>
          <p class="lede">Balances, deposits and withdrawals for naira and crypto.</p>
        </div>
        <div class="row">
          <a class="btn btn--primary" [routerLink]="tier() >= 1 ? '/wallets/naira/deposit' : '/account/verification'"><cx-icon name="plus" [size]="16" />Add naira</a>
          <a class="btn" routerLink="/wallets/btc/deposit"><cx-icon name="arrow-down" [size]="16" />Deposit crypto</a>
        </div>
      </header>

      @if (lockedUntil(); as until) {
        <div class="notice notice--warn" role="status">
          <cx-icon name="lock" [size]="18" />
          <span>Withdrawals are paused until {{ until }} after a recent security change. Deposits and trading still work.</span>
        </div>
      }

      <nav class="tabs" aria-label="Wallet sections">
        <a routerLink="/wallets" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Balances</a>
        <a routerLink="/wallets/activity" routerLinkActive="is-active" ariaCurrentWhenActive="page">Activity</a>
        <a routerLink="/wallets/deposits" routerLinkActive="is-active" ariaCurrentWhenActive="page">Deposits</a>
        <a routerLink="/wallets/withdrawals" routerLinkActive="is-active" ariaCurrentWhenActive="page">Withdrawals</a>
        <a routerLink="/wallets/bank-accounts" routerLinkActive="is-active" ariaCurrentWhenActive="page">Bank accounts</a>
      </nav>

      <router-outlet />
    </div>
  `,
})
export class WalletsLayout {
  private readonly auth = inject(AuthService);
  private readonly clock = inject(ClockService);
  protected readonly tier = computed(() => this.auth.user()?.kycTier ?? 0);
  protected readonly lockedUntil = computed(() => {
    const until = this.auth.user()?.withdrawalsLockedUntil;
    return until && Date.parse(until) > this.clock.serverNow() ? formatDateTime(until) : null;
  });
}
