import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { ASSET_META, formatAsset, formatDateTime, shortAddress } from '../../core/format';
import { AmountInput, checkAmount, errorsMessage, parseAmount } from '../../core/forms';
import { MarketService } from '../../core/market.service';
import { CryptoDeposit, DepositAddress, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { WalletService } from '../../core/wallet.service';
import { CopyButton } from '../../ui/copy-button';
import { Icon } from '../../ui/icon';
import { QrCode } from '../../ui/qr-code';
import { Status } from '../../ui/status';
import { CRYPTO_ASSETS, assetFromSlug, networkWarning } from './wallet-shared';

@Component({
  selector: 'cx-crypto-deposit',
  imports: [RouterLink, CopyButton, Icon, QrCode, Status, AmountInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .address-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--space-5);
      align-items: start;
    }

    .address-box {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3);
      border: 1px solid var(--rule);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }

    .address-box .address {
      flex: 1;
      font-size: var(--text-md);
      line-height: 1.5;
    }

    .test {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px dashed color-mix(in srgb, var(--warn) 55%, var(--rule));
      border-radius: var(--radius-sm);
      background: var(--warn-soft);
    }

    .test__row {
      display: flex;
      gap: var(--space-2);
    }

    .test__row .input {
      flex: 1;
    }

    .deposit {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-1) var(--space-3);
      padding: var(--space-3) var(--space-5);
      font-size: var(--text-sm);
    }

    .deposit + .deposit {
      border-top: 1px solid var(--rule);
    }

    .deposit small {
      color: var(--ink-3);
    }

    @media (max-width: 640px) {
      .address-card {
        grid-template-columns: minmax(0, 1fr);
        justify-items: center;
      }
    }
  `,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/wallets"><cx-icon name="arrow-left" [size]="16" />Wallets</a>
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Deposit {{ name() }}</h1>
          <p class="lede">Send {{ code() }} from another wallet or exchange to your personal Crypton address.</p>
        </div>
        <a class="btn" [routerLink]="['/wallets', code().toLowerCase(), 'withdraw']">Send {{ code() }} instead</a>
      </header>

      <nav class="tabs" aria-label="Choose asset">
        @for (asset of assets; track asset) {
          <a [routerLink]="['/wallets', asset.toLowerCase(), 'deposit']" [class.is-active]="asset === code()" [attr.aria-current]="asset === code() ? 'page' : null">{{ asset }}</a>
        }
      </nav>

      <div class="split">
        <section class="panel" aria-labelledby="address-title">
          <div class="panel__header">
            <h2 class="panel__title" id="address-title">Your {{ code() }} address</h2>
            @if (address(); as a) {
              <span class="chip">{{ networkName() }}</span>
            }
          </div>
          <div class="panel__body stack">
            @if (problem(); as p) {
              <div class="notice notice--bad" role="alert">
                <cx-icon name="alert" [size]="18" />
                <div class="notice__body">
                  <span>{{ p.title }}</span>
                  <button type="button" class="link" (click)="loadAddress()">Try again</button>
                </div>
              </div>
            } @else if (address(); as a) {
              <div class="address-card">
                <cx-qr [value]="a.address" [label]="code() + ' deposit address QR code'" />
                <div class="stack">
                  <div class="address-box">
                    <span class="address">{{ a.address }}</span>
                    <cx-copy [value]="a.address" what="address" label="Copy" />
                  </div>
                  <div class="notice notice--warn">
                    <cx-icon name="alert" [size]="18" />
                    <span>{{ warning() }}</span>
                  </div>
                  <div class="kv">
                    <div class="kv__row"><span class="kv__key">Network</span><span class="kv__value">{{ networkName() }}</span></div>
                    <div class="kv__row"><span class="kv__key">Minimum deposit</span><span class="kv__value figure">{{ fmt(a.minDeposit) }}</span></div>
                    <div class="kv__row"><span class="kv__key">Credited after</span><span class="kv__value">{{ a.requiredConfirmations }} network confirmation{{ a.requiredConfirmations === 1 ? '' : 's' }}</span></div>
                  </div>
                  <p class="caption">Deposits below the minimum can't be credited. This address stays the same, so you can save it.</p>
                </div>
              </div>

              @if (a.simulated) {
                <div class="test">
                  <strong>Test deposit</strong>
                  <p class="secondary">This environment uses a simulated blockchain. Create an incoming {{ code() }} transaction to this address. Simulated blocks arrive every few seconds, so it is credited within about a minute.</p>
                  <div class="test__row">
                    <label class="sr-only" for="test-amount">Test amount</label>
                    <input id="test-amount" class="input" cxAmount [value]="testAmount()" (input)="testAmount.set($any($event.target).value)" [placeholder]="testPlaceholder()" />
                    <button type="button" class="btn" [attr.aria-busy]="simulating()" [disabled]="!!testError() || !testAmount()" (click)="simulate()">Send test deposit</button>
                  </div>
                  @if (testError(); as e) {
                    <span class="field__error">{{ e }}</span>
                  }
                </div>
              }
            } @else {
              <span class="skeleton" style="height: 12rem"></span>
            }
          </div>
        </section>

        <section class="panel" aria-labelledby="recent-title">
          <div class="panel__header">
            <h2 class="panel__title" id="recent-title">Recent {{ code() }} deposits</h2>
            <a class="link" routerLink="/wallets/deposits">All deposits</a>
          </div>
          @for (d of deposits(); track d.id) {
            <div class="deposit">
              <strong class="figure">{{ fmt(d.amount) }}</strong>
              <cx-status kind="deposit" [status]="d.status" />
              <small>{{ when(d.detectedAt) }}, tx {{ short(d.txHash) }}</small>
              <small>
                @if (d.status === 'Pending') {
                  {{ d.confirmations }}/{{ d.requiredConfirmations }} confirmations
                } @else if (d.rejectionReason) {
                  {{ d.rejectionReason }}
                }
              </small>
            </div>
          } @empty {
            <div class="empty">
              <strong>No {{ code() }} deposits yet</strong>
              <p>Incoming transactions appear here as soon as the network sees them.</p>
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class CryptoDepositPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly market = inject(MarketService);
  private readonly wallet = inject(WalletService);

  readonly asset = input<string>();

  protected readonly assets = CRYPTO_ASSETS;
  protected readonly code = computed(() => assetFromSlug(this.asset()) ?? 'BTC');
  protected readonly name = computed(() => ASSET_META[this.code()].name);
  protected readonly address = signal<DepositAddress | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly allDeposits = signal<CryptoDeposit[]>([]);
  protected readonly deposits = computed(() => this.allDeposits().filter((d) => d.asset === this.code()).slice(0, 8));
  protected readonly networkName = computed(() => {
    const a = this.address();
    return this.market.network(a?.network)?.name ?? (a?.network === 'bitcoin' ? 'Bitcoin' : 'Ethereum');
  });
  protected readonly warning = computed(() => networkWarning(this.code(), this.networkName()));

  protected readonly testAmount = signal('');
  protected readonly simulating = signal(false);
  protected readonly testError = computed(() => errorsMessage(checkAmount(this.testAmount(), ASSET_META[this.code()].precision)));
  protected readonly testPlaceholder = computed(() => ({ BTC: '0.05', ETH: '0.5', USDT: '250', NGN: '' })[this.code()]);

  constructor() {
    effect(() => {
      const slug = this.asset();
      untracked(() => {
        if (!assetFromSlug(slug)) {
          void this.router.navigate(['/wallets', 'btc', 'deposit'], { replaceUrl: true });
          return;
        }

        this.loadAddress();
      });
    });

    this.loadDeposits();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.loadDeposits();
      }
    }, 8_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  loadAddress(): void {
    const code = this.code();
    this.address.set(null);
    this.problem.set(null);
    this.testAmount.set('');
    this.api.depositAddress(code).subscribe({
      next: (address) => {
        if (address.asset === this.code()) {
          this.address.set(address);
        }
      },
      error: (error: unknown) => this.problem.set(toProblem(error)),
    });
  }

  simulate(): void {
    const amount = parseAmount(this.testAmount());
    if (!amount || this.testError()) {
      return;
    }

    this.simulating.set(true);
    this.api.simulateDeposit(this.code(), amount).subscribe({
      next: (deposit) => {
        this.simulating.set(false);
        this.testAmount.set('');
        this.allDeposits.update((list) => [deposit, ...list.filter((d) => d.id !== deposit.id)]);
        this.toast.success('Test deposit sent', 'It will be credited after the required confirmations.');
        setTimeout(() => {
          this.loadDeposits();
          this.wallet.reload();
        }, 4000);
      },
      error: (error: unknown) => {
        this.simulating.set(false);
        this.toast.error(error);
      },
    });
  }

  private loadDeposits(): void {
    const hadPending = this.allDeposits().some((d) => d.status === 'Pending');
    this.api.cryptoDeposits({ page: 1, pageSize: 30 }).subscribe({
      next: (page) => {
        this.allDeposits.set(page.items);
        if (hadPending && !page.items.some((d) => d.status === 'Pending')) {
          this.wallet.reload();
        }
      },
      error: () => undefined,
    });
  }

  protected fmt(value: string): string {
    return formatAsset(value, this.code(), { full: true });
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected short(hash: string): string {
    return shortAddress(hash, 8, 6);
  }
}
