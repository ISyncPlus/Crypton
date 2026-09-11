import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { changeLabel, formatDateTime, formatRate } from '../core/format';
import { MarketService } from '../core/market.service';
import { AssetCode } from '../core/models';
import { Icon, IconName } from '../ui/icon';
import { Logo } from '../ui/logo';
import { NotificationMenu } from './notification-menu';
import { UserMenu } from './user-menu';

interface NavItem {
  label: string;
  link: string;
  icon: IconName;
  exact?: boolean;
}

export const shellStyles = `
  :host {
    display: grid;
    grid-template-columns: var(--rail-width) minmax(0, 1fr);
    min-height: 100dvh;
  }

  .skip {
    position: absolute;
    top: -3rem;
    left: var(--space-3);
    z-index: 50;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink);
  }

  .skip:focus {
    top: var(--space-3);
  }

  .rail {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    height: 100dvh;
    padding: var(--space-4) var(--space-3);
    overflow-y: auto;
  }

  .rail__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 2.5rem;
    padding: 0 var(--space-2);
  }

  .rail__top a {
    color: inherit;
    text-decoration: none;
  }

  .rail__close {
    display: none;
  }

  .nav {
    display: grid;
    gap: 2px;
  }

  .nav__group {
    margin: var(--space-4) var(--space-3) var(--space-1);
    font-size: var(--text-xs);
    font-weight: 550;
    opacity: 0.7;
  }

  .nav a {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 2.5rem;
    padding: 0 var(--space-3);
    border-radius: var(--radius-sm);
    color: inherit;
    font-weight: 550;
    text-decoration: none;
    transition: background-color var(--dur-fast) var(--ease);
  }

  .nav a .count {
    margin-left: auto;
    min-width: 1.4rem;
    padding: 0 0.4rem;
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    font-weight: 650;
    line-height: 1.35rem;
    text-align: center;
  }

  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: var(--topbar-height);
    padding: 0 var(--space-5);
    border-bottom: 1px solid var(--rule);
    background: color-mix(in srgb, var(--ground) 88%, transparent);
    backdrop-filter: blur(10px);
  }

  .topbar__menu {
    display: none;
  }

  .topbar__actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
  }

  .scrim {
    display: none;
  }

  main {
    flex: 1;
    min-width: 0;
  }

  main:focus {
    outline: none;
  }

  @media (max-width: 1000px) {
    :host {
      grid-template-columns: minmax(0, 1fr);
    }

    .rail {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 60;
      width: min(18rem, 86vw);
      transform: translateX(-102%);
      transition: transform var(--dur) var(--ease);
    }

    :host(.is-open) .rail {
      transform: none;
      box-shadow: var(--shadow-pop);
    }

    .rail__close {
      display: inline-flex;
    }

    .scrim {
      position: fixed;
      inset: 0;
      z-index: 55;
      display: block;
      background: rgb(13 15 36 / 50%);
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--dur) var(--ease);
    }

    :host(.is-open) .scrim {
      opacity: 1;
      pointer-events: auto;
    }

    .topbar {
      padding: 0 var(--space-3);
    }

    .topbar__menu {
      display: inline-flex;
    }
  }
`;

