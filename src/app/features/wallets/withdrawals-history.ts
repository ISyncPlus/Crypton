import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { formatAsset, formatDateTime, formatNgn, shortAddress } from '../../core/format';
import { MarketService } from '../../core/market.service';
import { CryptoWithdrawal, FiatWithdrawal, Page } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WalletService } from '../../core/wallet.service';
import { AssetMark } from '../../ui/asset-mark';
import { CopyButton } from '../../ui/copy-button';
import { Dialogs } from '../../ui/dialogs';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';

const LIVE_CRYPTO = ['PendingReview', 'Approved', 'Broadcasting', 'Broadcast', 'NeedsAttention'];
const LIVE_FIAT = ['PendingReview', 'Approved', 'Processing', 'NeedsAttention'];

@Component({
  selector: 'cx-withdrawals-history',
  imports: [RouterLink, AssetMark, CopyButton, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .asset {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .sub {
      margin-top: 0.15rem;
      color: var(--ink-3);
      font-size: var(--text-xs);
    }

    .hash {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }
  `,
  template: `
    <div class="segmented" role="group" aria-label="Withdrawal type">
      <button type="button" [attr.aria-pressed]="kind() === 'crypto'" (click)="setKind('crypto')">Crypto</button>
      <button type="button" [attr.aria-pressed]="kind() === 'naira'" (click)="setKind('naira')">Naira</button>
    </div>

    @if (kind() === 'crypto') {
      <section class="panel" aria-label="Crypto withdrawals">
        @if (crypto(); as p) {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col" class="end">Amount</th>
                  <th scope="col">To</th>
                  <th scope="col">Status</th>
                  <th scope="col">Requested</th>
                  <th scope="col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (w of p.items; track w.id) {
                  <tr>
                    <td><span class="asset"><cx-asset-mark [asset]="w.asset" [size]="24" />{{ w.asset }}</span></td>
                    <td class="end">
                      <span class="figure">{{ asset(w.amount, w) }}</span>
                      <div class="sub">Fee {{ asset(w.fee, w) }}</div>
                    </td>
                    <td>
                      <span class="hash">
                        <span class="mono" [title]="w.toAddress">{{ short(w.toAddress) }}</span>
                        <cx-copy [value]="w.toAddress" what="address" />
                      </span>
                      @if (w.txHash) {
                        <div class="sub">
                          @if (market.txUrl(w.network, w.txHash); as url) {
                            <a class="link" [href]="url" target="_blank" rel="noopener noreferrer">View transaction</a>
                          } @else {
                            <span class="mono">{{ short(w.txHash) }}</span>
                          }
                        </div>
                      }
                    </td>
                    <td>
                      <cx-status kind="cryptoWithdrawal" [status]="w.status" />
                      @if (w.status === 'Broadcast') {
                        <div class="sub">{{ w.confirmations }} confirmations</div>
                      }
                      @if (w.status === 'NeedsAttention') {
                        <div class="sub">Our team is checking this one. Your funds are safe.</div>
                      } @else if (w.failureReason) {
                        <div class="sub">{{ w.failureReason }}</div>
                      }
                    </td>
                    <td class="muted">{{ when(w.createdAt) }}</td>
                    <td class="end">
                      @if (w.status === 'PendingReview' || w.status === 'Approved') {
                        <button type="button" class="btn btn--sm btn--danger" [attr.aria-busy]="busyId() === w.id" (click)="cancelCrypto(w)">Cancel</button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">
                      <div class="empty">
                        <strong>No crypto withdrawals yet</strong>
                        <p>Send crypto to an external wallet from the Balances tab.</p>
                        <a class="btn btn--sm" routerLink="/wallets/btc/withdraw">Send crypto</a>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <cx-pager [page]="p.page" [pageSize]="p.pageSize" [totalCount]="p.totalCount" [totalPages]="p.totalPages" (pageChange)="loadCrypto($event)" />
        } @else {
          <div class="panel__body"><span class="skeleton" style="height: 10rem"></span></div>
        }
      </section>
    } @else {
      <section class="panel" aria-label="Naira withdrawals">
        @if (naira(); as p) {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Bank account</th>
                  <th scope="col" class="end">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Requested</th>
                  <th scope="col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (w of p.items; track w.id) {
                  <tr>
                    <td>
                      <strong>{{ w.accountName }}</strong>
                      <div class="sub">{{ w.bankName }} ••{{ w.accountNumber.slice(-4) }}</div>
                    </td>
                    <td class="end">
                      <span class="figure">{{ ngn(w.amount) }}</span>
                      <div class="sub">Fee {{ ngn(w.fee) }}</div>
                    </td>
                    <td>
                      <cx-status kind="fiatWithdrawal" [status]="w.status" />
                      @if (w.status === 'NeedsAttention') {
                        <div class="sub">Our team is checking this with the bank. Your funds are safe.</div>
                      } @else if (w.failureReason) {
                        <div class="sub">{{ w.failureReason }}</div>
                      }
                    </td>
                    <td class="muted">{{ when(w.createdAt) }}</td>
                    <td class="end">
                      @if (w.status === 'PendingReview' || w.status === 'Approved') {
                        <button type="button" class="btn btn--sm btn--danger" [attr.aria-busy]="busyId() === w.id" (click)="cancelFiat(w)">Cancel</button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5">
                      <div class="empty">
                        <strong>No naira withdrawals yet</strong>
                        <p>Cash out to a Nigerian bank account in your name.</p>
                        <a class="btn btn--sm" routerLink="/wallets/naira/withdraw">Withdraw naira</a>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <cx-pager [page]="p.page" [pageSize]="p.pageSize" [totalCount]="p.totalCount" [totalPages]="p.totalPages" (pageChange)="loadNaira($event)" />
        } @else {
          <div class="panel__body"><span class="skeleton" style="height: 10rem"></span></div>
        }
      </section>
    }
  `,
})
export class WithdrawalsHistory implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);
  private readonly wallet = inject(WalletService);
  protected readonly market = inject(MarketService);

  protected readonly kind = signal<'crypto' | 'naira'>('crypto');
  protected readonly crypto = signal<Page<CryptoWithdrawal> | null>(null);
  protected readonly naira = signal<Page<FiatWithdrawal> | null>(null);
  protected readonly busyId = signal<string | null>(null);

  private readonly live = computed(() =>
    this.kind() === 'crypto'
      ? (this.crypto()?.items.some((w) => LIVE_CRYPTO.includes(w.status)) ?? false)
      : (this.naira()?.items.some((w) => LIVE_FIAT.includes(w.status)) ?? false),
  );

  constructor() {
    const timer = setInterval(() => {
      if (this.live() && document.visibilityState === 'visible') {
        if (this.kind() === 'crypto') {
          this.loadCrypto(this.crypto()?.page ?? 1);
        } else {
          this.loadNaira(this.naira()?.page ?? 1);
        }
      }
    }, 8_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit(): void {
    this.loadCrypto(1);
    this.loadNaira(1);
  }

  setKind(kind: 'crypto' | 'naira'): void {
    this.userChose = true;
    this.kind.set(kind);
  }

  loadCrypto(page: number): void {
    this.api.cryptoWithdrawals({ page, pageSize: 20 }).subscribe({
      next: (p) => {
        this.crypto.set(p);
        this.pickDefaultTab();
      },
      error: (e: unknown) => this.toast.error(e),
    });
  }

  loadNaira(page: number): void {
    this.api.fiatWithdrawals({ page, pageSize: 20 }).subscribe({
      next: (p) => {
        this.naira.set(p);
        this.pickDefaultTab();
      },
      error: (e: unknown) => this.toast.error(e),
    });
  }

  private userChose = false;

  /** Opens on whichever kind of withdrawal happened most recently, until the user picks a tab. */
  private pickDefaultTab(): void {
    const crypto = this.crypto();
    const naira = this.naira();
    if (this.userChose || !crypto || !naira) {
      return;
    }

    this.userChose = true;
    const latestCrypto = crypto.items[0]?.createdAt ?? '';
    const latestNaira = naira.items[0]?.createdAt ?? '';
    this.kind.set(latestNaira > latestCrypto ? 'naira' : 'crypto');
  }

  async cancelCrypto(w: CryptoWithdrawal): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Cancel this withdrawal?',
      body: `${formatAsset(w.amount, w.asset, { full: true })} plus the fee goes back to your available balance.`,
      confirmLabel: 'Cancel withdrawal',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }

    this.busyId.set(w.id);
    this.api.cancelCryptoWithdrawal(w.id).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.crypto.update((p) => (p ? { ...p, items: p.items.map((x) => (x.id === updated.id ? updated : x)) } : p));
        this.wallet.reload();
        this.toast.success('Withdrawal cancelled');
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.toast.error(error);
        this.loadCrypto(this.crypto()?.page ?? 1);
      },
    });
  }

  async cancelFiat(w: FiatWithdrawal): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Cancel this withdrawal?',
      body: `${formatNgn(w.amount)} plus the ${formatNgn(w.fee)} fee goes back to your available balance.`,
      confirmLabel: 'Cancel withdrawal',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }

    this.busyId.set(w.id);
    this.api.cancelFiatWithdrawal(w.id).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.naira.update((p) => (p ? { ...p, items: p.items.map((x) => (x.id === updated.id ? updated : x)) } : p));
        this.wallet.reload();
        this.toast.success('Withdrawal cancelled');
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.toast.error(error);
        this.loadNaira(this.naira()?.page ?? 1);
      },
    });
  }

  protected asset(value: string, w: CryptoWithdrawal): string {
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
}
