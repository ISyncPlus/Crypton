import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { add, gt, lt, mul } from '../../core/decimal';
import { ASSET_META, formatAsset, formatNgn, formatRate } from '../../core/format';
import { AmountInput, checkAmount, errorsMessage, parseAmount } from '../../core/forms';
import { MarketService } from '../../core/market.service';
import { AssetCode, BankAccount, MyAd, P2PAdSide, P2PAdStatus, P2PConfig, P2PPriceType, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { WalletService } from '../../core/wallet.service';
import { Icon } from '../../ui/icon';

const ASSETS: AssetCode[] = ['USDT', 'BTC', 'ETH'];

@Component({
  selector: 'cx-ad-form',
  imports: [RouterLink, Icon, AmountInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .form {
      display: grid;
      gap: var(--space-5);
    }

    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
    }

    .choice small {
      display: block;
      color: var(--ink-3);
    }

    .summary {
      position: sticky;
      top: calc(var(--topbar-height) + var(--space-5));
    }

    @media (max-width: 640px) {
      .pair {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/p2p/ads"><cx-icon name="arrow-left" [size]="16" />My ads</a>
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">{{ editing() ? 'Edit ad' : 'Post an ad' }}</h1>
          <p class="lede">Set your price and limits. Traders who take your ad follow the payment window you choose.</p>
        </div>
      </header>

      @if (loadProblem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      } @else if (config(); as c) {
        <div class="split">
          <section class="panel" aria-label="Ad details">
            <div class="panel__body form">
              @if (editing(); as ad) {
                <div class="notice">
                  <cx-icon name="info" [size]="18" />
                  <span>{{ ad.side === 'Sell' ? 'Selling' : 'Buying' }} {{ ad.asset }}. Side, asset and quantity can't be changed; close the ad and post a new one instead.</span>
                </div>
              } @else {
                <fieldset class="field" style="border: 0; margin: 0; padding: 0">
                  <legend class="field__label" style="margin-bottom: 0.375rem">I want to</legend>
                  <div class="pair">
                    <label class="choice">
                      <input type="radio" name="side" [checked]="side() === 'Sell'" (change)="side.set('Sell')" />
                      <span><strong>Sell crypto</strong><small>Buyers pay you by bank transfer</small></span>
                    </label>
                    <label class="choice">
                      <input type="radio" name="side" [checked]="side() === 'Buy'" (change)="side.set('Buy')" />
                      <span><strong>Buy crypto</strong><small>You pay sellers by bank transfer</small></span>
                    </label>
                  </div>
                </fieldset>

                <div class="field">
                  <span class="field__label">Asset</span>
                  <div class="segmented segmented--block" role="group" aria-label="Asset">
                    @for (code of assets; track code) {
                      <button type="button" [attr.aria-pressed]="asset() === code" (click)="asset.set(code)">{{ code }}</button>
                    }
                  </div>
                </div>
              }

              <div class="field">
                <span class="field__label">
                  <span>Price</span>
                  @if (marketPrice(); as m) {
                    <span class="field__aside">Market {{ rate(m) }}</span>
                  }
                </span>
                <div class="segmented" role="group" aria-label="Price type">
                  <button type="button" [attr.aria-pressed]="priceType() === 'Floating'" (click)="priceType.set('Floating')">Follow the market</button>
                  <button type="button" [attr.aria-pressed]="priceType() === 'Fixed'" (click)="priceType.set('Fixed')">Fixed price</button>
                </div>
              </div>

              @if (priceType() === 'Fixed') {
                <label class="field">
                  <span class="field__label">Price per {{ currentAsset() }}</span>
                  <div class="input-group" style="--addon-width: 4rem">
                    <input class="input input--amount" cxAmount placeholder="0.00" [value]="fixedPrice()" (input)="fixedPrice.set($any($event.target).value)" [attr.aria-invalid]="!!priceError()" />
                    <span class="input-group__addon">NGN</span>
                  </div>
                  @if (priceError(); as e) {
                    <span class="field__error">{{ e }}</span>
                  } @else {
                    <span class="field__hint">Must be within {{ (c.maxFloatingMarginBps / 100).toFixed(0) }}% of the market price.</span>
                  }
                </label>
              } @else {
                <label class="field">
                  <span class="field__label">Margin over market</span>
                  <div class="input-group" style="--addon-width: 2.75rem">
                    <input class="input" inputmode="decimal" placeholder="0.00" [value]="marginPercent()" (input)="marginPercent.set($any($event.target).value)" [attr.aria-invalid]="!!marginError()" />
                    <span class="input-group__addon">%</span>
                  </div>
                  @if (marginError(); as e) {
                    <span class="field__error">{{ e }}</span>
                  } @else {
                    <span class="field__hint">Use a negative number to price below the market. Between -{{ (c.maxFloatingMarginBps / 100).toFixed(0) }}% and {{ (c.maxFloatingMarginBps / 100).toFixed(0) }}%.</span>
                  }
                </label>
              }

              @if (!editing()) {
                <label class="field">
                  <span class="field__label">
                    <span>Total {{ currentAsset() }} to {{ side() === 'Sell' ? 'sell' : 'buy' }}</span>
                    @if (side() === 'Sell') {
                      <span class="field__aside">Available {{ crypto(available()) }}</span>
                    }
                  </span>
                  <div class="input-group" style="--addon-width: 4.5rem">
                    <input class="input input--amount" cxAmount placeholder="0" [value]="quantity()" (input)="quantity.set($any($event.target).value)" [attr.aria-invalid]="!!quantityError()" />
                    <span class="input-group__addon">{{ currentAsset() }}</span>
                  </div>
                  @if (quantityError(); as e) {
                    <span class="field__error">{{ e }}</span>
                  }
                </label>
              }

              <div class="pair">
                <label class="field">
                  <span class="field__label">Minimum order</span>
                  <div class="input-group" style="--addon-width: 4rem">
                    <input class="input" cxAmount [placeholder]="c.minOrderFiat" [value]="minOrder()" (input)="minOrder.set($any($event.target).value)" [attr.aria-invalid]="!!minError()" />
                    <span class="input-group__addon">NGN</span>
                  </div>
                  @if (minError(); as e) {
                    <span class="field__error">{{ e }}</span>
                  }
                </label>
                <label class="field">
                  <span class="field__label">Maximum order</span>
                  <div class="input-group" style="--addon-width: 4rem">
                    <input class="input" cxAmount placeholder="0.00" [value]="maxOrder()" (input)="maxOrder.set($any($event.target).value)" [attr.aria-invalid]="!!maxError()" />
                    <span class="input-group__addon">NGN</span>
                  </div>
                  @if (maxError(); as e) {
                    <span class="field__error">{{ e }}</span>
                  }
                </label>
              </div>

              <label class="field">
                <span class="field__label">Payment window</span>
                <select class="select" [value]="windowMinutes()" (change)="windowMinutes.set(+$any($event.target).value)">
                  @for (minutes of c.paymentWindowsMinutes; track minutes) {
                    <option [value]="minutes" [selected]="minutes === windowMinutes()">{{ minutes }} minutes</option>
                  }
                </select>
                <span class="field__hint">How long the buyer has to pay before the order expires.</span>
              </label>

              @if (currentSide() === 'Sell') {
                <fieldset class="field" style="border: 0; margin: 0; padding: 0">
                  <legend class="field__label" style="margin-bottom: 0.375rem">
                    <span>Where buyers pay you</span>
                    <a class="link field__aside" routerLink="/wallets/bank-accounts">Manage accounts</a>
                  </legend>
                  <div class="choice-list">
                    @for (bank of banks(); track bank.id) {
                      <label class="choice">
                        <input type="checkbox" [checked]="methodIds().includes(bank.id)" (change)="toggleMethod(bank.id)" />
                        <cx-icon name="bank" [size]="18" />
                        <span><strong>{{ bank.bankName }} ••{{ bank.accountNumber.slice(-4) }}</strong><small>{{ bank.accountName }}</small></span>
                      </label>
                    } @empty {
                      <div class="notice notice--warn">
                        <cx-icon name="bank" [size]="18" />
                        <div class="notice__body">
                          <span>Add a bank account in your name so buyers know where to pay.</span>
                          <a class="link" routerLink="/wallets/bank-accounts">Add bank account</a>
                        </div>
                      </div>
                    }
                  </div>
                  @if (methodsError(); as e) {
                    <span class="field__error">{{ e }}</span>
                  }
                </fieldset>
              }

              <label class="field">
                <span class="field__label"><span>Terms</span><span class="field__aside">{{ terms().length }}/1000</span></span>
                <textarea class="textarea" maxlength="1000" placeholder="For example: pay from an account in your own name, include the order number as the narration." [value]="terms()" (input)="terms.set($any($event.target).value)"></textarea>
              </label>

              @if (editing()) {
                <div class="field">
                  <span class="field__label">Visibility</span>
                  <div class="segmented" role="group" aria-label="Ad status">
                    <button type="button" [attr.aria-pressed]="status() === 'Active'" (click)="status.set('Active')">Live</button>
                    <button type="button" [attr.aria-pressed]="status() === 'Paused'" (click)="status.set('Paused')">Paused</button>
                  </div>
                </div>
              }

              @if (problem(); as p) {
                <div class="notice notice--bad" role="alert">
                  <cx-icon name="alert" [size]="18" />
                  <div class="notice__body">
                    <span>{{ p.title }}</span>
                    @if (p.code === 'kyc_required') {
                      <a class="link" routerLink="/account/verification">Verify your identity</a>
                    }
                  </div>
                </div>
              }
            </div>
          </section>

          <aside class="panel summary" aria-label="Summary">
            <div class="panel__header"><h2 class="panel__title">Summary</h2></div>
            <div class="panel__body stack">
              <div class="kv kv--total">
                <div class="kv__row"><span class="kv__key">Your price</span><span class="kv__value figure">{{ effectivePrice() ? ngn(effectivePrice()!) : '–' }}</span></div>
                @if (!editing()) {
                  <div class="kv__row"><span class="kv__key">Quantity</span><span class="kv__value figure">{{ parsedQuantity() ? crypto(parsedQuantity()!) : '–' }}</span></div>
                  <div class="kv__row"><span class="kv__key">Maker fee ({{ (c.makerFeeBps / 100).toFixed(2) }}%)</span><span class="kv__value figure">{{ parsedQuantity() ? crypto(fee()) : '–' }}</span></div>
                  @if (side() === 'Sell') {
                    <div class="kv__row"><span class="kv__key">Reserved from balance</span><span class="kv__value figure">{{ parsedQuantity() ? crypto(reserve()) : '–' }}</span></div>
                  }
                  <div class="kv__row"><span class="kv__key">Worth about</span><span class="kv__value figure">{{ worth() }}</span></div>
                }
              </div>
              <p class="caption">
                @if (currentSide() === 'Sell') {
                  The fee comes out of your reserve. Unused crypto returns to your balance when the ad closes.
                } @else {
                  The fee is taken from the crypto you receive on each order.
                }
              </p>
              <button type="button" class="btn btn--primary btn--lg btn--block" [disabled]="!valid() || saving()" [attr.aria-busy]="saving()" (click)="save()">
                {{ editing() ? 'Save changes' : 'Post ad' }}
              </button>
            </div>
          </aside>
        </div>
      } @else {
        <span class="skeleton" style="height: 20rem"></span>
      }
    </div>
  `,
})
export class AdForm implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly market = inject(MarketService);
  private readonly wallet = inject(WalletService);
  private readonly auth = inject(AuthService);

  readonly id = input<string>();

  protected readonly assets = ASSETS;
  protected readonly config = signal<P2PConfig | null>(null);
  protected readonly banks = signal<BankAccount[]>([]);
  protected readonly editing = signal<MyAd | null>(null);
  protected readonly loadProblem = signal<Problem | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly saving = signal(false);

  protected readonly side = signal<P2PAdSide>('Sell');
  protected readonly asset = signal<AssetCode>('USDT');
  protected readonly priceType = signal<P2PPriceType>('Floating');
  protected readonly fixedPrice = signal('');
  protected readonly marginPercent = signal('0');
  protected readonly quantity = signal('');
  protected readonly minOrder = signal('');
  protected readonly maxOrder = signal('');
  protected readonly windowMinutes = signal(15);
  protected readonly methodIds = signal<string[]>([]);
  protected readonly terms = signal('');
  protected readonly status = signal<P2PAdStatus>('Active');

  protected readonly currentSide = computed(() => this.editing()?.side ?? this.side());
  protected readonly currentAsset = computed(() => this.editing()?.asset ?? this.asset());
  private readonly precision = computed(() => ASSET_META[this.currentAsset()].precision);
  protected readonly available = computed(() => this.wallet.balance(this.currentAsset()).available);
  protected readonly marketPrice = computed(() => this.market.price(this.currentAsset())?.priceNgn ?? null);

  protected readonly marginBps = computed(() => {
    const text = this.marginPercent().trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
      return null;
    }

    return Math.round(Number(text) * 100);
  });

  protected readonly marginError = computed(() => {
    const config = this.config();
    const bps = this.marginBps();
    if (bps === null) {
      return 'Enter a percentage like 1.5 or -0.75.';
    }

    return config && Math.abs(bps) > config.maxFloatingMarginBps ? `Keep the margin within ${(config.maxFloatingMarginBps / 100).toFixed(0)}%.` : null;
  });

  protected readonly priceError = computed(() => {
    const basic = checkAmount(this.fixedPrice(), 2);
    if (basic) {
      return errorsMessage(basic);
    }

    const price = parseAmount(this.fixedPrice());
    if (!price) {
      return 'Enter your price.';
    }

    const market = this.marketPrice();
    const config = this.config();
    if (market && config) {
      const deviation = Math.abs(Number(price) / Number(market) - 1) * 10_000;
      if (deviation > config.maxFloatingMarginBps) {
        return `That's more than ${(config.maxFloatingMarginBps / 100).toFixed(0)}% away from the market price of ${formatRate(market)}.`;
      }
    }

    return null;
  });

  protected readonly effectivePrice = computed(() => {
    if (this.priceType() === 'Fixed') {
      return this.priceError() ? null : parseAmount(this.fixedPrice());
    }

    const market = this.marketPrice();
    const bps = this.marginBps();
    if (!market || bps === null) {
      return null;
    }

    return (Math.round(Number(market) * (1 + bps / 10_000) * 100) / 100).toFixed(2);
  });

  protected readonly parsedQuantity = computed(() => (this.quantityError() ? null : parseAmount(this.quantity())));

  protected readonly quantityError = computed(() => {
    if (this.editing()) {
      return null;
    }

    const raw = this.quantity();
    const basic = checkAmount(raw, this.precision());
    if (basic) {
      return errorsMessage(basic);
    }

    const quantity = parseAmount(raw);
    if (!quantity) {
      return null;
    }

    if (this.side() === 'Sell' && gt(this.reserveFor(quantity), this.available())) {
      return `You need ${this.crypto(this.reserveFor(quantity))} including the fee, but have ${this.crypto(this.available())}.`;
    }

    return null;
  });

  protected readonly fee = computed(() => {
    const quantity = this.parsedQuantity();
    const config = this.config();
    return quantity && config ? this.ceilFee(quantity, config.makerFeeBps) : '0';
  });

  protected readonly reserve = computed(() => {
    const quantity = this.parsedQuantity();
    return quantity ? this.reserveFor(quantity) : '0';
  });

  protected readonly worth = computed(() => {
    const quantity = this.parsedQuantity();
    const price = this.effectivePrice();
    return quantity && price ? `≈ ${formatNgn(mul(quantity, price))}` : '–';
  });

  protected readonly minError = computed(() => {
    const config = this.config();
    const basic = checkAmount(this.minOrder(), 2, config?.minOrderFiat);
    if (basic) {
      return errorsMessage(basic, (key, value) => (key === 'min' ? `At least ${formatNgn(String(value), 0)}.` : 'Enter a naira amount.'));
    }

    return parseAmount(this.minOrder()) ? null : 'Enter a minimum.';
  });

  protected readonly maxError = computed(() => {
    const basic = checkAmount(this.maxOrder(), 2);
    if (basic) {
      return errorsMessage(basic);
    }

    const max = parseAmount(this.maxOrder());
    const min = parseAmount(this.minOrder());
    if (!max) {
      return 'Enter a maximum.';
    }

    return min && lt(max, min) ? 'Must be at least the minimum.' : null;
  });

  protected readonly methodsError = computed(() => {
    if (this.currentSide() !== 'Sell') {
      return null;
    }

    const count = this.methodIds().length;
    return count === 0 ? 'Choose at least one account.' : count > 5 ? 'Choose up to 5 accounts.' : null;
  });

  protected readonly valid = computed(() => {
    const priceOk = this.priceType() === 'Fixed' ? !this.priceError() : !this.marginError();
    const quantityOk = !!this.editing() || !!this.parsedQuantity();
    return priceOk && quantityOk && !this.minError() && !this.maxError() && !this.methodsError() && this.terms().length <= 1000;
  });

  ngOnInit(): void {
    this.wallet.reload();
    const id = this.id();
    forkJoin({ config: this.api.p2pConfig(), banks: this.api.bankAccounts(), ads: this.api.myAds() }).subscribe({
      next: ({ config, banks, ads }) => {
        this.banks.set(banks);
        this.windowMinutes.set(config.paymentWindowsMinutes[0] ?? 15);
        this.minOrder.set(config.minOrderFiat.replace(/\.0+$/, ''));
        if (id) {
          const ad = ads.find((a) => a.id === id);
          if (!ad || ad.status === 'Closed') {
            this.loadProblem.set({ status: 404, code: 'not_found', title: 'This ad was not found or is already closed.' });
            return;
          }

          this.fill(ad);
        } else if (banks.length === 1) {
          this.methodIds.set([banks[0].id]);
        }

        this.config.set(config);
        if ((this.auth.user()?.kycTier ?? 0) < config.minKycTier) {
          this.problem.set({ status: 403, code: 'kyc_required', title: 'Verify your identity before posting P2P ads.' });
        }
      },
      error: (error: unknown) => this.loadProblem.set(toProblem(error)),
    });
  }

  toggleMethod(id: string): void {
    this.methodIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  save(): void {
    if (!this.valid() || this.saving()) {
      return;
    }

    const common = {
      priceType: this.priceType(),
      fixedPrice: this.priceType() === 'Fixed' ? parseAmount(this.fixedPrice()) : null,
      floatingMarginBps: this.priceType() === 'Floating' ? (this.marginBps() ?? 0) : 0,
      minOrderFiat: parseAmount(this.minOrder()),
      maxOrderFiat: parseAmount(this.maxOrder()),
      paymentWindowMinutes: this.windowMinutes(),
      paymentMethodIds: this.currentSide() === 'Sell' ? this.methodIds() : [],
      terms: this.terms().trim() || null,
    };

    this.saving.set(true);
    this.problem.set(null);
    const editing = this.editing();
    const request = editing
      ? this.api.updateAd(editing.id, { ...common, status: this.status() })
      : this.api.createAd({ ...common, side: this.side(), asset: this.asset(), totalQuantity: this.parsedQuantity() });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.wallet.reload();
        this.toast.success(editing ? 'Ad updated' : 'Ad posted', editing ? undefined : 'It is now live on the market.');
        void this.router.navigate(['/p2p/ads']);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.problem.set(toProblem(error));
      },
    });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected rate(value: string): string {
    return formatRate(value);
  }

  protected crypto(value: string): string {
    return formatAsset(value, this.currentAsset(), { full: true });
  }

  private fill(ad: MyAd): void {
    this.editing.set(ad);
    this.priceType.set(ad.priceType);
    this.fixedPrice.set(ad.fixedPrice ?? '');
    this.marginPercent.set((ad.floatingMarginBps / 100).toFixed(2));
    this.minOrder.set(ad.minOrderFiat);
    this.maxOrder.set(ad.maxOrderFiat);
    this.windowMinutes.set(ad.paymentWindowMinutes);
    this.methodIds.set(ad.paymentMethodIds);
    this.terms.set(ad.terms ?? '');
    this.status.set(ad.status === 'Paused' ? 'Paused' : 'Active');
  }

  /** Mirrors the API: quantity + ceil(quantity x bps / 10000) at the asset's precision. */
  private reserveFor(quantity: string): string {
    const config = this.config();
    return config ? add(quantity, this.ceilFee(quantity, config.makerFeeBps)) : quantity;
  }

  private ceilFee(quantity: string, bps: number): string {
    const precision = this.precision();
    const scale = 10n ** BigInt(precision);
    const [whole, fraction = ''] = quantity.split('.');
    const units = BigInt(whole || '0') * scale + BigInt((fraction + '0'.repeat(precision)).slice(0, precision) || '0');
    const feeUnits = (units * BigInt(bps) + 9999n) / 10000n;
    const text = feeUnits.toString().padStart(precision + 1, '0');
    return `${text.slice(0, -precision)}.${text.slice(-precision)}`;
  }
}
