import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { formatDateTime } from '../../core/format';
import { Pager } from '../../ui/pager';
import { adminTableStyles, pagedList } from './admin-shared';

@Component({
  selector: 'cx-admin-audit',
  imports: [RouterLink, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    adminTableStyles,
    `
      td.action {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        white-space: nowrap;
      }

      .data {
        max-width: 28rem;
        overflow: hidden;
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--ink-3);
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Audit log</h1>
          <p class="lede">Security events and every staff action, newest first. Entries can't be edited or deleted.</p>
        </div>
      </header>

      <div class="filters">
        <select class="select" aria-label="Action" [value]="action()" (change)="setAction($any($event.target).value)">
          <option value="">All events</option>
          <option value="admin.">Staff actions</option>
          <option value="auth.">Sign-in events</option>
          <option value="security.">Security changes</option>
          <option value="wallet.">Withdrawals</option>
          <option value="kyc.">Verification</option>
          <option value="fiat.">Bank accounts</option>
        </select>
        <input class="input" placeholder="User ID" [value]="user()" (change)="setUser($any($event.target).value)" style="min-width: 20rem" />
      </div>

      <section class="panel" aria-label="Audit entries">
        @if (list.data(); as page) {
          <div class="table-wrap frame" [class.is-loading]="list.loading()">
            <table class="table">
              <thead><tr><th scope="col">When</th><th scope="col">Event</th><th scope="col">Subject</th><th scope="col">Actor</th><th scope="col">IP</th><th scope="col">Data</th></tr></thead>
              <tbody>
                @for (entry of page.items; track entry.id) {
                  <tr>
                    <td class="muted" style="white-space: nowrap">{{ when(entry.createdAt) }}</td>
                    <td class="action">{{ entry.action }}</td>
                    <td>
                      @if (entry.userId) {
                        <a class="user-link mono" [routerLink]="['/admin/users', entry.userId]">{{ entry.userId.slice(0, 8) }}</a>
                      }
                      @if (entry.entityType) {
                        <div class="sub">{{ entry.entityType }} {{ entry.entityId?.slice(0, 12) }}</div>
                      }
                    </td>
                    <td>
                      @if (entry.actorUserId && entry.actorUserId !== entry.userId) {
                        <a class="user-link mono" [routerLink]="['/admin/users', entry.actorUserId]">{{ entry.actorUserId.slice(0, 8) }}</a>
                      } @else {
                        <span class="muted">Self</span>
                      }
                    </td>
                    <td class="mono muted">{{ entry.ipAddress ?? '–' }}</td>
                    <td><div class="data" [title]="entry.data ?? ''">{{ entry.data ?? '' }}</div></td>
                  </tr>
                } @empty {
                  <tr><td colspan="6"><div class="empty"><strong>No entries match</strong></div></td></tr>
                }
              </tbody>
            </table>
          </div>
          <cx-pager [page]="page.page" [pageSize]="page.pageSize" [totalCount]="page.totalCount" [totalPages]="page.totalPages" (pageChange)="list.page.set($event)" />
        } @else {
          <div class="panel__body"><span class="skeleton" style="height: 14rem"></span></div>
        }
      </section>
    </div>
  `,
})
export class AdminAuditLog implements OnInit {
  private readonly api = inject(AdminApi);
  readonly userId = input<string>();

  protected readonly action = signal('');
  protected readonly user = signal('');
  protected readonly list = pagedList((p) => this.api.audit(p), () => ({ action: this.action(), userId: this.user() }), 50);

  ngOnInit(): void {
    const initial = this.userId();
    if (initial) {
      this.user.set(initial);
    }
  }

  setAction(value: string): void {
    this.action.set(value);
    this.list.page.set(1);
  }

  setUser(value: string): void {
    const trimmed = value.trim();
    this.user.set(/^[0-9a-fA-F-]{36}$/.test(trimmed) ? trimmed : '');
    this.list.page.set(1);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
