import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { formatAsset, formatDateTime, formatNgn, shortAddress } from '../../core/format';
import { MarketService } from '../../core/market.service';
import { CryptoDeposit, FiatDeposit, Page } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { AssetMark } from '../../ui/asset-mark';
import { CopyButton } from '../../ui/copy-button';
import { Icon } from '../../ui/icon';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';

@Component({
  selector: 'cx-deposits-history',
  imports: [RouterLink, AssetMark, CopyButton, Icon, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .asset {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .hash {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }

    .progress {
      color: var(--ink-3);
      font-size: var(--text-xs);
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <div class="segmented" role="group" aria-label="Deposit type">
      <button type="button" [attr.aria-pressed]="kind() === 'crypto'" (click)="setKind('crypto')">Crypto</button>
      <button type="button" [attr.aria-pressed]="kind() === 'naira'" (click)="setKind('naira')">Naira</button>
    </div>

    @if (kind() === 'crypto') {
      <section class="panel" aria-label="Crypto deposits">
        @if (crypto(); as p) {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col" class="end">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col">Transaction</th>
                  <th scope="col">Detected</th>
                </tr>
              </thead>
              <tbody>
                @for (d of p.items; track d.id) {
                  <tr>
                    <td><span class="asset"><cx-asset-mark [asset]="d.asset" [size]="24" />{{ d.asset }}</span></td>
                    <td class="end figure">{{ amount(d) }}</td>
                    <td>
                      <cx-status kind="deposit" [status]="d.status" />
                      @if (d.status === 'Pending') {
                        <div class="progress">{{ d.confirmations }} of {{ d.requiredConfirmations }} confirmations</div>
                      }
                      @if (d.rejectionReason) {
                        <div class="progress">{{ d.rejectionReason }}</div>
                      }
                    </td>
                    <td>
                      <span class="hash">
                        @if (market.txUrl(d.network, d.txHash); as url) {
                          <a class="link mono" [href]="url" target="_blank" rel="noopener noreferrer">{{ short(d.txHash) }}</a>
                        } @else {
                          <span class="mono">{{ short(d.txHash) }}</span>
                        }
                        <cx-copy [value]="d.txHash" what="transaction hash" />
                      </span>
                    </td>
                    <td class="muted">{{ when(d.detectedAt) }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5">
                      <div class="empty">
                        <strong>No crypto deposits yet</strong>
                        <p>Send BTC, ETH or USDT to your deposit address and it will show up here.</p>
                        <a class="btn btn--sm" routerLink="/wallets/btc/deposit">Get a deposit address</a>
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
      <section class="panel" aria-label="Naira deposits">
        @if (naira(); as p) {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col" class="end">Paid</th>
                  <th scope="col" class="end">Fee</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (d of p.items; track d.id) {
                  <tr>
                    <td class="mono">{{ d.reference }}</td>
                    <td class="end figure">{{ ngn(d.amount) }}</td>
                    <td class="end figure muted">{{ ngn(d.fee) }}</td>
                    <td><cx-status kind="fiatDeposit" [status]="d.status" /></td>
                    <td class="muted">{{ when(d.createdAt) }}</td>
                    <td class="end">
                      @if (d.status === 'Initiated') {
                        <div class="row" style="justify-content: flex-end">
                          <button type="button" class="btn btn--sm" [attr.aria-busy]="checking() === d.reference" (click)="verify(d)">Check status</button>
                          @if (d.authorizationUrl) {
                            <a class="btn btn--sm btn--quiet" [href]="d.authorizationUrl">Continue payment <cx-icon name="external" [size]="14" /></a>
                          }
                        </div>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">
                      <div class="empty">
                        <strong>No naira deposits yet</strong>
                        <p>Fund your wallet by bank transfer or card.</p>
                        <a class="btn btn--sm" routerLink="/wallets/naira/deposit">Add naira</a>
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
export class DepositsHistory implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  protected readonly market = inject(MarketService);

  protected readonly kind = signal<'crypto' | 'naira'>('crypto');
  protected readonly crypto = signal<Page<CryptoDeposit> | null>(null);
  protected readonly naira = signal<Page<FiatDeposit> | null>(null);
  protected readonly checking = signal<string | null>(null);
  private readonly hasPending = computed(() => this.crypto()?.items.some((d) => d.status === 'Pending') ?? false);

  constructor() {
    const timer = setInterval(() => {
      if (this.kind() === 'crypto' && this.hasPending() && document.visibilityState === 'visible') {
        this.loadCrypto(this.crypto()?.page ?? 1);
      }
    }, 10_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ngOnInit(): void {
    this.loadCrypto(1);
  }

  setKind(kind: 'crypto' | 'naira'): void {
    this.kind.set(kind);
    if (kind === 'naira' && !this.naira()) {
      this.loadNaira(1);
    }
  }

  loadCrypto(page: number): void {
    this.api.cryptoDeposits({ page, pageSize: 20 }).subscribe({ next: (p) => this.crypto.set(p), error: (e: unknown) => this.toast.error(e) });
  }

  loadNaira(page: number): void {
    this.api.fiatDeposits({ page, pageSize: 20 }).subscribe({ next: (p) => this.naira.set(p), error: (e: unknown) => this.toast.error(e) });
  }

  verify(deposit: FiatDeposit): void {
    this.checking.set(deposit.reference);
    this.api.verifyFiatDeposit(deposit.reference).subscribe({
      next: (updated) => {
        this.checking.set(null);
        this.naira.update((page) => (page ? { ...page, items: page.items.map((d) => (d.id === updated.id ? updated : d)) } : page));
        if (updated.status === 'Succeeded') {
          this.toast.success('Deposit credited', `${formatNgn(updated.amount)} paid, ${formatNgn(updated.fee)} fee.`);
        } else if (updated.status === 'Initiated') {
          this.toast.info('Payment not received yet', 'If you just paid, give it a minute and check again.');
        }
      },
      error: (error: unknown) => {
        this.checking.set(null);
        this.toast.error(error);
      },
    });
  }

  protected amount(d: CryptoDeposit): string {
    return formatAsset(d.amount, d.asset, { full: true });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected short(hash: string): string {
    return shortAddress(hash, 10, 6);
  }
}
