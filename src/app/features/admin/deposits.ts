import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { formatAsset, formatDateTime, formatNgn, shortAddress } from '../../core/format';
import { MarketService } from '../../core/market.service';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';
import { adminTableStyles, pagedList } from './admin-shared';

@Component({
  selector: 'cx-admin-deposits',
  imports: [RouterLink, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [adminTableStyles],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Deposits</h1>
          <p class="lede">Incoming crypto and naira payments across all users.</p>
        </div>
      </header>

      <div class="filters">
        <div class="segmented" role="group" aria-label="Deposit type">
          <button type="button" [attr.aria-pressed]="kind() === 'crypto'" (click)="setKind('crypto')">Crypto</button>
          <button type="button" [attr.aria-pressed]="kind() === 'naira'" (click)="setKind('naira')">Naira</button>
        </div>
        <select class="select" aria-label="Status" [value]="status()" (change)="setStatus($any($event.target).value)">
          <option value="">All statuses</option>
          @for (s of kind() === 'crypto' ? cryptoStatuses : fiatStatuses; track s) {
            <option [value]="s" [selected]="s === status()">{{ s }}</option>
          }
        </select>
      </div>

      @if (kind() === 'crypto') {
        <section class="panel" aria-label="Crypto deposits">
          @if (crypto.data(); as page) {
            <div class="table-wrap frame" [class.is-loading]="crypto.loading()">
              <table class="table">
                <thead>
                  <tr><th scope="col">User</th><th scope="col" class="end">Amount</th><th scope="col">Transaction</th><th scope="col">Status</th><th scope="col">Detected</th></tr>
                </thead>
                <tbody>
                  @for (row of page.items; track row.deposit.id) {
                    <tr>
                      <td><a class="user-link" [routerLink]="['/admin/users', row.userId]">{{ row.userEmail }}</a><div class="sub mono">{{ short(row.address) }}</div></td>
                      <td class="end"><span class="figure">{{ asset(row.deposit.amount, row.deposit.asset) }}</span><div class="sub">{{ ngn(row.ngnValue) }}</div></td>
                      <td>
                        @if (market.txUrl(row.deposit.network, row.deposit.txHash); as url) {
                          <a class="link mono" [href]="url" target="_blank" rel="noopener noreferrer">{{ short(row.deposit.txHash) }}</a>
                        } @else {
                          <span class="mono">{{ short(row.deposit.txHash) }}</span>
                        }
                        <div class="sub">{{ row.deposit.confirmations }} of {{ row.deposit.requiredConfirmations }} confirmations</div>
                      </td>
                      <td>
                        <cx-status kind="deposit" [status]="row.deposit.status" />
                        @if (row.deposit.rejectionReason) {
                          <div class="sub">{{ row.deposit.rejectionReason }}</div>
                        }
                      </td>
                      <td class="muted">{{ when(row.deposit.detectedAt) }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5"><div class="empty"><strong>No crypto deposits match</strong></div></td></tr>
                  }
                </tbody>
              </table>
            </div>
            <cx-pager [page]="page.page" [pageSize]="page.pageSize" [totalCount]="page.totalCount" [totalPages]="page.totalPages" (pageChange)="crypto.page.set($event)" />
          } @else {
            <div class="panel__body"><span class="skeleton" style="height: 12rem"></span></div>
          }
        </section>
      } @else {
        <section class="panel" aria-label="Naira deposits">
          @if (fiat.data(); as page) {
            <div class="table-wrap frame" [class.is-loading]="fiat.loading()">
              <table class="table">
                <thead>
                  <tr><th scope="col">User</th><th scope="col" class="end">Amount</th><th scope="col" class="end">Fees</th><th scope="col">Status</th><th scope="col">Started</th></tr>
                </thead>
                <tbody>
                  @for (row of page.items; track row.deposit.id) {
                    <tr>
                      <td><a class="user-link" [routerLink]="['/admin/users', row.userId]">{{ row.userEmail }}</a><div class="sub mono">{{ row.deposit.reference }}</div></td>
                      <td class="end figure">{{ ngn(row.deposit.amount) }}</td>
                      <td class="end"><span class="figure">{{ ngn(row.deposit.fee) }}</span><div class="sub">provider {{ ngn(row.providerFee) }}</div></td>
                      <td>
                        <cx-status kind="fiatDeposit" [status]="row.deposit.status" />
                        <div class="sub">{{ row.provider }}{{ row.gatewayResponse ? ': ' + row.gatewayResponse : '' }}</div>
                      </td>
                      <td class="muted">{{ when(row.deposit.createdAt) }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5"><div class="empty"><strong>No naira deposits match</strong></div></td></tr>
                  }
                </tbody>
              </table>
            </div>
            <cx-pager [page]="page.page" [pageSize]="page.pageSize" [totalCount]="page.totalCount" [totalPages]="page.totalPages" (pageChange)="fiat.page.set($event)" />
          } @else {
            <div class="panel__body"><span class="skeleton" style="height: 12rem"></span></div>
          }
        </section>
      }
    </div>
  `,
})
export class AdminDeposits {
  private readonly api = inject(AdminApi);
  protected readonly market = inject(MarketService);

  protected readonly cryptoStatuses = ['Pending', 'Credited', 'Rejected'];
  protected readonly fiatStatuses = ['Initiated', 'Succeeded', 'Failed', 'Abandoned'];
  protected readonly kind = signal<'crypto' | 'naira'>('crypto');
  protected readonly status = signal('');

  protected readonly crypto = pagedList((p) => this.api.cryptoDeposits(p), () => ({ status: this.kind() === 'crypto' ? this.status() : '' }));
  protected readonly fiat = pagedList((p) => this.api.fiatDeposits(p), () => ({ status: this.kind() === 'naira' ? this.status() : '' }));

  setKind(kind: 'crypto' | 'naira'): void {
    this.kind.set(kind);
    this.status.set('');
  }

  setStatus(status: string): void {
    this.status.set(status);
    this.crypto.page.set(1);
    this.fiat.page.set(1);
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

  protected short(value: string): string {
    return shortAddress(value, 8, 6);
  }
}