@Component({
  selector: 'cx-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo, NotificationMenu, UserMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'drawer()' },
  styles: [
    shellStyles,
    `
      .rail {
        background-color: var(--dye);
        background-image: var(--pattern);
        color: var(--dye-ink);
      }

      .nav a:hover {
        background: rgb(255 255 255 / 6%);
      }

      .nav a.is-active {
        background: rgb(255 255 255 / 11%);
        color: #ffffff;
      }

      .nav a.is-active::before {
        content: '';
        position: absolute;
        top: 0.55rem;
        bottom: 0.55rem;
        left: -0.75rem;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: var(--signal);
      }

      .nav a cx-icon {
        opacity: 0.85;
      }

      .rail .btn--quiet {
        --btn-fg: var(--dye-ink);
        --btn-hover: rgb(255 255 255 / 8%);
      }

      .nudge {
        display: grid;
        gap: var(--space-2);
        margin-top: auto;
        padding: var(--space-4);
        border: 1px solid rgb(255 255 255 / 12%);
        border-radius: var(--radius);
        background: rgb(8 10 40 / 35%);
      }

      .nudge strong {
        font-size: var(--text-md);
      }

      .nudge p {
        color: var(--dye-ink-2);
        font-size: var(--text-sm);
      }

      .nudge a {
        justify-self: start;
        margin-top: var(--space-1);
      }

      .tier {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-top: auto;
        padding: var(--space-3);
        color: var(--dye-ink-2);
        font-size: var(--text-sm);
      }

      .nudge + .tier {
        margin-top: 0;
      }

      .ticker {
        display: flex;
        align-items: center;
        gap: var(--space-5);
        min-width: 0;
        overflow-x: auto;
        scrollbar-width: none;
        white-space: nowrap;
      }

      .tick {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-2);
        font-size: var(--text-sm);
      }

      .tick__code {
        color: var(--ink-3);
        font-weight: 600;
      }

      .tick__price {
        font-stretch: 110%;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }

      .tick__change {
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
        font-weight: 550;
      }

      .delayed {
        color: var(--warn);
        font-size: var(--text-sm);
      }

      .banner {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-5);
        background: var(--down-soft);
        color: var(--ink);
        font-size: var(--text-sm);
      }

      .banner cx-icon {
        color: var(--down);
      }

      @media (max-width: 640px) {
        .tick:nth-child(n + 2) {
          display: none;
        }
      }
    `,
  ],
  template: `
    <a class="skip" href="#content" (click)="focusContent($event)">Skip to content</a>

    <aside class="rail" aria-label="Main navigation">
      <div class="rail__top">
        <a routerLink="/dashboard" aria-label="Crypton overview"><cx-logo [size]="28" /></a>
        <button type="button" class="btn btn--quiet btn--icon rail__close" (click)="drawer.set(false)" aria-label="Close menu">
          <cx-icon name="x" />
        </button>
      </div>

      <nav class="nav">
        @for (item of nav; track item.link) {
          <a [routerLink]="item.link" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: !!item.exact }" ariaCurrentWhenActive="page">
            <cx-icon [name]="item.icon" />
            {{ item.label }}
          </a>
        }
        @if (auth.isStaff()) {
          <div class="nav__group">Staff</div>
          <a routerLink="/admin">
            <cx-icon name="shield" />
            Back office
          </a>
        }
      </nav>

      @if (auth.user(); as user) {
        @if (user.kycTier === 0) {
          <div class="nudge">
            <strong>Verify your identity</strong>
            <p>Takes about two minutes. Unlocks naira deposits, withdrawals and P2P trading.</p>
            <a class="btn btn--signal btn--sm" routerLink="/account/verification">Verify now</a>
          </div>
        }
        <div class="tier">
          <cx-icon name="id" [size]="16" />
          <span>{{ tierName(user.kycTier) }}</span>
        </div>
      }
    </aside>

    <div class="scrim" (click)="drawer.set(false)" aria-hidden="true"></div>

    <div class="main">
      <header class="topbar">
        <button type="button" class="btn btn--quiet btn--icon topbar__menu" (click)="drawer.set(true)" aria-label="Open menu" [attr.aria-expanded]="drawer()">
          <cx-icon name="menu" />
        </button>

        <div class="ticker" aria-label="Naira prices">
          @for (tick of ticks(); track tick.code) {
            <span class="tick">
              <span class="tick__code">{{ tick.code }}</span>
              <span class="tick__price">{{ tick.price }}</span>
              <span class="tick__change" [class.up]="tick.direction > 0" [class.down]="tick.direction < 0">{{ tick.change }}</span>
            </span>
          }
          @if (market.pricesError()) {
            <span class="delayed" [attr.title]="lastUpdated()">Prices delayed</span>
          }
        </div>

        <div class="topbar__actions">
          <cx-notification-menu />
          <cx-user-menu />
        </div>
      </header>

      @if (auth.user()?.status === 'Frozen') {
        <div class="banner" role="alert">
          <cx-icon name="lock" [size]="18" />
          <span>Your account is frozen. You can sign in and view balances, but trading and withdrawals are paused. Contact support to resolve this.</span>
        </div>
      }

      <main id="content" tabindex="-1">
        <router-outlet />
      </main>
    </div>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly market = inject(MarketService);
  protected readonly drawer = signal(false);

  protected readonly nav: NavItem[] = [
    { label: 'Overview', link: '/dashboard', icon: 'overview', exact: true },
    { label: 'Trade', link: '/trade', icon: 'trade' },
    { label: 'Wallets', link: '/wallets', icon: 'wallet' },
    { label: 'P2P', link: '/p2p', icon: 'people' },
    { label: 'Account', link: '/account', icon: 'user' },
  ];

  protected readonly ticks = computed(() =>
    (['BTC', 'ETH', 'USDT'] as AssetCode[]).map((code) => {
      const price = this.market.price(code);
      const change = price?.change24hPercent ?? null;
      return {
        code,
        price: price ? formatRate(price.priceNgn) : '–',
        change: changeLabel(change),
        direction: change === null ? 0 : Math.sign(Number(change)),
      };
    }),
  );

  protected readonly lastUpdated = computed(() => {
    const at = this.market.lastUpdated();
    return at ? `Last updated ${formatDateTime(at)}` : 'Waiting for prices';
  });

  constructor() {
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.drawer.set(false));
  }

  tierName(tier: number): string {
    return tier >= 2 ? 'Advanced verification' : tier === 1 ? 'Verified' : 'Unverified';
  }

  focusContent(event: Event): void {
    event.preventDefault();
    document.getElementById('content')?.focus();
  }
}
