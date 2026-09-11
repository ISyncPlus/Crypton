import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AdminApi } from '../../core/admin-api.service';
import { AdminCryptoWithdrawal, AdminFiatWithdrawal } from '../../core/admin-models';
import { AuthService } from '../../core/auth.service';
import { formatAsset, formatDateTime, formatNgn, shortAddress } from '../../core/format';
import { MarketService } from '../../core/market.service';
import { ToastService } from '../../core/toast.service';
import { CopyButton } from '../../ui/copy-button';
import { Dialogs } from '../../ui/dialogs';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';
import { adminTableStyles, pagedList } from './admin-shared';

const CRYPTO_STATUSES = ['PendingReview', 'NeedsAttention', 'Approved', 'Broadcasting', 'Broadcast', 'Confirmed', 'Rejected', 'Cancelled', 'Failed'];
const FIAT_STATUSES = ['PendingReview', 'NeedsAttention', 'Approved', 'Processing', 'Succeeded', 'Failed', 'Reversed', 'Rejected', 'Cancelled'];

@Component({
  selector: 'cx-admin-withdrawals',
  imports: [RouterLink, CopyButton, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    adminTableStyles,
    `
      .risk {
        max-width: 22rem;
        color: var(--warn);
        font-size: var(--text-xs);
      }
    `,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Withdrawals</h1>
          <p class="lede">Review flagged withdrawals and resolve ones that need attention.</p>
        </div>
      </header>

      <div class="filters">
        <div class="segmented" role="group" aria-label="Withdrawal type">
          <button type="button" [attr.aria-pressed]="kind() === 'crypto'" (click)="setKind('crypto')">Crypto</button>
          <button type="button" [attr.aria-pressed]="kind() === 'naira'" (click)="setKind('naira')">Naira</button>
        </div>
        <select class="select" aria-label="Status" [value]="statusFilter()" (change)="setStatus($any($event.target).value)">
          <option value="">All statuses</option>
          @for (s of kind() === 'crypto' ? cryptoStatuses : fiatStatuses; track s) {
            <option [value]="s" [selected]="s === statusFilter()">{{ humanize(s) }}</option>
          }
        </select>
      </div>

      @if (kind() === 'crypto') {
        <section class="panel" aria-label="Crypto withdrawals">
          @if (crypto.data(); as page) {
            <div class="table-wrap frame" [class.is-loading]="crypto.loading()">
              <table class="table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col" class="end">Amount</th>
                    <th scope="col">Destination</th>
                    <th scope="col">Status</th>
                    <th scope="col">Requested</th>
                    <th scope="col"><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (w of page.items; track w.id) {
                    <tr>
                      <td>
                        <a class="user-link" [routerLink]="['/admin/users', w.userId]">{{ w.userEmail }}</a>
                        @if (w.riskSummary) {
                          <div class="risk">{{ w.riskSummary }}</div>
                        }
                      </td>
                      <td class="end">
                        <span class="figure">{{ asset(w.amount, w) }}</span>
                        <div class="sub">{{ ngn(w.ngnValue) }}, fee {{ asset(w.fee, w) }}</div>
                      </td>
                      <td>
                        <span class="mono" [title]="w.toAddress">{{ short(w.toAddress) }}</span><cx-copy [value]="w.toAddress" what="address" />
                        @if (w.txHash) {
                          <div class="sub">
                            @if (market.txUrl(w.network, w.txHash); as url) {
                              <a class="link" [href]="url" target="_blank" rel="noopener noreferrer">tx {{ short(w.txHash) }}</a>
                            } @else {
                              tx {{ short(w.txHash) }}
                            }
                            , {{ w.confirmations }} conf{{ w.networkFee ? ', network fee ' + w.networkFee : '' }}
                          </div>
                        }
                      </td>
                      <td>
                        <cx-status kind="cryptoWithdrawal" [status]="w.status" />
                        @if (w.failureReason) {
                          <div class="sub">{{ w.failureReason }}</div>
                        }
                        @if (w.reviewNote) {
                          <div class="sub">Note: {{ w.reviewNote }}</div>
                        }
                        @if (w.broadcastAttempts > 1) {
                          <div class="sub">{{ w.broadcastAttempts }} broadcast attempts</div>
                        }
                      </td>
                      <td class="muted">{{ when(w.createdAt) }}</td>
                      <td>
                        <div class="actions">
                          @if (w.status === 'PendingReview' && auth.isCompliance()) {
                            <button type="button" class="btn btn--sm btn--primary" [attr.aria-busy]="busyId() === w.id" [disabled]="!!busyId()" (click)="approveCrypto(w)">Approve</button>
                            <button type="button" class="btn btn--sm btn--danger" [disabled]="!!busyId()" (click)="rejectCrypto(w)">Reject</button>
                          }
                          @if (w.status === 'NeedsAttention' && auth.isAdmin()) {
                            <button type="button" class="btn btn--sm" [disabled]="!!busyId()" (click)="retryCrypto(w)">Retry</button>
                            <button type="button" class="btn btn--sm" [disabled]="!!busyId()" (click)="markSent(w)">Mark sent</button>
                            <button type="button" class="btn btn--sm btn--danger" [disabled]="!!busyId()" (click)="refundCrypto(w)">Refund</button>
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6"><div class="empty"><strong>Nothing here</strong><p>No crypto withdrawals match this filter.</p></div></td></tr>
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
        <section class="panel" aria-label="Naira withdrawals">
          @if (fiat.data(); as page) {
            <div class="table-wrap frame" [class.is-loading]="fiat.loading()">
              <table class="table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col" class="end">Amount</th>
                    <th scope="col">Bank account</th>
                    <th scope="col">Status</th>
                    <th scope="col">Requested</th>
                    <th scope="col"><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (w of page.items; track w.id) {
                    <tr>
                      <td>
                        <a class="user-link" [routerLink]="['/admin/users', w.userId]">{{ w.userEmail }}</a>
                        <div class="sub mono">{{ w.reference }}</div>
                        @if (w.riskSummary) {
                          <div class="risk">{{ w.riskSummary }}</div>
                        }
                      </td>
                      <td class="end"><span class="figure">{{ ngn(w.amount) }}</span><div class="sub">fee {{ ngn(w.fee) }}</div></td>
                      <td>{{ w.accountName }}<div class="sub">{{ w.bankName }} {{ w.accountNumber }}</div></td>
                      <td>
                        <cx-status kind="fiatWithdrawal" [status]="w.status" />
                        @if (w.failureReason) {
                          <div class="sub">{{ w.failureReason }}</div>
                        }
                        @if (w.transferCode) {
                          <div class="sub mono">{{ w.transferCode }}</div>
                        }
                      </td>
                      <td class="muted">{{ when(w.createdAt) }}</td>
                      <td>
                        <div class="actions">
                          @if (w.status === 'PendingReview' && auth.isCompliance()) {
                            <button type="button" class="btn btn--sm btn--primary" [attr.aria-busy]="busyId() === w.id" [disabled]="!!busyId()" (click)="approveFiat(w)">Approve</button>
                            <button type="button" class="btn btn--sm btn--danger" [disabled]="!!busyId()" (click)="rejectFiat(w)">Reject</button>
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6"><div class="empty"><strong>Nothing here</strong><p>No naira withdrawals match this filter.</p></div></td></tr>
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
export class AdminWithdrawals implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);
  protected readonly auth = inject(AuthService);
  protected readonly market = inject(MarketService);

  readonly status = input<string>();

  protected readonly cryptoStatuses = CRYPTO_STATUSES;
  protected readonly fiatStatuses = FIAT_STATUSES;
  protected readonly kind = signal<'crypto' | 'naira'>('crypto');
  protected readonly statusFilter = signal('');
  protected readonly busyId = signal<string | null>(null);

  protected readonly crypto = pagedList(
    (params) => this.api.cryptoWithdrawals(params),
    () => ({ status: this.kind() === 'crypto' ? this.statusFilter() : '' }),
  );

  protected readonly fiat = pagedList(
    (params) => this.api.fiatWithdrawals(params),
    () => ({ status: this.kind() === 'naira' ? this.statusFilter() : '' }),
  );

  ngOnInit(): void {
    const initial = this.status();
    if (initial) {
      this.statusFilter.set(initial);
    }
  }

  setKind(kind: 'crypto' | 'naira'): void {
    this.kind.set(kind);
    if (this.statusFilter() && !(kind === 'crypto' ? CRYPTO_STATUSES : FIAT_STATUSES).includes(this.statusFilter())) {
      this.statusFilter.set('');
    }
  }

  setStatus(status: string): void {
    this.statusFilter.set(status);
    this.crypto.page.set(1);
    this.fiat.page.set(1);
  }

  async approveCrypto(w: AdminCryptoWithdrawal): Promise<void> {
    const note = await this.dialogs.prompt({
      title: `Approve ${this.asset(w.amount, w)} to ${this.short(w.toAddress)}?`,
      body: w.riskSummary ? `Flags: ${w.riskSummary}` : 'It will be broadcast by the withdrawal processor.',
      label: 'Review note (optional)',
      required: false,
      multiline: true,
      confirmLabel: 'Approve and send',
    });
    if (note !== null) {
      this.run(w.id, this.api.approveCrypto(w.id, note || undefined), (updated) => this.crypto.replace((x) => x.id === updated.id, updated), 'Withdrawal approved');
    }
  }

  async rejectCrypto(w: AdminCryptoWithdrawal): Promise<void> {
    const reason = await this.dialogs.prompt({ title: 'Reject this withdrawal?', body: 'The funds return to the user, who sees this reason.', label: 'Reason', multiline: true, confirmLabel: 'Reject', tone: 'danger' });
    if (reason) {
      this.run(w.id, this.api.rejectCrypto(w.id, reason), (updated) => this.crypto.replace((x) => x.id === updated.id, updated), 'Withdrawal rejected');
    }
  }

  async retryCrypto(w: AdminCryptoWithdrawal): Promise<void> {
    const reason = await this.dialogs.prompt({
      title: 'Retry broadcasting?',
      body: 'Only retry after confirming on the block explorer that the previous transaction is not in the mempool or a block. A second broadcast can double-send.',
      label: 'What you checked',
      multiline: true,
      confirmLabel: 'Retry',
      tone: 'danger',
    });
    if (reason) {
      this.run(w.id, this.api.retryCrypto(w.id, reason), (updated) => this.crypto.replace((x) => x.id === updated.id, updated), 'Withdrawal queued for retry');
    }
  }

  async refundCrypto(w: AdminCryptoWithdrawal): Promise<void> {
    const reason = await this.dialogs.prompt({
      title: 'Refund to the user?',
      body: 'Only refund when you are certain no transaction reached the network. The held amount and fee return to the user.',
      label: 'What you checked',
      multiline: true,
      confirmLabel: 'Refund',
      tone: 'danger',
    });
    if (reason) {
      this.run(w.id, this.api.refundCrypto(w.id, reason), (updated) => this.crypto.replace((x) => x.id === updated.id, updated), 'Withdrawal refunded');
    }
  }

  async markSent(w: AdminCryptoWithdrawal): Promise<void> {
    const txHash = await this.dialogs.prompt({ title: 'Mark as sent', body: 'Use this when the transaction is confirmed on-chain but our records missed it.', label: 'Transaction hash', confirmLabel: 'Continue', maxLength: 128 });
    if (!txHash) {
      return;
    }

    const note = await this.dialogs.prompt({ title: 'Add a note', label: 'How you confirmed it', multiline: true, confirmLabel: 'Mark sent' });
    if (note) {
      this.run(w.id, this.api.markCryptoSent(w.id, txHash, note), (updated) => this.crypto.replace((x) => x.id === updated.id, updated), 'Withdrawal marked as sent');
    }
  }

  async approveFiat(w: AdminFiatWithdrawal): Promise<void> {
    const note = await this.dialogs.prompt({
      title: `Approve ${formatNgn(w.amount)} to ${w.accountName}?`,
      body: w.riskSummary ? `Flags: ${w.riskSummary}` : 'It will be paid out by the transfer processor.',
      label: 'Review note (optional)',
      required: false,
      multiline: true,
      confirmLabel: 'Approve and pay',
    });
    if (note !== null) {
      this.run(w.id, this.api.approveFiat(w.id, note || undefined), (updated) => this.fiat.replace((x) => x.id === updated.id, updated), 'Withdrawal approved');
    }
  }

  async rejectFiat(w: AdminFiatWithdrawal): Promise<void> {
    const reason = await this.dialogs.prompt({ title: 'Reject this withdrawal?', body: 'The funds return to the user, who sees this reason.', label: 'Reason', multiline: true, confirmLabel: 'Reject', tone: 'danger' });
    if (reason) {
      this.run(w.id, this.api.rejectFiat(w.id, reason), (updated) => this.fiat.replace((x) => x.id === updated.id, updated), 'Withdrawal rejected');
    }
  }

  protected asset(value: string, w: AdminCryptoWithdrawal): string {
    return formatAsset(value, w.asset, { full: true });
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

  protected humanize(status: string): string {
    return status.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  private run<T>(id: string, request: Observable<T>, apply: (value: T) => void, success: string): void {
    this.busyId.set(id);
    request.subscribe({
      next: (value) => {
        this.busyId.set(null);
        apply(value);
        this.toast.success(success);
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.toast.error(error);
      },
    });
  }
}
