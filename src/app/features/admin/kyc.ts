import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { formatDateTime } from '../../core/format';
import { KycSubmissionStatus } from '../../core/models';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';
import { adminTableStyles, pagedList } from './admin-shared';

@Component({
  selector: 'cx-admin-kyc',
  imports: [RouterLink, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [adminTableStyles],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Verification queue</h1>
          <p class="lede">Identity details and documents waiting for review. Oldest first is fairest.</p>
        </div>
      </header>

      <div class="segmented" role="group" aria-label="Status">
        @for (option of statuses; track option.label) {
          <button type="button" [attr.aria-pressed]="status() === option.value" (click)="setStatus(option.value)">{{ option.label }}</button>
        }
      </div>

      <section class="panel" aria-label="Submissions">
        @if (list.data(); as page) {
          <div class="table-wrap frame" [class.is-loading]="list.loading()">
            <table class="table">
              <thead>
                <tr><th scope="col">Applicant</th><th scope="col">Level</th><th scope="col">Provider</th><th scope="col">Status</th><th scope="col">Submitted</th></tr>
              </thead>
              <tbody>
                @for (s of page.items; track s.id) {
                  <tr class="is-link" (click)="open(s.id)">
                    <td>
                      <a class="user-link" [routerLink]="['/admin/kyc', s.id]" (click)="$event.stopPropagation()">{{ s.firstName }} {{ s.lastName }}</a>
                      <div class="sub">{{ s.userEmail }}</div>
                    </td>
                    <td>Tier {{ s.targetTier }}{{ s.targetTier === 2 && s.documentKind ? ', ' + s.documentKind.replace('_', ' ') : '' }}</td>
                    <td>{{ s.provider }}</td>
                    <td><cx-status kind="kyc" [status]="s.status" /></td>
                    <td class="muted">{{ when(s.createdAt) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="5"><div class="empty"><strong>Queue is clear</strong><p>No submissions with this status.</p></div></td></tr>
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
export class AdminKyc {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  protected readonly statuses: { label: string; value: KycSubmissionStatus | '' }[] = [
    { label: 'Pending', value: 'Pending' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Rejected', value: 'Rejected' },
    { label: 'All', value: '' },
  ];
  protected readonly status = signal<KycSubmissionStatus | ''>('Pending');
  protected readonly list = pagedList((p) => this.api.kycSubmissions(p), () => ({ status: this.status() }));

  setStatus(status: KycSubmissionStatus | ''): void {
    this.status.set(status);
    this.list.page.set(1);
  }

  open(id: string): void {
    void this.router.navigate(['/admin/kyc', id]);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
