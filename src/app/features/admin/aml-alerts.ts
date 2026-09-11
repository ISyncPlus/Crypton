import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { AdminAlert } from '../../core/admin-models';
import { formatDateTime } from '../../core/format';
import { amlRule } from '../../core/labels';
import { AmlAlertStatus } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Dialogs } from '../../ui/dialogs';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';
import { adminTableStyles, pagedList } from './admin-shared';

@Component({
  selector: 'cx-admin-alerts',
  imports: [RouterLink, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    adminTableStyles,
    `
      .severity {
        display: inline-grid;
        place-items: center;
        min-width: 2rem;
        padding: 0.1rem 0.4rem;
        border-radius: var(--radius-sm);
        background: var(--sunken);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
        font-weight: 650;
      }

      .severity.is-high {
        background: var(--down-soft);
        color: var(--down);
      }

      .severity.is-medium {
        background: var(--warn-soft);
        color: var(--warn);
      }

      details pre {
        max-width: 36rem;
        max-height: 12rem;
        margin: var(--space-2) 0 0;
        overflow: auto;
        padding: var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--surface-2);
        font-size: var(--text-xs);
        white-space: pre-wrap;
      }
    `,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Compliance alerts</h1>
          <p class="lede">Raised by the monitoring rules. Blocking rules have already stopped the activity; review and flag rules need a decision.</p>
        </div>
        <a class="btn btn--sm" routerLink="/admin/aml/rules">Edit rules</a>
      </header>

      <div class="filters">
        <div class="segmented" role="group" aria-label="Status">
          @for (option of statuses; track option.label) {
            <button type="button" [attr.aria-pressed]="status() === option.value" (click)="setStatus(option.value)">{{ option.label }}</button>
          }
        </div>
        @if (userId()) {
          <a class="btn btn--sm btn--quiet" routerLink="/admin/aml">Clear user filter</a>
        }
      </div>

      <section class="panel" aria-label="Alerts">
        @if (list.data(); as page) {
          <div class="table-wrap frame" [class.is-loading]="list.loading()">
            <table class="table">
              <thead>
                <tr><th scope="col">Severity</th><th scope="col">Alert</th><th scope="col">User</th><th scope="col">Status</th><th scope="col">Raised</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                @for (a of page.items; track a.id) {
                  <tr>
                    <td><span class="severity" [class.is-high]="a.severity >= 70" [class.is-medium]="a.severity >= 40 && a.severity < 70">{{ a.severity }}</span></td>
                    <td>
                      <strong>{{ rule(a.ruleCode) }}</strong>
                      <span class="chip" style="margin-left: 0.4rem">{{ a.action }}</span>
                      <div class="sub">{{ a.summary }}</div>
                      <div class="sub">{{ subject(a) }}</div>
                      @if (a.details) {
                        <details>
                          <summary class="sub" style="cursor: pointer">Details</summary>
                          <pre>{{ pretty(a.details) }}</pre>
                        </details>
                      }
                    </td>
                    <td><a class="user-link" [routerLink]="['/admin/users', a.userId]">{{ a.userEmail }}</a></td>
                    <td>
                      <cx-status kind="alert" [status]="a.status" />
                      @if (a.resolutionNote) {
                        <div class="sub">{{ a.resolutionNote }}</div>
                      }
                    </td>
                    <td class="muted">{{ when(a.createdAt) }}</td>
                    <td>
                      @if (a.status === 'Open') {
                        <div class="actions">
                          <button type="button" class="btn btn--sm" [disabled]="!!busyId()" [attr.aria-busy]="busyId() === a.id" (click)="resolve(a, 'Dismissed')">Dismiss</button>
                          <button type="button" class="btn btn--sm btn--danger" [disabled]="!!busyId()" (click)="resolve(a, 'Confirmed')">Confirm</button>
                        </div>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6"><div class="empty"><strong>No alerts</strong><p>Nothing matches this filter.</p></div></td></tr>
                }
              </tbody>
            </table>
          </div>
          <cx-pager [page]="page.page" [pageSize]="page.pageSize" [totalCount]="page.totalCount" [totalPages]="page.totalPages" (pageChange)="list.page.set($event)" />
        } @else {
          <div class="panel__body"><span class="skeleton" style="height: 12rem"></span></div>
        }
      </section>
    </div>
  `,
})
export class AdminAlerts implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);

  readonly userId = input<string>();

  protected readonly statuses: { label: string; value: AmlAlertStatus | '' }[] = [
    { label: 'Open', value: 'Open' },
    { label: 'Confirmed', value: 'Confirmed' },
    { label: 'Dismissed', value: 'Dismissed' },
    { label: 'All', value: '' },
  ];
  protected readonly status = signal<AmlAlertStatus | ''>('Open');
  protected readonly busyId = signal<string | null>(null);
  protected readonly list = pagedList((p) => this.api.alerts(p), () => ({ status: this.status(), userId: this.userId() }));

  ngOnInit(): void {
    if (this.userId()) {
      this.status.set('');
    }
  }

  setStatus(status: AmlAlertStatus | ''): void {
    this.status.set(status);
    this.list.page.set(1);
  }

  async resolve(alert: AdminAlert, status: 'Dismissed' | 'Confirmed'): Promise<void> {
    const note = await this.dialogs.prompt({
      title: status === 'Confirmed' ? 'Confirm this alert?' : 'Dismiss this alert?',
      body:
        status === 'Confirmed'
          ? 'Confirming records that the activity is suspicious. Freeze the account or reject pending withdrawals separately if needed, and file any required report.'
          : 'Dismissing records that the activity is legitimate.',
      label: 'Note',
      required: status === 'Confirmed',
      multiline: true,
      confirmLabel: status === 'Confirmed' ? 'Confirm alert' : 'Dismiss alert',
      tone: status === 'Confirmed' ? 'danger' : 'primary',
    });
    if (note === null) {
      return;
    }

    this.busyId.set(alert.id);
    this.api.resolveAlert(alert.id, status, note || undefined).subscribe({
      next: () => {
        this.busyId.set(null);
        this.list.replace((a) => a.id === alert.id, { ...alert, status, resolutionNote: note || null, resolvedAt: new Date().toISOString() });
        this.toast.success(status === 'Confirmed' ? 'Alert confirmed' : 'Alert dismissed');
      },
      error: (e: unknown) => {
        this.busyId.set(null);
        this.toast.error(e);
      },
    });
  }

  protected rule(code: string): string {
    return amlRule(code).name;
  }

  protected subject(a: AdminAlert): string {
    return `${a.subjectType.replace(/([a-z])([A-Z])/g, '$1 $2')}${a.subjectId ? ' ' + a.subjectId.slice(0, 8) : ''}`;
  }

  protected pretty(details: string): string {
    try {
      return JSON.stringify(JSON.parse(details), null, 2);
    } catch {
      return details;
    }
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
