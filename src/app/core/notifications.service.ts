import { Injectable, effect, inject, signal } from '@angular/core';
import { Api } from './api.service';
import { AuthService } from './auth.service';
import { AppNotification } from './models';

const POLL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly unread = signal(0);
  readonly recent = signal<AppNotification[]>([]);
  readonly loading = signal(false);

  constructor() {
    effect(() => {
      if (this.auth.user()) {
        this.startPolling();
      } else {
        this.stopPolling();
        this.unread.set(0);
        this.recent.set([]);
      }
    });
  }

  refreshCount(): void {
    this.api.unreadCount().subscribe({ next: ({ count }) => this.unread.set(count), error: () => undefined });
  }

  loadRecent(): void {
    this.loading.set(true);
    this.api.notifications({ page: 1, pageSize: 8 }).subscribe({
      next: (page) => {
        this.recent.set(page.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  markRead(notification: AppNotification): void {
    if (notification.read) {
      return;
    }

    this.recent.update((list) => list.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
    this.unread.update((count) => Math.max(0, count - 1));
    this.api.markRead(notification.id).subscribe({ error: () => this.refreshCount() });
  }

  markAllRead(): void {
    this.recent.update((list) => list.map((n) => ({ ...n, read: true })));
    this.unread.set(0);
    this.api.markAllRead().subscribe({ error: () => this.refreshCount() });
  }

  private startPolling(): void {
    if (this.timer) {
      return;
    }

    this.refreshCount();
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible' && this.auth.user()) {
        this.refreshCount();
      }
    }, POLL_MS);
  }

  private stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
