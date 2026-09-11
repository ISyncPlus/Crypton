import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { Api } from '../../core/api.service';
import { formatDateTime } from '../../core/format';
import { AppNotification, Page } from '../../core/models';
import { NotificationsService } from '../../core/notifications.service';
import { Icon, IconName } from '../../ui/icon';
import { Pager } from '../../ui/pager';

const ICONS: Record<string, IconName> = {
  security: 'lock',
  deposit: 'arrow-down',
  withdrawal: 'arrow-up',
  trade: 'trade',
  kyc: 'id',
  p2p: 'people',
  compliance: 'flag',
  system: 'info',
};

@Component({
  selector: 'cx-notifications',
  imports: [Icon, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--space-1) var(--space-4);
      width: 100%;
      padding: var(--space-4) var(--space-5);
      border: 0;
      background: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .item + .item {
      border-top: 1px solid var(--rule);
    }

    .item:hover {
      background: var(--hover);
    }

    .item__icon {
      display: grid;
      grid-row: span 2;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      background: var(--sunken);
      color: var(--ink-2);
    }

    .item.is-unread .item__icon {
      background: var(--signal-soft);
      color: var(--signal-text);
    }

    .item__title {
      font-weight: 600;
    }

    .item.is-unread .item__title::after {
      content: '';
      display: inline-block;
      width: 0.45rem;
      height: 0.45rem;
      margin-left: 0.4rem;
      border-radius: 50%;
      background: var(--signal);
      vertical-align: middle;
    }

    .item__body {
      grid-column: 2 / 4;
      color: var(--ink-2);
      font-size: var(--text-sm);
    }

    .item__time {
      color: var(--ink-3);
      font-size: var(--text-xs);
      white-space: nowrap;
    }
  `,
  template: `
    <div class="row-between">
      <div class="segmented" role="group" aria-label="Filter notifications">
        <button type="button" [attr.aria-pressed]="!unreadOnly()" (click)="setUnread(false)">All</button>
        <button type="button" [attr.aria-pressed]="unreadOnly()" (click)="setUnread(true)">Unread</button>
      </div>
      <button type="button" class="btn btn--sm" [disabled]="notifications.unread() === 0" (click)="markAll()">Mark all as read</button>
    </div>

    <section class="panel" aria-label="Notifications">
      @if (page(); as p) {
        @for (note of p.items; track note.id) {
          <button type="button" class="item" [class.is-unread]="!note.read" (click)="open(note)">
            <span class="item__icon"><cx-icon [name]="icon(note.type)" [size]="16" /></span>
            <span class="item__title">{{ note.title }}</span>
            <span class="item__time">{{ when(note.createdAt) }}</span>
            <span class="item__body">{{ note.body }}</span>
          </button>
        } @empty {
          <div class="empty">
            <strong>{{ unreadOnly() ? "You're all caught up" : 'No notifications yet' }}</strong>
            <p>Deposits, withdrawals, verification results and P2P updates appear here.</p>
          </div>
        }
        <cx-pager [page]="p.page" [pageSize]="p.pageSize" [totalCount]="p.totalCount" [totalPages]="p.totalPages" (pageChange)="pageNumber.set($event)" />
      } @else {
        <div class="panel__body"><span class="skeleton" style="height: 12rem"></span></div>
      }
    </section>
  `,
})
export class Notifications {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly notifications = inject(NotificationsService);

  protected readonly unreadOnly = signal(false);
  protected readonly pageNumber = signal(1);
  protected readonly page = signal<Page<AppNotification> | null>(null);
  private readonly reloadTick = signal(0);

  constructor() {
    toObservable(computed(() => ({ unreadOnly: this.unreadOnly(), page: this.pageNumber(), tick: this.reloadTick() })))
      .pipe(
        switchMap((q) => this.api.notifications({ unreadOnly: q.unreadOnly, page: q.page, pageSize: 20 }).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        if (page) {
          this.page.set(page);
        }
      });
  }

  setUnread(value: boolean): void {
    this.unreadOnly.set(value);
    this.pageNumber.set(1);
  }

  open(note: AppNotification): void {
    if (!note.read) {
      this.notifications.markRead(note);
      this.page.update((p) => (p ? { ...p, items: p.items.map((n) => (n.id === note.id ? { ...n, read: true } : n)) } : p));
    }

    if (note.link && note.link.startsWith('/') && !note.link.startsWith('//')) {
      void this.router.navigateByUrl(note.link);
    }
  }

  markAll(): void {
    this.notifications.markAllRead();
    this.page.update((p) => (p ? { ...p, items: p.items.map((n) => ({ ...n, read: true })) } : p));
    if (this.unreadOnly()) {
      setTimeout(() => this.reloadTick.update((n) => n + 1), 400);
    }
  }

  protected icon(type: string): IconName {
    return ICONS[type] ?? 'bell';
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
