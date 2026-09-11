import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { formatAsset, formatDateTime, formatNgn } from '../../core/format';
import { P2PDisputeStatus } from '../../core/models';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';
import { adminTableStyles, pagedList } from './admin-shared';

@Component({
  selector: 'cx-admin-disputes',
  imports: [RouterLink, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [adminTableStyles],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">P2P disputes</h1>
          <p class="lede">Decide who gets the escrowed crypto when buyer and seller disagree.</p>
        </div>
      </header>

      <div class="segmented" role="group" aria-label="Status">
        @for (option of statuses; track option.label) {
          <button type="button" [attr.aria-pressed]="status() === option.value" (click)="setStatus(option.value)">{{ option.label }}</button>
        }
      </div>

      <section class="panel" aria-label="Disputes">
        @if (list.data(); as page) {
          <div class="table-wrap frame" [class.is-loading]="list.loading()">
            <table class="table">
              <thead><tr><th scope="col">Order</th><th scope="col" class="end">Amount</th><th scope="col">Buyer / seller</th><th scope="col">Reason</th><th scope="col">Status</th><th scope="col">Opened</th></tr></thead>
              <tbody>
                @for (d of page.items; track d.id) {
                  <tr class="is-link" (click)="open(d.id)">
                    <td><a class="user-link mono" [routerLink]="['/admin/p2p/disputes', d.id]" (click)="$event.stopPropagation()">#{{ d.order.orderNumber }}</a><div class="sub">opened by {{ d.openedByRole }}</div></td>
                    <td class="end"><span class="figure">{{ ngn(d.order.fiatAmount) }}</span><div class="sub">{{ asset(d.order.quantity, d.order.asset) }}</div></td>
                    <td>{{ d.order.buyerEmail }}<div class="sub">{{ d.order.sellerEmail }}</div></td>
                    <td style="max-width: 20rem">{{ d.reason }}</td>
                    <td><cx-status kind="dispute" [status]="d.status" /></td>
                    <td class="muted">{{ when(d.createdAt) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="6"><div class="empty"><strong>No disputes</strong><p>Nothing matches this filter.</p></div></td></tr>
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
export class AdminDisputes {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  protected readonly statuses: { label: string; value: P2PDisputeStatus | '' }[] = [
    { label: 'Open', value: 'Open' },
    { label: 'Released to buyer', value: 'ResolvedToBuyer' },
    { label: 'Returned to seller', value: 'ResolvedToSeller' },
    { label: 'All', value: '' },
  ];
  protected readonly status = signal<P2PDisputeStatus | ''>('Open');
  protected readonly list = pagedList((p) => this.api.disputes(p), () => ({ status: this.status() }));

  setStatus(status: P2PDisputeStatus | ''): void {
    this.status.set(status);
    this.list.page.set(1);
  }

  open(id: string): void {
    void this.router.navigate(['/admin/p2p/disputes', id]);
  }

  protected asset(value: string, code: Parameters<typeof formatAsset>[1]): string {
    return formatAsset(value, code, { full: true });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
