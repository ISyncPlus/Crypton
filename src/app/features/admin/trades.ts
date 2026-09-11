import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { formatAsset, formatDateTime, formatNgn } from '../../core/format';
import { AssetCode } from '../../core/models';
import { Pager } from '../../ui/pager';
import { adminTableStyles, pagedList } from './admin-shared';

@Component({
  selector: 'cx-admin-trades',
  imports: [RouterLink, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [adminTableStyles],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Trades</h1>
          <p class="lede">Instant buys, sells and swaps against the Crypton treasury.</p>
        </div>
        @if (userId()) {
          <a class="btn btn--sm" routerLink="/admin/trades">Show all users</a>
        }
      </header>

      <section class="panel" aria-label="Trades">
        @if (list.data(); as page) {
          <div class="table-wrap frame" [class.is-loading]="list.loading()">
            <table class="table">
              <thead>
                <tr><th scope="col">User</th><th scope="col">Trade</th><th scope="col" class="end">Paid</th><th scope="col" class="end">Received</th><th scope="col" class="end">Fee</th><th scope="col" class="end">Value</th><th scope="col">Time</th></tr>
              </thead>
              <tbody>
                @for (row of page.items; track row.trade.id) {
                  <tr>
                    <td><a class="user-link" [routerLink]="['/admin/users', row.userId]">{{ row.userEmail }}</a></td>
                    <td>{{ row.trade.kind }} {{ row.trade.kind === 'Sell' ? row.trade.fromAsset : row.trade.toAsset }}</td>
                    <td class="end figure">{{ asset(row.trade.fromAmount, row.trade.fromAsset) }}</td>
                    <td class="end figure">{{ asset(row.trade.toAmount, row.trade.toAsset) }}</td>
                    <td class="end figure muted">{{ asset(row.trade.fee, row.trade.feeAsset) }}</td>
                    <td class="end figure">{{ ngn(row.trade.ngnValue) }}</td>
                    <td class="muted">{{ when(row.trade.createdAt) }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="7"><div class="empty"><strong>No trades yet</strong></div></td></tr>
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
export class AdminTrades {
  private readonly api = inject(AdminApi);
  readonly userId = input<string>();
  protected readonly list = pagedList((p) => this.api.trades(p), () => ({ userId: this.userId() }));

  protected asset(value: string, code: AssetCode): string {
    return formatAsset(value, code, { full: true });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
