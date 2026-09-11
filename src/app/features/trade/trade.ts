import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, debounceTime, map, of, switchMap } from 'rxjs';
import { Api } from '../../core/api.service';
import { ClockService } from '../../core/clock.service';
import { gt } from '../../core/decimal';
import { ASSET_META, changeLabel, formatAsset, formatDateTime, formatNgn, formatRate, fixed } from '../../core/format';
import { AmountInput, checkAmount, errorsMessage, parseAmount } from '../../core/forms';
import { newId } from '../../core/ids';
import { MarketService } from '../../core/market.service';
import { AssetCode, AmountSide, PricePoint, Problem, Quote, TradeKind, TradeOrder } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { WalletService } from '../../core/wallet.service';
import { AssetMark } from '../../ui/asset-mark';
import { LineChart, SeriesPoint } from '../../ui/charts';
import { Countdown, remainingMs } from '../../ui/countdown';
import { Icon } from '../../ui/icon';

const CRYPTO: AssetCode[] = ['BTC', 'ETH', 'USDT'];
const MAX_AUTO_REFRESH = 5;

interface QuoteParams {
  kind: TradeKind;
  fromAsset: AssetCode;
  toAsset: AssetCode;
  amount: string;
  side: AmountSide;
}

@Component({
  selector: 'cx-trade',
  imports: [RouterLink, AssetMark, LineChart, Countdown, Icon, AmountInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .ticket {
      display: grid;
      gap: var(--space-5);
    }

    .leg {
      display: grid;
      gap: var(--space-2);
    }

    .leg__head {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      font-size: var(--text-sm);
    }

    .leg__box {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
      border: 1px solid var(--rule-strong);
      border-radius: var(--radius-sm);
      background: var(--surface);
      transition:
        border-color var(--dur-fast) var(--ease),
        box-shadow var(--dur-fast) var(--ease);
    }

    .leg__box:focus-within {
      border-color: var(--info);
      box-shadow: var(--focus-ring);
    }

    .leg__box.is-invalid {
      border-color: var(--down);
    }

    .leg__box.is-readonly {
      background: var(--surface-2);
    }

    .amount {
      width: 100%;
      min-width: 0;
      padding: var(--space-2) 0;
      border: 0;
      background: transparent;
      font-size: var(--text-2xl);
      font-stretch: 112%;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      outline: none;
    }

    .amount::placeholder {
      color: var(--ink-3);
      opacity: 0.6;
    }

    .amount-out {
      padding: var(--space-2) 0;
      overflow: hidden;
      font-size: var(--text-2xl);
      font-stretch: 112%;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .amount-out.is-pending {
      color: var(--ink-3);
    }

    .picker {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .picker select {
      min-height: 2.5rem;
      padding-left: var(--space-2);
      border-color: transparent;
      background-color: var(--sunken);
      font-weight: 600;
    }

    .fixed-asset {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 0 var(--space-3);
      font-weight: 600;
    }

    .flip {
      justify-self: center;
      margin: calc(var(--space-3) * -1) 0;
    }

    .quote {
      display: grid;
      gap: var(--space-3);
      padding: var(--space-4);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }

    .lock {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      font-size: var(--text-sm);
    }

    .lock__bar {
      height: 3px;
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--series-1) 18%, var(--surface));
      overflow: hidden;
    }

    .lock__fill {
      height: 100%;
      background: var(--series-1);
      transition: width 1s linear;
    }

    .receipt {
      display: grid;
      gap: var(--space-5);
    }

    .receipt__head {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .receipt__icon {
      display: grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: var(--up-soft);
      color: var(--up);
    }

    .receipt .figure-xl {
      font-size: var(--text-3xl);
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .chart-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2) var(--space-4);
    }

    .chart-head .price {
      font-size: var(--text-2xl);
      font-stretch: 115%;
      font-weight: 650;
    }

    .recent {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-1) var(--space-3);
      padding: var(--space-3) var(--space-5);
      font-size: var(--text-sm);
    }

    .recent + .recent {
      border-top: 1px solid var(--rule);
    }

    .recent small {
      color: var(--ink-3);
    }
  `,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Trade</h1>
          <p class="lede">Instant prices from Crypton. Once quoted, your rate is held for a few seconds so you know exactly what you get.</p>
        </div>
      </header>

      <div class="split">
        <section class="panel" aria-label="Trade ticket">
          @if (receipt(); as order) {
            <div class="panel__body receipt" aria-live="polite">
              <div class="receipt__head">
                <span class="receipt__icon"><cx-icon name="check" [size]="20" /></span>
                <h2 class="section-title">{{ receiptTitle(order) }}</h2>
              </div>
              <span class="figure-xl">+{{ fmt(order.toAmount, order.toAsset) }}</span>
              <div class="kv kv--total">
                <div class="kv__row"><span class="kv__key">Rate</span><span class="kv__value figure">{{ rateText(order) }}</span></div>
                <div class="kv__row"><span class="kv__key">Fee</span><span class="kv__value figure">{{ fmt(order.fee, order.feeAsset) }}</span></div>
                <div class="kv__row"><span class="kv__key">Time</span><span class="kv__value">{{ when(order.createdAt) }}</span></div>
                <div class="kv__row"><span class="kv__key">You paid</span><span class="kv__value figure">{{ fmt(order.fromAmount, order.fromAsset) }}</span></div>
              </div>
              <div class="row">
                <button type="button" class="btn btn--primary" (click)="newTrade()">New trade</button>
                <a class="btn" routerLink="/wallets">View wallets</a>
              </div>
            </div>
          } @else {
            <div class="panel__header">
              <div class="segmented" role="group" aria-label="Trade type">
                @for (option of kinds; track option) {
                  <button type="button" [attr.aria-pressed]="kind() === option" (click)="setKind(option)">{{ option }}</button>
                }
              </div>
              <span class="caption">Available {{ fmt(available(), fromAsset(), true) }}</span>
            </div>

            <div class="panel__body ticket">
              <!-- pay leg -->
              <div class="leg">
                <div class="leg__head">
                  <label class="field__label" [attr.for]="side() === 'From' ? 'amount' : null">You pay</label>
                  @if (side() === 'From') {
                    <button type="button" class="link" (click)="useMax()" [disabled]="!hasBalance()">Use max</button>
                  }
                </div>
                <div class="leg__box" [class.is-invalid]="side() === 'From' && !!inputError()" [class.is-readonly]="side() === 'To'">
                  @if (side() === 'From') {
                    <input
                      id="amount"
                      class="amount"
                      cxAmount
                      placeholder="0"
                      [value]="amountText()"
                      (input)="onAmount($event)"
                      [attr.aria-invalid]="!!inputError()"
                      aria-describedby="amount-help"
                    />
                  } @else {
                    <div class="amount-out" [class.is-pending]="!quote()" aria-live="polite">{{ quote() ? plain(quote()!.fromAmount, fromAsset()) : '0' }}</div>
                  }
                  @if (kind() === 'Buy') {
                    <span class="fixed-asset"><cx-asset-mark asset="NGN" [size]="24" />NGN</span>
                  } @else {
                    <span class="picker">
                      <cx-asset-mark [asset]="fromAsset()" [size]="24" />
                      <select class="select" aria-label="Asset to pay with" [value]="fromAsset()" (change)="setFrom($any($event.target).value)">
                        @for (code of crypto; track code) {
                          <option [value]="code" [selected]="code === fromAsset()">{{ code }}</option>
                        }
                      </select>
                    </span>
                  }
                </div>
              </div>

              <button type="button" class="btn btn--icon flip" (click)="flip()" [attr.aria-label]="flipLabel()" [title]="flipLabel()">
                <cx-icon name="arrow-down" [size]="16" />
              </button>

              <!-- receive leg -->
              <div class="leg">
                <div class="leg__head">
                  <label class="field__label" [attr.for]="side() === 'To' ? 'amount' : null">You get</label>
                  @if (kind() === 'Buy') {
                    <button type="button" class="link" (click)="toggleSide()">{{ side() === 'From' ? 'Enter ' + toAsset() + ' amount instead' : 'Enter naira amount instead' }}</button>
                  }
                </div>
                <div class="leg__box" [class.is-invalid]="side() === 'To' && !!inputError()" [class.is-readonly]="side() === 'From'">
                  @if (side() === 'To') {
                    <input
                      id="amount"
                      class="amount"
                      cxAmount
                      placeholder="0"
                      [value]="amountText()"
                      (input)="onAmount($event)"
                      [attr.aria-invalid]="!!inputError()"
                      aria-describedby="amount-help"
                    />
                  } @else {
                    <div class="amount-out" [class.is-pending]="!quote()" aria-live="polite">{{ quote() ? plain(quote()!.toAmount, toAsset()) : '0' }}</div>
                  }
                  @if (kind() === 'Sell') {
                    <span class="fixed-asset"><cx-asset-mark asset="NGN" [size]="24" />NGN</span>
                  } @else {
                    <span class="picker">
                      <cx-asset-mark [asset]="toAsset()" [size]="24" />
                      <select class="select" aria-label="Asset to receive" [value]="toAsset()" (change)="setTo($any($event.target).value)">
                        @for (code of toChoices(); track code) {
                          <option [value]="code" [selected]="code === toAsset()">{{ code }}</option>
                        }
                      </select>
                    </span>
                  }
                </div>
              </div>

              <div id="amount-help" aria-live="polite">
                @if (inputError(); as e) {
                  <p class="field__error">{{ e }}</p>
                } @else if (quoteError(); as p) {
                  <div class="notice notice--bad">
                    <cx-icon name="alert" [size]="18" />
                    <div class="notice__body">
                      <span>{{ p.title }}</span>
                      @if (p.code === 'limit_exceeded' || p.code === 'kyc_required') {
                        <a class="link" routerLink="/account/verification">Raise your limits</a>
                      }
                    </div>
                  </div>
                } @else if (shortfall()) {
                  <div class="notice notice--warn">
                    <cx-icon name="wallet" [size]="18" />
                    <div class="notice__body">
                      <span>You need {{ fmt(quote()!.fromAmount, fromAsset()) }} but have {{ fmt(available(), fromAsset()) }} available.</span>
                      <a class="link" [routerLink]="fromAsset() === 'NGN' ? '/wallets/naira/deposit' : '/wallets/' + fromAsset().toLowerCase() + '/deposit'">Add {{ fromAsset() }}</a>
                    </div>
                  </div>
                }
              </div>

              @if (quote(); as q) {
                <div class="quote">
                  <div class="kv">
                    <div class="kv__row"><span class="kv__key">Rate</span><span class="kv__value figure">{{ rateText(q) }}</span></div>
                    <div class="kv__row"><span class="kv__key">Fee</span><span class="kv__value figure">{{ fmt(q.fee, q.feeAsset) }}</span></div>
                    @if (q.kind === 'Swap') {
                      <div class="kv__row"><span class="kv__key">Naira value</span><span class="kv__value figure">{{ ngn(q.ngnValue) }}</span></div>
                    }
                  </div>
                  <div class="stack-sm">
                    <div class="lock">
                      @if (expired()) {
                        <span class="secondary">This price has expired.</span>
                        <button type="button" class="link" (click)="refresh(true)">Get a new price</button>
                      } @else {
                        <span class="secondary">Price held for <cx-countdown [deadline]="q.expiresAt" (expired)="onExpired()" /></span>
                        @if (quoting()) {
                          <span class="caption">Updating…</span>
                        }
                      }
                    </div>
                    <div class="lock__bar" aria-hidden="true"><div class="lock__fill" [style.width.%]="lockPercent()"></div></div>
                  </div>
                </div>
              } @else if (quoting()) {
                <div class="quote" aria-live="polite"><span class="caption">Getting a price…</span><span class="skeleton" style="height: 2.5rem"></span></div>
              }

              <button type="button" class="btn btn--primary btn--lg btn--block" [disabled]="!canExecute()" [attr.aria-busy]="executing()" (click)="execute()">
                {{ actionLabel() }}
              </button>
            </div>
          }
        </section>

        <div class="stack-lg">
          <section class="panel" aria-labelledby="chart-title">
            <div class="panel__header">
              <h2 class="panel__title" id="chart-title">{{ chartAsset() }} in naira</h2>
              <div class="segmented" role="group" aria-label="Chart range">
                <button type="button" [attr.aria-pressed]="hours() === 24" (click)="hours.set(24)">24h</button>
                <button type="button" [attr.aria-pressed]="hours() === 168" (click)="hours.set(168)">7d</button>
              </div>
            </div>
            <div class="panel__body stack">
              <div class="chart-head">
                <span class="price">{{ chartPrice() }}</span>
                <span class="caption" [class.up]="chartDirection() > 0" [class.down]="chartDirection() < 0">{{ chartChange() }} in 24h</span>
              </div>
              <cx-line-chart [points]="series()" [height]="200" [format]="rateFormat" [axisFormat]="axisFormat" [spanHours]="hours()" [label]="chartAsset() + ' price in naira'" [loading]="chartLoading()" />
            </div>
          </section>

          <section class="panel" aria-labelledby="recent-title">
            <div class="panel__header">
              <h2 class="panel__title" id="recent-title">Your recent trades</h2>
            </div>
            @for (order of recent(); track order.id) {
              <div class="recent">
                <strong>{{ order.kind }} {{ order.kind === 'Sell' ? order.fromAsset : order.toAsset }}</strong>
                <span class="figure">+{{ fmt(order.toAmount, order.toAsset) }}</span>
                <small>{{ when(order.createdAt) }}</small>
                <small class="figure">−{{ fmt(order.fromAmount, order.fromAsset) }}</small>
              </div>
            } @empty {
              <div class="empty">
                <strong>No trades yet</strong>
                <p>Your buys, sells and swaps will be listed here.</p>
              </div>
            }
          </section>
        </div>
      </div>
    </div>
  `,
})
export class Trade implements OnInit {
  private readonly api = inject(Api);
  private readonly market = inject(MarketService);
  private readonly wallet = inject(WalletService);
  private readonly toast = inject(ToastService);
  private readonly clock = inject(ClockService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly kinds: TradeKind[] = ['Buy', 'Sell', 'Swap'];
  protected readonly crypto = CRYPTO;

  protected readonly kind = signal<TradeKind>('Buy');
  protected readonly cryptoAsset = signal<AssetCode>('BTC');
  protected readonly swapFrom = signal<AssetCode>('BTC');
  protected readonly swapTo = signal<AssetCode>('USDT');
  protected readonly side = signal<AmountSide>('From');
  protected readonly amountText = signal('');

  protected readonly quote = signal<Quote | null>(null);
  protected readonly quoteError = signal<Problem | null>(null);
  protected readonly quoting = signal(false);
  protected readonly expired = signal(false);
  protected readonly executing = signal(false);
  protected readonly receipt = signal<TradeOrder | null>(null);
  protected readonly recent = signal<TradeOrder[]>([]);

  protected readonly hours = signal(24);
  protected readonly history = signal<PricePoint[]>([]);
  protected readonly chartLoading = signal(false);

  private readonly refreshTick = signal(0);
  private autoRefreshes = 0;
  private readonly orderIds = new Map<string, string>();

  protected readonly fromAsset = computed<AssetCode>(() => (this.kind() === 'Buy' ? 'NGN' : this.kind() === 'Sell' ? this.cryptoAsset() : this.swapFrom()));
  protected readonly toAsset = computed<AssetCode>(() => (this.kind() === 'Buy' ? this.cryptoAsset() : this.kind() === 'Sell' ? 'NGN' : this.swapTo()));
  protected readonly toChoices = computed(() => (this.kind() === 'Swap' ? CRYPTO.filter((code) => code !== this.swapFrom()) : CRYPTO));
  protected readonly inputAsset = computed(() => (this.side() === 'From' ? this.fromAsset() : this.toAsset()));
  protected readonly available = computed(() => this.wallet.balance(this.fromAsset()).available);
  protected readonly hasBalance = computed(() => gt(this.available(), '0'));
  protected readonly chartAsset = computed<AssetCode>(() => (this.kind() === 'Swap' ? this.swapFrom() : this.cryptoAsset()));

  protected readonly inputError = computed(() => {
    const precision = this.market.asset(this.inputAsset())?.precision ?? ASSET_META[this.inputAsset()].precision;
    return errorsMessage(checkAmount(this.amountText(), precision));
  });

  private readonly params = computed<QuoteParams | null>(() => {
    const amount = parseAmount(this.amountText());
    if (this.receipt() || !amount || this.inputError() || !gt(amount, '0')) {
      return null;
    }

    return { kind: this.kind(), fromAsset: this.fromAsset(), toAsset: this.toAsset(), amount, side: this.side() };
  });

  private readonly paramsKey = computed(() => JSON.stringify(this.params()));

  protected readonly shortfall = computed(() => {
    const quote = this.quote();
    return !!quote && gt(quote.fromAmount, this.available());
  });

  protected readonly canExecute = computed(() => !!this.quote() && !this.expired() && !this.quoting() && !this.shortfall() && !this.executing() && !this.quoteError());

  protected readonly lockPercent = computed(() => {
    const quote = this.quote();
    if (!quote) {
      return 0;
    }

    const ttl = Math.max(1, Date.parse(quote.expiresAt) - this.quoteReceivedAt);
    return Math.min(100, Math.round((remainingMs(quote.expiresAt, this.clock.serverNow()) / ttl) * 100));
  });

  protected readonly actionLabel = computed(() => {
    const quote = this.quote();
    const kind = this.kind();
    if (!quote) {
      return kind === 'Swap' ? `Swap ${this.fromAsset()} to ${this.toAsset()}` : `${kind} ${kind === 'Buy' ? this.toAsset() : this.fromAsset()}`;
    }

    if (kind === 'Buy') {
      return `Buy ${this.fmt(quote.toAmount, quote.toAsset)} for ${this.fmt(quote.fromAmount, quote.fromAsset)}`;
    }

    if (kind === 'Sell') {
      return `Sell ${this.fmt(quote.fromAmount, quote.fromAsset)} for ${this.fmt(quote.toAmount, quote.toAsset)}`;
    }

    return `Swap to ${this.fmt(quote.toAmount, quote.toAsset)}`;
  });

  protected readonly flipLabel = computed(() => (this.kind() === 'Buy' ? 'Switch to selling' : this.kind() === 'Sell' ? 'Switch to buying' : 'Swap direction'));

  protected readonly series = computed<SeriesPoint[]>(() => this.history().map((p) => ({ t: Date.parse(p.at), v: Number(p.priceNgn) })));
  protected readonly chartPrice = computed(() => {
    const price = this.market.price(this.chartAsset());
    return price ? formatRate(price.priceNgn) : '–';
  });
  protected readonly chartChange = computed(() => changeLabel(this.market.price(this.chartAsset())?.change24hPercent ?? null));
  protected readonly chartDirection = computed(() => Math.sign(Number(this.market.price(this.chartAsset())?.change24hPercent ?? 0)));

  protected readonly rateFormat = (value: number) => `₦${value.toLocaleString('en-NG', { maximumFractionDigits: value >= 1000 ? 0 : 2 })}`;
  protected readonly axisFormat = (value: number) =>
    value >= 1e6 ? `₦${(value / 1e6).toLocaleString('en-NG', { maximumFractionDigits: 2 })}M` : `₦${value.toLocaleString('en-NG', { maximumFractionDigits: value >= 1000 ? 0 : 2 })}`;

  private quoteReceivedAt = 0;

  constructor() {
    // Any change to the ticket invalidates the current price straight away.
    effect(() => {
      this.paramsKey();
      untracked(() => {
        this.quote.set(null);
        this.quoteError.set(null);
        this.expired.set(false);
        this.autoRefreshes = 0;
        this.quoting.set(this.params() !== null);
      });
    });

    combineLatest([toObservable(this.paramsKey), toObservable(this.refreshTick)])
      .pipe(
        debounceTime(450),
        switchMap(([key]) => {
          const params = JSON.parse(key) as QuoteParams | null;
          if (!params) {
            return of({ quote: null as Quote | null, error: null as Problem | null });
          }

          this.quoting.set(true);
          return this.api.quote(params).pipe(
            map((quote) => ({ quote: quote as Quote | null, error: null as Problem | null })),
            catchError((error: unknown) => of({ quote: null as Quote | null, error: toProblem(error) as Problem | null })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ quote, error }) => {
        this.quoteReceivedAt = this.clock.serverTime();
        this.quote.set(quote);
        this.quoteError.set(error);
        this.expired.set(false);
        this.quoting.set(false);
      });

    toObservable(computed(() => ({ asset: this.chartAsset(), hours: this.hours() })))
      .pipe(
        switchMap(({ asset, hours }) => {
          this.chartLoading.set(true);
          return this.api.priceHistory(asset, hours).pipe(catchError(() => of([] as PricePoint[])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((points) => {
        this.history.set(points);
        this.chartLoading.set(false);
      });
  }

  ngOnInit(): void {
    this.wallet.reload();
    this.loadRecent();
  }

  setKind(kind: TradeKind): void {
    this.kind.set(kind);
    if (kind !== 'Buy') {
      this.side.set('From');
    }

    this.amountText.set('');
  }

  setFrom(code: AssetCode): void {
    if (this.kind() === 'Swap') {
      this.swapFrom.set(code);
      if (this.swapTo() === code) {
        this.swapTo.set(CRYPTO.find((c) => c !== code) ?? 'USDT');
      }
    } else {
      this.cryptoAsset.set(code);
    }
  }

  setTo(code: AssetCode): void {
    if (this.kind() === 'Swap') {
      this.swapTo.set(code);
    } else {
      this.cryptoAsset.set(code);
    }
  }

  flip(): void {
    const kind = this.kind();
    if (kind === 'Swap') {
      const from = this.swapFrom();
      this.swapFrom.set(this.swapTo());
      this.swapTo.set(from);
    } else {
      this.kind.set(kind === 'Buy' ? 'Sell' : 'Buy');
      this.side.set('From');
    }

    this.amountText.set('');
  }

  toggleSide(): void {
    this.side.set(this.side() === 'From' ? 'To' : 'From');
    this.amountText.set('');
  }

  onAmount(event: Event): void {
    this.amountText.set((event.target as HTMLInputElement).value);
  }

  useMax(): void {
    const precision = this.market.asset(this.fromAsset())?.precision ?? ASSET_META[this.fromAsset()].precision;
    this.side.set('From');
    this.amountText.set(fixed(this.available(), precision, true).replace(/,/g, ''));
  }

  onExpired(): void {
    if (this.executing() || this.receipt()) {
      return;
    }

    if (document.visibilityState === 'visible' && this.autoRefreshes < MAX_AUTO_REFRESH) {
      this.autoRefreshes++;
      this.refresh(false);
    } else {
      this.expired.set(true);
    }
  }

  refresh(manual: boolean): void {
    if (manual) {
      this.autoRefreshes = 0;
    }

    this.expired.set(false);
    this.quoting.set(true);
    this.refreshTick.update((n) => n + 1);
  }

  execute(): void {
    const quote = this.quote();
    if (!quote || !this.canExecute()) {
      return;
    }

    if (remainingMs(quote.expiresAt, this.clock.serverTime()) <= 0) {
      this.refresh(true);
      return;
    }

    let clientOrderId = this.orderIds.get(quote.id);
    if (!clientOrderId) {
      clientOrderId = newId();
      this.orderIds.set(quote.id, clientOrderId);
    }

    this.executing.set(true);
    this.api.executeQuote(quote.id, clientOrderId).subscribe({
      next: (order) => {
        this.executing.set(false);
        this.receipt.set(order);
        this.wallet.reload();
        this.loadRecent();
      },
      error: (error: unknown) => {
        this.executing.set(false);
        const problem = toProblem(error);
        if (problem.code === 'quote_expired') {
          this.toast.info('That price expired, so here is a fresh one.');
          this.refresh(true);
          return;
        }

        this.toast.error(problem.title);
        if (problem.code === 'insufficient_funds') {
          this.wallet.reload();
        }
      },
    });
  }

  newTrade(): void {
    this.receipt.set(null);
    this.amountText.set('');
  }

  protected fmt(value: string, asset: AssetCode, trim = false): string {
    return formatAsset(value, asset, { full: asset !== 'NGN', trim: trim || asset !== 'NGN' });
  }

  protected plain(value: string, asset: AssetCode): string {
    return formatAsset(value, asset, { full: true, code: false }).replace('₦', '');
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected rateText(q: Quote | TradeOrder): string {
    if (q.kind === 'Swap') {
      return `1 ${q.fromAsset} = ${Number(q.rate).toLocaleString('en-NG', { maximumFractionDigits: 8 })} ${q.toAsset}`;
    }

    const crypto = q.kind === 'Buy' ? q.toAsset : q.fromAsset;
    return `1 ${crypto} = ${formatNgn(q.rate)}`;
  }

  protected receiptTitle(order: TradeOrder): string {
    return order.kind === 'Buy' ? `You bought ${order.toAsset}` : order.kind === 'Sell' ? `You sold ${order.fromAsset}` : `You swapped ${order.fromAsset} to ${order.toAsset}`;
  }

  private loadRecent(): void {
    this.api.tradeOrders({ page: 1, pageSize: 6 }).subscribe({ next: (page) => this.recent.set(page.items), error: () => undefined });
  }
}
