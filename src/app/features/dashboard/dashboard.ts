import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ASSET_META, changeLabel, formatAsset, formatDateTime, formatNgn, formatRate } from '../../core/format';
import { journalLabel } from '../../core/labels';
import { MarketService } from '../../core/market.service';
import { AssetCode, LimitUsage, P2POrder, PricePoint, WalletTransaction } from '../../core/models';
import { WalletService } from '../../core/wallet.service';
import { AssetMark } from '../../ui/asset-mark';
import { Sparkline } from '../../ui/charts';
import { Icon } from '../../ui/icon';
import { Meter } from '../../ui/meter';
import { Status } from '../../ui/status';

const CRYPTO: AssetCode[] = ['BTC', 'ETH', 'USDT'];
const ORDER: AssetCode[] = ['NGN', 'BTC', 'ETH', 'USDT'];

@Component({
  selector: 'cx-dashboard',
  imports: [RouterLink, AssetMark, Sparkline, Icon, Meter, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .statement {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-5);
      padding-bottom: var(--space-2);
    }

    .statement__figure {
      display: grid;
      gap: var(--space-2);
    }

    .statement__figure .figure-xl {
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .statement__meta {
      color: var(--ink-2);
      font-size: var(--text-sm);
    }

    .holding {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--space-3) var(--space-4);
      padding: var(--space-3) var(--space-5);
      color: inherit;
      text-decoration: none;
    }

    .holding + .holding {
      border-top: 1px solid var(--rule);
    }

    .holding:hover {
      background: var(--hover);
    }

    .holding.is-empty {
      color: var(--ink-3);
    }

    .holding__name {
      display: grid;
      min-width: 0;
      line-height: 1.3;
    }

    .holding__name small {
      color: var(--ink-3);
      font-size: var(--text-sm);
    }

    .holding__value {
      display: grid;
      justify-items: end;
      line-height: 1.3;
    }

    .holding__value small {
      color: var(--ink-3);
      font-size: var(--text-sm);
      font-variant-numeric: tabular-nums;
    }

    .share {
      grid-column: 2 / 4;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--ink-3);
      font-size: var(--text-xs);
      font-variant-numeric: tabular-nums;
    }

    .share cx-meter {
      flex: 1;
    }

    .rate {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
    }

    .rate + .rate {
      border-top: 1px solid var(--rule);
    }

    .rate__price {
      display: grid;
      justify-items: end;
      line-height: 1.25;
    }

    .rate__price small {
      font-size: var(--text-xs);
      font-variant-numeric: tabular-nums;
    }

    .limit {
      display: grid;
      gap: var(--space-2);
    }

    .limit + .limit {
      margin-top: var(--space-4);
    }

    .limit__row {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      font-size: var(--text-sm);
    }

    .activity {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
    }

    .activity + .activity {
      border-top: 1px solid var(--rule);
    }

    .activity__icon {
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: var(--sunken);
      color: var(--ink-2);
    }

    .activity__icon.is-in {
      background: var(--up-soft);
      color: var(--up);
    }

    .activity__text {
      display: grid;
      min-width: 0;
      line-height: 1.3;
    }

    .activity__text small {
      overflow: hidden;
      color: var(--ink-3);
      font-size: var(--text-sm);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .order {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      color: inherit;
      text-decoration: none;
    }

    .order + .order {
      border-top: 1px solid var(--rule);
    }

    .order:hover {
      background: var(--hover);
    }

    .start {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-5);
      border: 1px dashed var(--rule-strong);
      border-radius: var(--radius);
    }

    .start p {
      max-width: 52ch;
      color: var(--ink-2);
    }
  `,
  template: `
    <div class="page">
      <h1 class="sr-only">Overview</h1>

      <section class="statement" aria-labelledby="balance-label">
        <div class="statement__figure">
          <span class="caption" id="balance-label">Total balance</span>
          @if (wallet.data(); as data) {
            <span class="figure-xl">{{ ngn(data.totalValueNgn) }}</span>
            <span class="statement__meta">
              @if (data.pricesAvailable) {
                Crypto valued at current naira prices.
              } @else {
                Crypto prices are delayed, so this total may be out of date.
              }
            </span>
          } @else {
            <span class="skeleton" style="width: 16rem; height: 3.25rem"></span>
          }
        </div>
        <div class="row">
          <a class="btn btn--primary" routerLink="/trade"><cx-icon name="trade" [size]="16" />Trade</a>
          <a class="btn" [routerLink]="tier() >= 1 ? '/wallets/naira/deposit' : '/account/verification'"><cx-icon name="plus" [size]="16" />Add naira</a>
          <a class="btn" routerLink="/wallets"><cx-icon name="wallet" [size]="16" />Wallets</a>
        </div>
      </section>

      @if (isEmpty()) {
        <div class="start">
          <p>
            <strong>Your wallet is empty.</strong>
            @if (tier() >= 1) {
              Add naira by bank transfer or card, or send crypto to your deposit address.
            } @else {
              Verify your identity to add naira, or send crypto to your deposit address now.
            }
          </p>
          <div class="row">
            @if (tier() >= 1) {
              <a class="btn btn--signal" routerLink="/wallets/naira/deposit">Add naira</a>
            } @else {
              <a class="btn btn--signal" routerLink="/account/verification">Verify identity</a>
            }
            <a class="btn" routerLink="/wallets/btc/deposit">Deposit crypto</a>
          </div>
        </div>
      }

      <div class="split">
        <div class="stack-lg">
          <section class="panel" aria-labelledby="holdings-title">
            <div class="panel__header">
              <h2 class="panel__title" id="holdings-title">Holdings</h2>
              <a class="link" routerLink="/wallets">All wallets</a>
            </div>
            @for (row of holdings(); track row.asset) {
              <a class="holding" [class.is-empty]="row.empty" routerLink="/wallets">
                <cx-asset-mark [asset]="row.asset" [size]="34" />
                <span class="holding__name">
                  <strong>{{ row.name }}</strong>
                  <small>{{ row.locked ? row.amount + ', ' + row.locked + ' on hold' : row.amount }}</small>
                </span>
                <span class="holding__value">
                  <strong class="figure">{{ row.value }}</strong>
                  @if (row.asset !== 'NGN') {
                    <small>{{ row.rate }}</small>
                  }
                </span>
                @if (!row.empty) {
                  <span class="share">
                    <cx-meter [value]="row.share" [max]="100" [label]="row.name + ' share of balance'" />
                    <span>{{ row.share }}%</span>
                  </span>
                }
              </a>
            } @empty {
              <div class="panel__body"><span class="skeleton" style="height: 8rem"></span></div>
            }
          </section>

          <section class="panel" aria-labelledby="activity-title">
            <div class="panel__header">
              <h2 class="panel__title" id="activity-title">Recent activity</h2>
              <a class="link" routerLink="/wallets/activity">See all</a>
            </div>
            @if (activity(); as items) {
              @for (tx of items; track tx.journalEntryId + tx.asset) {
                <div class="activity">
                  <span class="activity__icon" [class.is-in]="isCredit(tx)">
                    <cx-icon [name]="isCredit(tx) ? 'arrow-down' : 'arrow-up'" [size]="16" />
                  </span>
                  <span class="activity__text">
                    <strong>{{ label(tx.type) }}</strong>
                    <small>{{ tx.description ? when(tx.createdAt) + ', ' + tx.description : when(tx.createdAt) }}</small>
                  </span>
                  <strong class="figure" [class.up]="isCredit(tx)">{{ signed(tx) }}</strong>
                </div>
              } @empty {
                <div class="empty">
                  <strong>No activity yet</strong>
                  <p>Deposits, trades and withdrawals will be listed here.</p>
                </div>
              }
            } @else {
              <div class="panel__body"><span class="skeleton" style="height: 6rem"></span></div>
            }
          </section>
        </div>

        <div class="stack-lg">
          <section class="panel" aria-labelledby="rates-title">
            <div class="panel__header">
              <h2 class="panel__title" id="rates-title">Naira rates</h2>
              <span class="caption">24 hours</span>
            </div>
            @for (rate of rates(); track rate.code) {
              <div class="rate">
                <cx-asset-mark [asset]="rate.code" [size]="30" />
                <strong>{{ rate.code }}</strong>
                <cx-sparkline [values]="history()[rate.code] ?? []" [width]="72" [height]="24" />
                <span class="rate__price">
                  <span class="figure">{{ rate.price }}</span>
                  <small [class.up]="rate.direction > 0" [class.down]="rate.direction < 0">{{ rate.change }}</small>
                </span>
              </div>
            }
            <div class="panel__footer">
              <a class="btn btn--sm" routerLink="/trade">Buy or sell</a>
            </div>
          </section>

          @if (openOrders().length) {
            <section class="panel" aria-labelledby="orders-title">
              <div class="panel__header">
                <h2 class="panel__title" id="orders-title">Open P2P orders</h2>
                <a class="link" routerLink="/p2p/orders">All orders</a>
              </div>
              @for (order of openOrders(); track order.id) {
                <a class="order" [routerLink]="['/p2p/orders', order.id]">
                  <span>
                    <strong>{{ order.myRole === 'buyer' ? 'Buying' : 'Selling' }} {{ asset(order.quantity, order.asset) }}</strong>
                    <br />
                    <small class="muted">{{ ngn(order.fiatAmount) }} with {{ order.counterparty.displayName }}</small>
                  </span>
                  <cx-status kind="p2pOrder" [status]="order.status" />
                </a>
              }
            </section>
          }

          <section class="panel" aria-labelledby="limits-title">
            <div class="panel__header">
              <h2 class="panel__title" id="limits-title">Daily limits</h2>
              <a class="link" routerLink="/account/verification">{{ tier() >= 2 ? 'Details' : 'Raise limits' }}</a>
            </div>
            <div class="panel__body">
              @for (limit of limits(); track limit.kind) {
                <div class="limit">
                  <div class="limit__row">
                    <span>{{ limitName(limit) }}</span>
                    <span class="figure secondary">{{ limitText(limit) }}</span>
                  </div>
                  @if (limitMax(limit) > 0) {
                    <cx-meter [value]="limitUsed(limit)" [max]="limitMax(limit)" [label]="limitName(limit) + ' used today'" />
                  }
                </div>
              } @empty {
                <span class="skeleton" style="height: 5rem"></span>
              }
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class Dashboard implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly market = inject(MarketService);
  protected readonly wallet = inject(WalletService);

  protected readonly limits = signal<LimitUsage[]>([]);
  protected readonly activity = signal<WalletTransaction[] | null>(null);
  protected readonly openOrders = signal<P2POrder[]>([]);
  protected readonly history = signal<Partial<Record<AssetCode, number[]>>>({});

  protected readonly tier = computed(() => this.auth.user()?.kycTier ?? 0);

  protected readonly holdings = computed(() => {
    const data = this.wallet.data();
    if (!data) {
      return [];
    }

    const total = Number(data.totalValueNgn);
    return ORDER.map((asset) => {
      const balance = data.balances.find((b) => b.asset === asset) ?? { asset, available: '0', locked: '0', total: '0', valueNgn: '0' };
      const price = this.market.price(asset);
      const value = Number(balance.valueNgn);
      return {
        asset,
        name: ASSET_META[asset].name,
        amount: formatAsset(balance.total, asset),
        locked: Number(balance.locked) > 0 ? formatAsset(balance.locked, asset) : null,
        value: formatNgn(balance.valueNgn),
        rate: price ? `${formatRate(price.priceNgn)} each` : 'Price unavailable',
        share: total > 0 ? Math.round((value / total) * 100) : 0,
        empty: Number(balance.total) === 0,
        sort: value,
      };
    }).sort((a, b) => Number(a.empty) - Number(b.empty) || b.sort - a.sort);
  });

  protected readonly isEmpty = computed(() => {
    const data = this.wallet.data();
    return !!data && data.balances.every((b) => Number(b.total) === 0);
  });

  protected readonly rates = computed(() =>
    CRYPTO.map((code) => {
      const price = this.market.price(code);
      const change = price?.change24hPercent ?? null;
      return { code, price: price ? formatRate(price.priceNgn) : '–', change: changeLabel(change), direction: change === null ? 0 : Math.sign(Number(change)) };
    }),
  );

  ngOnInit(): void {
    this.wallet.reload();
    this.api.me().subscribe({
      next: (me) => {
        this.limits.set(me.limits);
        this.auth.setUser(me.user);
      },
      error: () => undefined,
    });
    this.api.transactions({ page: 1, pageSize: 6 }).subscribe({ next: (page) => this.activity.set(page.items), error: () => this.activity.set([]) });
    this.api.p2pOrders({ state: 'open', page: 1, pageSize: 3 }).subscribe({ next: (page) => this.openOrders.set(page.items), error: () => undefined });
    forkJoin(CRYPTO.map((code) => this.api.priceHistory(code, 24).pipe(catchError(() => of([] as PricePoint[]))))).subscribe((series) => {
      const map: Partial<Record<AssetCode, number[]>> = {};
      CRYPTO.forEach((code, i) => (map[code] = series[i].map((p) => Number(p.priceNgn))));
      this.history.set(map);
    });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected asset(value: string, asset: AssetCode): string {
    return formatAsset(value, asset);
  }

  protected label(type: string): string {
    return journalLabel(type);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected isCredit(tx: WalletTransaction): boolean {
    return !tx.amount.startsWith('-');
  }

  protected signed(tx: WalletTransaction): string {
    const credit = this.isCredit(tx);
    const abs = credit ? tx.amount : tx.amount.slice(1);
    return `${credit ? '+' : '−'}${formatAsset(abs, tx.asset)}`;
  }

  protected limitName(limit: LimitUsage): string {
    return { FiatDeposit: 'Naira deposits', FiatWithdrawal: 'Naira withdrawals', CryptoWithdrawal: 'Crypto withdrawals', Trade: 'Trading' }[limit.kind];
  }

  protected limitMax(limit: LimitUsage): number {
    return Number(limit.dailyLimitNgn);
  }

  protected limitUsed(limit: LimitUsage): number {
    return Number(limit.usedNgn);
  }

  protected limitText(limit: LimitUsage): string {
    if (Number(limit.dailyLimitNgn) === 0) {
      return 'Needs verification';
    }

    return `${formatNgn(limit.usedNgn, 0)} of ${formatNgn(limit.dailyLimitNgn, 0)}`;
  }
}
