import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ClockService } from '../../core/clock.service';
import { add, gt, lt, mul, sub } from '../../core/decimal';
import { ASSET_META, fixed, formatAsset, formatDateTime, formatNgn, shortAddress } from '../../core/format';
import { AmountInput, checkAmount, errorsMessage, parseAmount } from '../../core/forms';
import { newId } from '../../core/ids';
import { MarketService } from '../../core/market.service';
import { CryptoWithdrawal, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { WalletService } from '../../core/wallet.service';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';
import { CRYPTO_ASSETS, assetFromSlug, looksLikeAddress } from './wallet-shared';

@Component({
  selector: 'cx-crypto-withdraw',
  imports: [RouterLink, Icon, Status, AmountInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .form {
      display: grid;
      gap: var(--space-5);
    }

    .address-input {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
    }

    .result {
      display: grid;
      gap: var(--space-4);
      justify-items: start;
    }

    .result .figure-xl {
      font-size: var(--text-3xl);
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .facts li {
      margin-bottom: var(--space-2);
    }

    .facts {
      margin: 0;
      padding-left: 1.1rem;
      color: var(--ink-2);
      font-size: var(--text-sm);
    }
  `,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/wallets"><cx-icon name="arrow-left" [size]="16" />Wallets</a>
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Send {{ name() }}</h1>
          <p class="lede">Withdraw to a wallet outside Crypton. Blockchain transfers can't be reversed, so check the address carefully.</p>
        </div>
        <a class="btn" [routerLink]="['/wallets', code().toLowerCase(), 'deposit']">Deposit {{ code() }} instead</a>
      </header>

      <nav class="tabs" aria-label="Choose asset">
        @for (asset of assets; track asset) {
          <a [routerLink]="['/wallets', asset.toLowerCase(), 'withdraw']" [class.is-active]="asset === code()" [attr.aria-current]="asset === code() ? 'page' : null">{{ asset }}</a>
        }
      </nav>

      <div class="split">
        <section class="panel" aria-label="Withdrawal form">
          @if (result(); as w) {
            <div class="panel__body result" aria-live="polite">
              <cx-status kind="cryptoWithdrawal" [status]="w.status" />
              <span class="figure-xl">{{ fmt(w.amount) }}</span>
              <p class="secondary">
                @if (w.status === 'PendingReview') {
                  Your withdrawal is waiting for a quick review by our team. We'll notify you when it's sent.
                } @else {
                  Your withdrawal is queued and will be sent to the network shortly. We'll notify you when it confirms.
                }
              </p>
              <div class="kv" style="width: 100%">
                <div class="kv__row"><span class="kv__key">To</span><span class="kv__value mono">{{ w.toAddress }}</span></div>
                <div class="kv__row"><span class="kv__key">Network fee</span><span class="kv__value figure">{{ fmt(w.fee) }}</span></div>
                <div class="kv__row"><span class="kv__key">Requested</span><span class="kv__value">{{ when(w.createdAt) }}</span></div>
              </div>
              <div class="row">
                <a class="btn btn--primary" routerLink="/wallets/withdrawals">Track withdrawal</a>
                <button type="button" class="btn" (click)="reset()">Send more</button>
              </div>
            </div>
          } @else {
            <div class="panel__body form">
              @if (lockedUntil(); as until) {
                <div class="notice notice--warn" role="status">
                  <cx-icon name="lock" [size]="18" />
                  <span>Withdrawals are paused until {{ until }} after a recent security change.</span>
                </div>
              }

              @if (problem(); as p) {
                <div class="notice notice--bad" role="alert">
                  <cx-icon name="alert" [size]="18" />
                  <div class="notice__body">
                    <span>{{ p.title }}</span>
                    @if (p.code === 'two_factor_required') {
                      <a class="link" routerLink="/account/security">Turn on two-factor authentication</a>
                    }
                    @if (p.code === 'limit_exceeded' || p.code === 'kyc_required') {
                      <a class="link" routerLink="/account/verification">Raise your limits</a>
                    }
                  </div>
                </div>
              }

              <label class="field">
                <span class="field__label">Recipient {{ code() }} address</span>
                <input
                  class="input address-input"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  [placeholder]="addressPlaceholder()"
                  [value]="address()"
                  (input)="address.set($any($event.target).value.trim())"
                  (blur)="addressTouched.set(true)"
                  [attr.aria-invalid]="!!addressError()"
                />
                @if (addressError(); as e) {
                  <span class="field__error">{{ e }}</span>
                } @else {
                  <span class="field__hint">{{ networkName() }} network only.</span>
                }
              </label>

              <div class="field">
                <label class="field__label" for="withdraw-amount">
                  <span>Amount the recipient gets</span>
                  <button type="button" class="link field__aside" (click)="useMax()" [disabled]="!gt(maxAmount(), '0')">Max {{ fmt(maxAmount()) }}</button>
                </label>
                <div class="input-group" style="--addon-width: 4.5rem">
                  <input id="withdraw-amount" class="input input--amount" cxAmount placeholder="0" [value]="amount()" (input)="amount.set($any($event.target).value)" [attr.aria-invalid]="!!amountError()" />
                  <span class="input-group__addon">{{ code() }}</span>
                </div>
                @if (amountError(); as e) {
                  <span class="field__error">{{ e }}</span>
                } @else {
                  <span class="field__hint">Available {{ fmt(available()) }}</span>
                }
              </div>

              <div class="kv kv--total">
                <div class="kv__row"><span class="kv__key">Network fee</span><span class="kv__value figure">{{ fmt(fee()) }}</span></div>
                <div class="kv__row"><span class="kv__key">Approximate value</span><span class="kv__value figure">{{ ngnValue() }}</span></div>
                <div class="kv__row"><span class="kv__key">Total deducted</span><span class="kv__value figure">{{ fmt(total()) }}</span></div>
              </div>

              <button type="button" class="btn btn--primary btn--lg btn--block" [disabled]="!canSubmit()" [attr.aria-busy]="submitting()" (click)="submit()">
                Review and send
              </button>
            </div>
          }
        </section>

        <aside class="panel" aria-labelledby="facts-title">
          <div class="panel__header">
            <h2 class="panel__title" id="facts-title">Before you send</h2>
          </div>
          <div class="panel__body">
            <ul class="facts">
              <li>Minimum withdrawal is {{ fmt(minWithdrawal()) }}. The network fee of {{ fmt(fee()) }} is added on top.</li>
              @if (code() === 'USDT') {
                <li>USDT is sent as an ERC-20 token on {{ networkName() }}. The receiving wallet must support ERC-20 USDT.</li>
              } @else {
                <li>This sends native {{ code() }} on {{ networkName() }}.</li>
              }
              <li>Some withdrawals are reviewed by our team before they're sent, for example large amounts or new addresses.</li>
              <li>
                @if (twoFactorOn()) {
                  You'll confirm with your authenticator app.
                } @else {
                  Withdrawals may require two-factor authentication. <a class="link" routerLink="/account/security">Set it up</a>
                }
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  `,
})
export class CryptoWithdrawPage implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly market = inject(MarketService);
  private readonly wallet = inject(WalletService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(Dialogs);
  private readonly clock = inject(ClockService);

  readonly asset = input<string>();

  protected readonly assets = CRYPTO_ASSETS;
  protected readonly gt = gt;
  protected readonly code = computed(() => assetFromSlug(this.asset()) ?? 'BTC');
  protected readonly name = computed(() => ASSET_META[this.code()].name);
  protected readonly meta = computed(() => this.market.asset(this.code()));
  protected readonly precision = computed(() => this.meta()?.precision ?? ASSET_META[this.code()].precision);
  protected readonly fee = computed(() => this.meta()?.withdrawalFee ?? '0');
  protected readonly minWithdrawal = computed(() => this.meta()?.minWithdrawal ?? '0');
  protected readonly available = computed(() => this.wallet.balance(this.code()).available);
  protected readonly networkName = computed(() => this.market.network(this.meta()?.network)?.name ?? (this.code() === 'BTC' ? 'Bitcoin' : 'Ethereum'));
  protected readonly twoFactorOn = computed(() => this.auth.user()?.twoFactorEnabled ?? false);

  protected readonly address = signal('');
  protected readonly addressTouched = signal(false);
  protected readonly amount = signal('');
  protected readonly submitting = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly result = signal<CryptoWithdrawal | null>(null);
  private idempotency: { key: string; fingerprint: string } | null = null;

  protected readonly lockedUntil = computed(() => {
    const until = this.auth.user()?.withdrawalsLockedUntil;
    return until && Date.parse(until) > this.clock.serverNow() ? formatDateTime(until) : null;
  });

  protected readonly maxAmount = computed(() => {
    const max = sub(this.available(), this.fee());
    return gt(max, '0') ? fixed(max, this.precision()).replace(/,/g, '') : '0';
  });

  protected readonly addressPlaceholder = computed(() => (this.code() === 'BTC' ? 'bc1q… or tb1q…' : '0x…'));

  protected readonly addressError = computed(() => {
    const value = this.address();
    if (!value) {
      return null;
    }

    return looksLikeAddress(this.code(), value) || !this.addressTouched() ? null : `That doesn't look like a ${this.name()} address.`;
  });

  protected readonly amountError = computed(() => {
    const raw = this.amount();
    const basic = checkAmount(raw, this.precision(), this.minWithdrawal());
    if (basic) {
      return errorsMessage(basic, (key, value) => (key === 'min' ? `The minimum withdrawal is ${this.fmt(String(value))}.` : null) ?? defaultAmountMessage(key, value));
    }

    const amount = parseAmount(raw);
    if (amount && gt(add(amount, this.fee()), this.available())) {
      return `Not enough ${this.code()}. With the fee you need ${this.fmt(add(amount, this.fee()))}.`;
    }

    return null;
  });

  protected readonly total = computed(() => {
    const amount = parseAmount(this.amount());
    return amount ? add(amount, this.fee()) : '0';
  });

  protected readonly ngnValue = computed(() => {
    const amount = parseAmount(this.amount());
    const price = this.market.price(this.code());
    return amount && price ? `≈ ${formatNgn(mul(amount, price.priceNgn))}` : '–';
  });

  protected readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      !this.lockedUntil() &&
      looksLikeAddress(this.code(), this.address()) &&
      !!parseAmount(this.amount()) &&
      !this.amountError() &&
      !lt(this.available(), '0'),
  );

  constructor() {
    effect(() => {
      const slug = this.asset();
      untracked(() => {
        if (!assetFromSlug(slug)) {
          void this.router.navigate(['/wallets', 'btc', 'withdraw'], { replaceUrl: true });
          return;
        }

        this.reset();
      });
    });
  }

  ngOnInit(): void {
    this.wallet.reload();
    this.market.loadAssets();
  }

  useMax(): void {
    this.amount.set(this.maxAmount());
  }

  reset(): void {
    this.result.set(null);
    this.problem.set(null);
    this.address.set('');
    this.addressTouched.set(false);
    this.amount.set('');
    this.idempotency = null;
  }

  async submit(): Promise<void> {
    this.addressTouched.set(true);
    const amount = parseAmount(this.amount());
    const address = this.address();
    if (!this.canSubmit() || !amount) {
      return;
    }

    const confirmed = await this.dialogs.confirm({
      title: `Send ${this.fmt(amount)}?`,
      body: `To ${shortAddress(address, 12, 8)} on ${this.networkName()}. The ${this.fmt(this.fee())} network fee is added, so ${this.fmt(add(amount, this.fee()))} leaves your balance. Crypto sent to a wrong address can't be recovered.`,
      confirmLabel: 'Send now',
    });
    if (!confirmed) {
      return;
    }

    let twoFactorCode: string | undefined;
    if (this.twoFactorOn()) {
      const code = await this.dialogs.twoFactorCode({ title: 'Confirm withdrawal', confirmLabel: 'Confirm and send' });
      if (!code) {
        return;
      }

      twoFactorCode = code;
    }

    const fingerprint = `${this.code()}|${address}|${amount}`;
    if (!this.idempotency || this.idempotency.fingerprint !== fingerprint) {
      this.idempotency = { key: newId(), fingerprint };
    }

    this.submitting.set(true);
    this.problem.set(null);
    this.api.withdrawCrypto({ asset: this.code(), address, amount, twoFactorCode, idempotencyKey: this.idempotency.key }).subscribe({
      next: (withdrawal) => {
        this.submitting.set(false);
        this.result.set(withdrawal);
        this.idempotency = null;
        this.wallet.reload();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const problem = toProblem(error);
        this.problem.set(problem);
        // A definite rejection means the next attempt is a new request.
        if (problem.status >= 400 && problem.status < 500) {
          this.idempotency = null;
        }
      },
    });
  }

  protected fmt(value: string): string {
    return formatAsset(value, this.code(), { full: true });
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}

function defaultAmountMessage(key: string, value: unknown): string | null {
  switch (key) {
    case 'amount':
      return 'Enter an amount like 0.05.';
    case 'positive':
      return 'Enter an amount greater than zero.';
    case 'decimals':
      return `Use at most ${value} decimal places.`;
    default:
      return 'Check the amount.';
  }
}
