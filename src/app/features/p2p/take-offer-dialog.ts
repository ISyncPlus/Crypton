import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { div, gt, lt, mul, truncate } from '../../core/decimal';
import { ASSET_META, formatAsset, formatNgn } from '../../core/format';
import { AmountInput, checkAmount, errorsMessage, parseAmount } from '../../core/forms';
import { BankAccount, MarketAd, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { WalletService } from '../../core/wallet.service';
import { Icon } from '../../ui/icon';
import { TraderBadge, releaseText } from './p2p-shared';

export interface TakeOfferData {
  ad: MarketAd;
}

@Component({
  selector: 'cx-take-offer',
  imports: [RouterLink, Icon, TraderBadge, AmountInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .terms {
      max-height: 7rem;
      overflow: auto;
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--ink-2);
      font-size: var(--text-sm);
      white-space: pre-line;
    }

    .modes {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
  `,
  template: `
    <div class="dialog">
      <div class="dialog__head">
        <h2 class="dialog__title" id="dlg-take-title">{{ buying() ? 'Buy' : 'Sell' }} {{ ad.asset }}</h2>
        <button type="button" class="btn btn--quiet btn--icon btn--sm" (click)="ref.close()" aria-label="Close"><cx-icon name="x" [size]="16" /></button>
      </div>

      <div class="dialog__body">
        <cx-trader-badge [trader]="ad.maker" [link]="false" />

        <div class="kv">
          <div class="kv__row"><span class="kv__key">Price</span><span class="kv__value figure">{{ ngn(ad.price) }} per {{ ad.asset }}</span></div>
          <div class="kv__row"><span class="kv__key">Order limits</span><span class="kv__value figure">{{ ngn(ad.minOrderFiat, 0) }} to {{ ngn(ad.maxOrderFiat, 0) }}</span></div>
          <div class="kv__row"><span class="kv__key">Payment window</span><span class="kv__value">{{ ad.paymentWindowMinutes }} minutes</span></div>
          @if (release(); as r) {
            <div class="kv__row"><span class="kv__key">Seller speed</span><span class="kv__value">{{ r }}</span></div>
          }
        </div>

        @if (ad.priceType === 'Floating') {
          <p class="caption">This ad follows the market, so the final price is set when you place the order.</p>
        }

        <div class="field">
          <div class="modes">
            <label class="field__label" for="take-amount">{{ mode() === 'fiat' ? (buying() ? 'You pay' : 'You receive') : buying() ? 'You get' : 'You sell' }}</label>
            <button type="button" class="link" (click)="toggleMode()">Enter {{ mode() === 'fiat' ? ad.asset : 'naira' }} instead</button>
          </div>
          <div class="input-group" style="--addon-width: 4.5rem">
            <input id="take-amount" class="input input--amount" cxAmount placeholder="0" [value]="amount()" (input)="amount.set($any($event.target).value)" [attr.aria-invalid]="!!amountError()" />
            <span class="input-group__addon">{{ mode() === 'fiat' ? 'NGN' : ad.asset }}</span>
          </div>
          @if (amountError(); as e) {
            <span class="field__error">{{ e }}</span>
          } @else if (estimate(); as est) {
            <span class="field__hint">{{ est }}</span>
          }
        </div>

        @if (!buying()) {
          <div class="field">
            <label class="field__label" for="take-bank">
              <span>Get paid into</span>
              <a class="link field__aside" routerLink="/wallets/bank-accounts" (click)="ref.close()">Add account</a>
            </label>
            <select id="take-bank" class="select" [value]="bankId() ?? ''" (change)="bankId.set($any($event.target).value || null)">
              <option value="">{{ banks().length ? 'Choose your bank account' : 'No bank accounts yet' }}</option>
              @for (bank of banks(); track bank.id) {
                <option [value]="bank.id" [selected]="bank.id === bankId()">{{ bank.bankName }} ••{{ bank.accountNumber.slice(-4) }}, {{ bank.accountName }}</option>
              }
            </select>
            <span class="field__hint">Your {{ ad.asset }} is held in escrow until you confirm the buyer's payment. Available: {{ asset(available()) }}</span>
          </div>
        }

        @if (ad.terms) {
          <div class="stack-sm">
            <span class="caption">Trader's terms</span>
            <div class="terms">{{ ad.terms }}</div>
          </div>
        }

        @if (problem(); as p) {
          <div class="notice notice--bad" role="alert">
            <cx-icon name="alert" [size]="18" />
            <div class="notice__body">
              <span>{{ p.title }}</span>
              @if (p.code === 'kyc_required') {
                <a class="link" routerLink="/account/verification" (click)="ref.close()">Verify your identity</a>
              }
            </div>
          </div>
        }
      </div>

      <div class="dialog__foot">
        <button type="button" class="btn" (click)="ref.close()">Cancel</button>
        <button type="button" class="btn btn--primary" [disabled]="!canSubmit()" [attr.aria-busy]="busy()" (click)="submit()">
          {{ buying() ? 'Buy' : 'Sell' }} {{ ad.asset }}
        </button>
      </div>
    </div>
  `,
})
export class TakeOfferDialog implements OnInit {
  protected readonly ad = inject<TakeOfferData>(DIALOG_DATA).ad;
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly wallet = inject(WalletService);

  /** Sell ads are taken by buyers; buy ads by sellers. */
  protected readonly buying = signal(this.ad.side === 'Sell');
  protected readonly mode = signal<'fiat' | 'crypto'>('fiat');
  protected readonly amount = signal('');
  protected readonly bankId = signal<string | null>(null);
  protected readonly banks = signal<BankAccount[]>([]);
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly release = signal(releaseText(this.ad.maker));

  private readonly precision = ASSET_META[this.ad.asset].precision;
  protected readonly available = computed(() => this.wallet.balance(this.ad.asset).available);

  /** Mirrors the API sizing: quantity = floor(naira / price), naira = round(quantity x price, 2). */
  private readonly sized = computed(() => {
    const value = parseAmount(this.amount());
    if (!value || this.amountError()) {
      return null;
    }

    if (this.mode() === 'crypto') {
      return { quantity: value, fiat: roundHalfUp2(mul(value, this.ad.price)) };
    }

    const quantity = truncate(div(value, this.ad.price), this.precision);
    return { quantity, fiat: roundHalfUp2(mul(quantity, this.ad.price)) };
  });

  protected readonly amountError = computed(() => {
    const raw = this.amount();
    const decimals = this.mode() === 'fiat' ? 2 : this.precision;
    const basic = checkAmount(raw, decimals);
    if (basic) {
      return errorsMessage(basic);
    }

    const value = parseAmount(raw);
    if (!value) {
      return null;
    }

    const fiat = this.mode() === 'fiat' ? value : mul(value, this.ad.price);
    if (lt(fiat, this.ad.minOrderFiat) || gt(fiat, this.ad.maxOrderFiat)) {
      return `Enter between ${formatNgn(this.ad.minOrderFiat, 0)} and ${formatNgn(this.ad.maxOrderFiat, 0)}.`;
    }

    return null;
  });

  protected readonly estimate = computed(() => {
    const sized = this.sized();
    if (!sized) {
      return null;
    }

    const crypto = formatAsset(sized.quantity, this.ad.asset, { full: true });
    const naira = formatNgn(sized.fiat);
    return this.buying() ? `You pay ${naira} and get ${crypto}.` : `You sell ${crypto} and receive ${naira}.`;
  });

  protected readonly canSubmit = computed(() => {
    const sized = this.sized();
    if (!sized || this.busy() || !gt(sized.quantity, '0')) {
      return false;
    }

    return this.buying() || (!!this.bankId() && !gt(sized.quantity, this.available()));
  });

  ngOnInit(): void {
    if (!this.buying()) {
      this.wallet.reload();
      this.api.bankAccounts().subscribe({
        next: (banks) => {
          this.banks.set(banks);
          if (banks.length === 1) {
            this.bankId.set(banks[0].id);
          }
        },
        error: () => undefined,
      });
    }
  }

  toggleMode(): void {
    const sized = this.sized();
    this.mode.set(this.mode() === 'fiat' ? 'crypto' : 'fiat');
    this.amount.set(sized ? (this.mode() === 'fiat' ? sized.fiat : sized.quantity) : '');
  }

  submit(): void {
    const sized = this.sized();
    if (!sized || !this.canSubmit()) {
      return;
    }

    this.busy.set(true);
    this.problem.set(null);
    const body = {
      adId: this.ad.id,
      ...(this.mode() === 'fiat' ? { fiatAmount: parseAmount(this.amount()) ?? undefined } : { quantity: sized.quantity }),
      ...(this.buying() ? {} : { paymentMethodId: this.bankId() ?? undefined }),
    };
    this.api.createOrder(body).subscribe({
      next: (order) => {
        this.busy.set(false);
        this.ref.close();
        void this.router.navigate(['/p2p/orders', order.id]);
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

  protected asset(value: string): string {
    return formatAsset(value, this.ad.asset, { full: true });
  }
}

function roundHalfUp2(value: string): string {
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const padded = (fraction + '000').slice(0, 3);
  let cents = BigInt(whole) * 100n + BigInt(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) {
    cents += 1n;
  }

  const text = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}
