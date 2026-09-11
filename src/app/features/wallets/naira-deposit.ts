import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { gt, lt, sub } from '../../core/decimal';
import { formatDateTime, formatNgn } from '../../core/format';
import { AmountInput, checkAmount, errorsMessage, parseAmount } from '../../core/forms';
import { FiatConfig, FiatDeposit, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { AssetMark } from '../../ui/asset-mark';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';

@Component({
  selector: 'cx-naira-deposit',
  imports: [RouterLink, AssetMark, Icon, Status, AmountInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .form {
      display: grid;
      gap: var(--space-5);
    }

    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .presets button {
      min-height: 2rem;
      padding: 0 var(--space-3);
      border: 1px solid var(--rule-strong);
      border-radius: var(--radius-pill);
      background: var(--surface);
      font-size: var(--text-sm);
      font-variant-numeric: tabular-nums;
      font-weight: 550;
      cursor: pointer;
    }

    .presets button:hover {
      border-color: var(--ink-3);
    }

    .presets button[aria-pressed='true'] {
      border-color: var(--primary);
      background: var(--primary);
      color: var(--primary-ink);
    }

    .row-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-1) var(--space-3);
      padding: var(--space-3) var(--space-5);
      font-size: var(--text-sm);
    }

    .row-item + .row-item {
      border-top: 1px solid var(--rule);
    }

    .row-item small {
      color: var(--ink-3);
    }

    .test-mode {
      display: flex;
      gap: var(--space-2);
      align-items: center;
    }
  `,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/wallets"><cx-icon name="arrow-left" [size]="16" />Wallets</a>
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Add naira</h1>
          <p class="lede">Pay by card or bank transfer through our payment partner. The money lands in your naira wallet as soon as the payment is confirmed.</p>
        </div>
      </header>

      @if (tier() < 1) {
        <div class="notice notice--warn" role="status">
          <cx-icon name="id" [size]="18" />
          <div class="notice__body">
            <strong>Verify your identity first</strong>
            <span>Naira deposits unlock after identity verification. It takes about two minutes.</span>
            <a class="link" routerLink="/account/verification">Verify now</a>
          </div>
        </div>
      }

      <div class="split">
        <section class="panel" aria-label="Deposit form">
          <div class="panel__body form">
            @if (config(); as c) {
              @if (c.simulated) {
                <div class="notice test-mode">
                  <cx-icon name="info" [size]="18" />
                  <span>Test mode: payments go through a simulated checkout and no real money moves.</span>
                </div>
              }

              <div class="field">
                <label class="field__label" for="deposit-amount">Amount to pay</label>
                <div class="input-group" style="--addon-width: 4rem">
                  <input id="deposit-amount" class="input input--amount" cxAmount placeholder="0.00" [value]="amount()" (input)="amount.set($any($event.target).value)" [attr.aria-invalid]="!!amountError()" [disabled]="tier() < 1" />
                  <span class="input-group__addon">NGN</span>
                </div>
                @if (amountError(); as e) {
                  <span class="field__error">{{ e }}</span>
                } @else {
                  <span class="field__hint">Between {{ ngn(c.minDepositNgn, 0) }} and {{ ngn(c.maxDepositNgn, 0) }} per payment.</span>
                }
              </div>

              <div class="presets" role="group" aria-label="Quick amounts">
                @for (preset of presets; track preset) {
                  <button type="button" [attr.aria-pressed]="amount() === preset" (click)="amount.set(preset)" [disabled]="tier() < 1">{{ ngn(preset, 0) }}</button>
                }
              </div>

              <div class="kv kv--total">
                <div class="kv__row"><span class="kv__key">You pay</span><span class="kv__value figure">{{ parsed() ? ngn(parsed()!) : '–' }}</span></div>
                <div class="kv__row">
                  <span class="kv__key">Deposit fee</span>
                  <span class="kv__value figure">{{ c.depositFeeBps === 0 ? 'Free' : parsed() ? ngn(fee()) : feeRule() }}</span>
                </div>
                <div class="kv__row"><span class="kv__key">Added to your wallet</span><span class="kv__value figure">{{ parsed() ? ngn(credit()) : '–' }}</span></div>
              </div>

              @if (problem(); as p) {
                <div class="notice notice--bad" role="alert">
                  <cx-icon name="alert" [size]="18" />
                  <div class="notice__body">
                    <span>{{ p.title }}</span>
                    @if (p.code === 'limit_exceeded' || p.code === 'kyc_required') {
                      <a class="link" routerLink="/account/verification">Raise your limits</a>
                    }
                  </div>
                </div>
              }

              <button type="button" class="btn btn--primary btn--lg btn--block" [disabled]="!canPay()" [attr.aria-busy]="busy()" (click)="pay()">
                {{ parsed() && !amountError() ? 'Pay ' + ngn(parsed()!) : 'Continue to payment' }}
              </button>
              <p class="caption">You'll leave Crypton to complete the payment, then come straight back here.</p>
            } @else if (configProblem(); as p) {
              <div class="notice notice--bad" role="alert">
                <cx-icon name="alert" [size]="18" />
                <span>{{ p.title }}</span>
              </div>
            } @else {
              <span class="skeleton" style="height: 14rem"></span>
            }
          </div>
        </section>

        <section class="panel" aria-labelledby="recent-title">
          <div class="panel__header">
            <h2 class="panel__title" id="recent-title">Recent naira deposits</h2>
            <a class="link" routerLink="/wallets/deposits">All deposits</a>
          </div>
          @for (d of recent(); track d.id) {
            <div class="row-item">
              <strong class="figure">{{ ngn(d.amount) }}</strong>
              <cx-status kind="fiatDeposit" [status]="d.status" />
              <small>{{ when(d.createdAt) }}</small>
              @if (d.status === 'Initiated' && d.authorizationUrl) {
                <a class="link" [href]="d.authorizationUrl"><small>Continue payment</small></a>
              }
            </div>
          } @empty {
            <div class="empty">
              <cx-asset-mark asset="NGN" [size]="36" />
              <strong>No naira deposits yet</strong>
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class NairaDeposit implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  protected readonly presets = ['5000', '20000', '50000', '100000'];
  protected readonly tier = computed(() => this.auth.user()?.kycTier ?? 0);
  protected readonly config = signal<FiatConfig | null>(null);
  protected readonly configProblem = signal<Problem | null>(null);
  protected readonly recent = signal<FiatDeposit[]>([]);
  protected readonly amount = signal('');
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  protected readonly parsed = computed(() => (this.amountError() ? null : parseAmount(this.amount())));

  protected readonly amountError = computed(() => {
    const c = this.config();
    return c ? errorsMessage(checkAmount(this.amount(), 2, c.minDepositNgn, c.maxDepositNgn), (key, value) => message(key, value)) : null;
  });

  /** Mirrors the API: fee = min(ceil(amount x bps / 10000, 2 dp), cap). */
  protected readonly fee = computed(() => {
    const c = this.config();
    const amount = this.parsed();
    if (!c || !amount || c.depositFeeBps === 0) {
      return '0';
    }

    const kobo = BigInt(Math.round(Number(amount) * 100));
    const feeKobo = (kobo * BigInt(c.depositFeeBps) + 9999n) / 10000n;
    const fee = (Number(feeKobo) / 100).toFixed(2);
    return lt(fee, c.depositFeeCapNgn) ? fee : c.depositFeeCapNgn;
  });

  protected readonly credit = computed(() => {
    const amount = this.parsed();
    return amount ? sub(amount, this.fee()) : '0';
  });

  protected readonly feeRule = computed(() => {
    const c = this.config();
    return c ? `${(c.depositFeeBps / 100).toFixed(2)}%, max ${formatNgn(c.depositFeeCapNgn, 0)}` : '';
  });

  protected readonly canPay = computed(() => this.tier() >= 1 && !!this.parsed() && !this.busy() && gt(this.credit(), '0'));

  ngOnInit(): void {
    this.api.fiatConfig().subscribe({ next: (c) => this.config.set(c), error: (e: unknown) => this.configProblem.set(toProblem(e)) });
    this.api.fiatDeposits({ page: 1, pageSize: 6 }).subscribe({ next: (p) => this.recent.set(p.items), error: () => undefined });
  }

  pay(): void {
    const amount = this.parsed();
    if (!amount || !this.canPay()) {
      return;
    }

    this.busy.set(true);
    this.problem.set(null);
    this.api.depositFiat(amount).subscribe({
      next: (deposit) => {
        if (deposit.authorizationUrl) {
          window.location.assign(deposit.authorizationUrl);
        } else {
          this.busy.set(false);
          this.problem.set({ status: 0, code: 'provider_error', title: 'The payment page could not be opened. Please try again.' });
        }
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.problem.set(toProblem(error));
      },
    });
  }

  protected ngn(value: string, digits = 2): string {
    return formatNgn(value, digits);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}

function message(key: string, value: unknown): string {
  switch (key) {
    case 'min':
      return `The minimum deposit is ${formatNgn(String(value), 0)}.`;
    case 'max':
      return `The maximum per payment is ${formatNgn(String(value), 0)}.`;
    case 'decimals':
      return 'Use at most 2 decimal places (kobo).';
    default:
      return 'Enter an amount like 20000.';
  }
}
