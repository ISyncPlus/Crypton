import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ClockService } from '../core/clock.service';
import { relativeTime } from '../core/format';
import { AppNotification } from '../core/models';
import { NotificationsService } from '../core/notifications.service';
import { Icon } from '../ui/icon';

@Component({
  selector: 'cx-notification-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .trigger {
      position: relative;
    }

    .badge {
      position: absolute;
      top: 0.2rem;
      right: 0.15rem;
      min-width: 1.05rem;
      height: 1.05rem;
      padding: 0 0.25rem;
      border-radius: var(--radius-pill);
      background: var(--signal);
      color: #1b1300;
      font-size: 0.625rem;
      font-weight: 700;
      line-height: 1.05rem;
      text-align: center;
    }

    .panel {
      width: 23rem;
    }

    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-2) var(--space-3);
    }

    .head strong {
      font-weight: 600;
    }

    .note {
      display: grid;
      grid-template-columns: 0.5rem 1fr;
      gap: var(--space-3);
      align-items: start;
      min-height: auto;
      padding: var(--space-3);
    }

    .dot {
      width: 0.5rem;
      height: 0.5rem;
      margin-top: 0.45rem;
      border-radius: 50%;
    }

    .note.is-unread .dot {
      background: var(--signal);
    }

    .note__title {
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .note__body {
      display: -webkit-box;
      overflow: hidden;
      color: var(--ink-2);
      font-size: var(--text-sm);
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .note__time {
      margin-top: 0.15rem;
      color: var(--ink-3);
      font-size: var(--text-xs);
    }

    .empty-note {
      padding: var(--space-5) var(--space-3);
      color: var(--ink-3);
      font-size: var(--text-sm);
      text-align: center;
    }

    .all {
      justify-content: center;
      color: var(--info);
      font-size: var(--text-sm);
      font-weight: 550;
    }
  `,
  template: `
    <button
      type="button"
      class="btn btn--quiet btn--icon trigger"
      [cdkMenuTriggerFor]="panel"
      [cdkMenuPosition]="[{ originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 }]"
      (cdkMenuOpened)="notifications.loadRecent()"
      [attr.aria-label]="notifications.unread() ? notifications.unread() + ' unread notifications' : 'Notifications'"
    >
      <cx-icon name="bell" [size]="19" />
      @if (notifications.unread() > 0) {
        <span class="badge" aria-hidden="true">{{ notifications.unread() > 99 ? '99+' : notifications.unread() }}</span>
      }
    </button>

    <ng-template #panel>
      <div class="menu panel" cdkMenu>
        <div class="head">
          <strong>Notifications</strong>
          @if (notifications.unread() > 0) {
            <button type="button" class="link" (click)="notifications.markAllRead()">Mark all read</button>
          }
        </div>
        <div class="menu__rule"></div>
        @for (note of notifications.recent(); track note.id) {
          <button type="button" class="menu__item note" [class.is-unread]="!note.read" cdkMenuItem (cdkMenuItemTriggered)="open(note)">
            <span class="dot" aria-hidden="true"></span>
            <span>
              <span class="note__title">{{ note.title }}</span>
              <span class="note__body">{{ note.body }}</span>
              <span class="note__time">{{ ago(note.createdAt) }}</span>
            </span>
          </button>
        } @empty {
          <p class="empty-note">{{ notifications.loading() ? 'Loading…' : 'Nothing new. Deposits, withdrawals and P2P updates show up here.' }}</p>
        }
        <div class="menu__rule"></div>
        <a class="menu__item all" cdkMenuItem [routerLink]="allLink">See all notifications</a>
      </div>
    </ng-template>
  `,
})
export class NotificationMenu {
  protected readonly notifications = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly clock = inject(ClockService);
  protected readonly allLink = '/account/notifications';

  open(note: AppNotification): void {
    this.notifications.markRead(note);
    if (note.link && note.link.startsWith('/') && !note.link.startsWith('//')) {
      void this.router.navigateByUrl(note.link);
    }
  }

  ago(iso: string): string {
    return relativeTime(iso, this.clock.now());
  }
}
