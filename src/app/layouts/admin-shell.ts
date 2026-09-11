import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AdminApi } from '../core/admin-api.service';
import { AdminDashboard } from '../core/admin-models';
import { AuthService } from '../core/auth.service';
import { Icon, IconName } from '../ui/icon';
import { Logo } from '../ui/logo';
import { NotificationMenu } from './notification-menu';
import { shellStyles } from './shell';
import { UserMenu } from './user-menu';

interface AdminNavItem {
  label: string;
  link: string;
  icon: IconName;
  exact?: boolean;
  compliance?: boolean;
  count?: (d: AdminDashboard) => number;
}

interface AdminNavGroup {
  label: string | null;
  items: AdminNavItem[];
}

const GROUPS: AdminNavGroup[] = [
  { label: null, items: [{ label: 'Overview', link: '/admin', icon: 'overview', exact: true }] },
  {
    label: 'People',
    items: [
      { label: 'Users', link: '/admin/users', icon: 'user' },
      { label: 'Verification', link: '/admin/kyc', icon: 'id', compliance: true, count: (d) => d.queues.pendingKyc },
    ],
  },
  {
    label: 'Money',
    items: [
      { label: 'Withdrawals', link: '/admin/withdrawals', icon: 'arrow-up', count: (d) => d.queues.pendingWithdrawals + d.queues.withdrawalsNeedingAttention },
      { label: 'Deposits', link: '/admin/deposits', icon: 'arrow-down' },
      { label: 'Trades', link: '/admin/trades', icon: 'trade' },
      { label: 'Treasury', link: '/admin/treasury', icon: 'coins', compliance: true },
    ],
  },
  {
    label: 'Risk',
    items: [
      { label: 'Alerts', link: '/admin/aml', icon: 'flag', exact: true, compliance: true, count: (d) => d.queues.openAmlAlerts },
      { label: 'Rules', link: '/admin/aml/rules', icon: 'sliders', compliance: true },
      { label: 'Block list', link: '/admin/aml/blocklist', icon: 'ban', compliance: true },
    ],
  },
  {
    label: 'P2P',
    items: [
      { label: 'Disputes', link: '/admin/p2p/disputes', icon: 'scale', compliance: true, count: (d) => d.queues.openDisputes },
      { label: 'Ads', link: '/admin/p2p/ads', icon: 'list', compliance: true },
      { label: 'Orders', link: '/admin/p2p/orders', icon: 'receipt', compliance: true },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', link: '/admin/settings', icon: 'sliders' },
      { label: 'Reports', link: '/admin/reports', icon: 'download', compliance: true },
      { label: 'Audit log', link: '/admin/audit', icon: 'ledger', compliance: true },
      { label: 'Health', link: '/admin/system', icon: 'activity', compliance: true },
    ],
  },
];

@Component({
  selector: 'cx-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo, NotificationMenu, UserMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-open]': 'drawer()' },
  styles: [
    shellStyles,
    `
      .rail {
        border-right: 1px solid var(--rule);
        background: var(--surface);
        color: var(--ink);
      }

      .rail::before {
        content: '';
        position: absolute;
        inset: 0 0 auto;
        height: 3px;
        background: var(--dye);
      }

      .nav a {
        color: var(--ink-2);
      }

      .nav a:hover {
        background: var(--hover);
        color: var(--ink);
      }

      .nav a.is-active {
        background: var(--sunken);
        color: var(--ink);
      }

      .nav a.is-active::before {
        content: '';
        position: absolute;
        top: 0.55rem;
        bottom: 0.55rem;
        left: -0.75rem;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: var(--primary);
      }

      .nav a .count {
        background: var(--signal-soft);
        color: var(--signal-text);
      }

      .nav__group {
        color: var(--ink-3);
        opacity: 1;
      }

      .env {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        min-width: 0;
      }

      .env .chip.is-sim {
        border-color: color-mix(in srgb, var(--warn) 40%, var(--rule));
        background: var(--warn-soft);
        color: var(--warn);
      }

      .gate {
        margin: var(--space-6);
      }
    `,
  ],
  template: `
    <a class="skip" href="#content" (click)="focusContent($event)">Skip to content</a>

    <aside class="rail" aria-label="Back office navigation">
      <div class="rail__top">
        <a routerLink="/admin" aria-label="Back office overview"><cx-logo [size]="26" tag="Back office" /></a>
        <button type="button" class="btn btn--quiet btn--icon rail__close" (click)="drawer.set(false)" aria-label="Close menu">
          <cx-icon name="x" />
        </button>
      </div>

      <nav class="nav">
        @for (group of groups(); track $index) {
          @if (group.label) {
            <div class="nav__group">{{ group.label }}</div>
          }
          @for (item of group.items; track item.link) {
            <a [routerLink]="item.link" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: !!item.exact }" ariaCurrentWhenActive="page">
              <cx-icon [name]="item.icon" />
              {{ item.label }}
              @if (countFor(item); as count) {
                <span class="count" [attr.aria-label]="count + ' waiting'">{{ count }}</span>
              }
            </a>
          }
        }
      </nav>
    </aside>

    <div class="scrim" (click)="drawer.set(false)" aria-hidden="true"></div>

    <div class="main">
      <header class="topbar">
        <button type="button" class="btn btn--quiet btn--icon topbar__menu" (click)="drawer.set(true)" aria-label="Open menu" [attr.aria-expanded]="drawer()">
          <cx-icon name="menu" />
        </button>
        @if (dashboard(); as d) {
          <div class="env" aria-label="Environment">
            <span class="chip" [class.is-sim]="d.blockchainMode === 'Simulated'">Blockchain: {{ d.blockchainMode }}</span>
            <span class="chip" [class.is-sim]="d.paymentsProvider === 'simulated'">Payments: {{ d.paymentsProvider }}</span>
            <span class="chip" [class.is-sim]="d.priceFeed.provider === 'simulated'">Prices: {{ d.priceFeed.provider }}</span>
          </div>
        }
        <div class="topbar__actions">
          <cx-notification-menu />
          <cx-user-menu [inAdmin]="true" />
        </div>
      </header>

      <main id="content" tabindex="-1">
        @if (mfaRequired()) {
          <div class="notice notice--warn gate" role="alert">
            <cx-icon name="lock" [size]="18" />
            <div class="notice__body">
              <strong>Two-factor authentication required</strong>
              <span>Staff must sign in with two-factor authentication. Turn it on in Security, then sign out and back in.</span>
              <a class="link" routerLink="/account/security">Open security settings</a>
            </div>
          </div>
        }
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminShell {
  private readonly api = inject(AdminApi);
  protected readonly auth = inject(AuthService);
  protected readonly drawer = signal(false);
  protected readonly dashboard = signal<AdminDashboard | null>(null);
  protected readonly mfaRequired = signal(false);

  protected readonly groups = computed(() => {
    const compliance = this.auth.isCompliance();
    return GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => compliance || !item.compliance) })).filter((group) => group.items.length);
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        this.drawer.set(false);
        this.refresh();
      });

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.refresh();
      }
    }, 60_000);
    destroyRef.onDestroy(() => clearInterval(timer));
  }

  countFor(item: AdminNavItem): number {
    const dashboard = this.dashboard();
    return dashboard && item.count ? item.count(dashboard) : 0;
  }

  refresh(): void {
    this.api.dashboard().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.mfaRequired.set(false);
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 403) {
          this.mfaRequired.set(true);
        }
      },
    });
  }

  focusContent(event: Event): void {
    event.preventDefault();
    document.getElementById('content')?.focus();
  }
}
