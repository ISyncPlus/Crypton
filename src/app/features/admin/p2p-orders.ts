import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { formatAsset, formatDateTime, formatNgn } from '../../core/format';
import { P2POrderStatus } from '../../core/models';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';
import { adminTableStyles, pagedList } from './admin-shared';

const STATUSES: P2POrderStatus[] = ['PendingPayment', 'Paid', 'Disputed', 'Completed', 'Cancelled', 'Expired', 'ResolvedToBuyer', 'ResolvedToSeller'];

@Component({
  selector: 'cx-admin-p2p-orders',
  imports: [RouterLink, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [adminTableStyles],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">P2P orders</h1>
          <p class="lede">Every person-to-person order and where it stands.</p>
        </div>
      </header>

      <div class="filters">
        <select class="select" aria-label="Status" [value]="status()" (change)="setStatus($any($event.target).value)">
          <option value="">All statuses</option>
          @for (s of statuses; track s) {
            <option [value]="s" [selected]="s === status()">{{ s.replace('To', ' to ') }}</option>
          }
        </select>
      </div>

      <section class="panel" aria-label="Orders">
        @if (list.data(); as page) {
          <div class="table-wrap frame" [class.is-loading]="list.loading()">
            <table class="table">
              <thead><tr><th scope="col">Order</th><th scope="col" class="end">Crypto</th><th scope="col" class="end">Naira</th><th scope="col">Buyer</th><th scope="col">Seller</th><th scope="col">Status</th></tr></thead>
              <tbody>
                @for (o of page.items; track o.id) {
                  <tr>
                    <td><span class="mono">#{{ o.orderNumber }}</span><div class="sub">{{ when(o.createdAt) }}</div></td>
                    <td class="end figure">{{ asset(o.quantity, o.asset) }}</td>
                    <td class="end"><span class="figure">{{ ngn(o.fiatAmount) }}</span><div class="sub">at {{ ngn(o.price) }}</div></td>
                    <td><a class="user-link" [routerLink]="['/admin/users', o.buyerId]">{{ o.buyerEmail }}</a></td>
                    <td><a class="user-link" [routerLink]="['/admin/users', o.sellerId]">{{ o.sellerEmail }}</a></td>
                    <td><cx-status kind="p2pOrder" [status]="o.status" /></td>
                  </tr>
                } @empty {
                  <tr><td colspan="6"><div class="empty"><strong>No orders match</strong></div></td></tr>
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
export class AdminP2POrders {
  private readonly api = inject(AdminApi);
  protected readonly statuses = STATUSES;
  protected readonly status = signal('');
  protected readonly list = pagedList((p) => this.api.p2pOrders(p), () => ({ status: this.status() }));

  setStatus(status: string): void {
    this.status.set(status);
    this.list.page.set(1);
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
