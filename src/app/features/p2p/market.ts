import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { formatAsset, formatNgn, formatRate } from '../../core/format';
import { AmountInput, parseAmount } from '../../core/forms';
import { MarketService } from '../../core/market.service';
import { AssetCode, MarketAd, P2PConfig, Page, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { Pager } from '../../ui/pager';
import { TraderBadge } from './p2p-shared';
import { TakeOfferData, TakeOfferDialog } from './take-offer-dialog';

@Component({
  selector: 'cx-p2p-market',
  imports: [RouterLink, Icon, Pager, TraderBadge, AmountInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    .filters .amount {
      width: 12rem;
    }

    .reference {
      margin-left: auto;
      color: var(--ink-3);
      font-size: var(--text-sm);
    }

    .ad {
      display: grid;
      grid-template-columns: minmax(12rem, 1.3fr) minmax(9rem, 1fr) minmax(10rem, 1fr) minmax(8rem, 1fr) auto;
      align-items: center;
      gap: var(--space-3) var(--space-5);
      padding: var(--space-4) var(--space-5);
    }

    .ad + .ad {
      border-top: 1px solid var(--rule);
    }

    .cell {
      display: grid;
      gap: 0.15rem;
      min-width: 0;
      line-height: 1.3;
    }

    .cell small {
      color: var(--ink-3);
      font-size: var(--text-xs);
    }

    .price {
      font-size: var(--text-lg);
      font-stretch: 112%;
      font-variant-numeric: tabular-nums;
      font-weight: 650;
    }

    .banks {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }

    .frame.is-loading {
      opacity: 0.5;
    }

    @media (max-width: 900px) {
      .ad {
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .ad .cell--wide {
        grid-column: 1 / -1;
      }
    }
  `,
  template: `
    @if (gated()) {
      <div class="notice notice--warn" role="status">
        <cx-icon name="id" [size]="18" />
        <div class="notice__body">
          <strong>Verify your identity to trade P2P</strong>
          <span>You can browse offers now. Placing orders and posting ads needs verification.</span>
          <a class="link" routerLink="/account/verification">Verify now</a>
        </div>
      </div>
    }

    <div class="filters">
      <div class="segmented" role="group" aria-label="What do you want to do">
        <button type="button" [attr.aria-pressed]="side() === 'buy'" (click)="setSide('buy')">I want to buy</button>
        <button type="button" [attr.aria-pressed]="side() === 'sell'" (click)="setSide('sell')">I want to sell</button>
      </div>
      <div class="segmented" role="group" aria-label="Asset">
        @for (code of assets; track code) {
          <button type="button" [attr.aria-pressed]="asset() === code" (click)="setAsset(code)">{{ code }}</button>
        }
      </div>
      <label class="sr-only" for="market-amount">Naira amount</label>
      <input id="market-amount" class="input amount" cxAmount placeholder="Amount in ₦" [value]="amount()" (input)="setAmount($any($event.target).value)" />
      @if (marketRate(); as rate) {
        <span class="reference">Market rate {{ rate }}</span>
      }
    </div>

    <section class="panel" [attr.aria-label]="(side() === 'buy' ? 'Offers to sell ' : 'Offers to buy ') + asset()">
      @if (problem(); as p) {
        <div class="panel__body">
          <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
        </div>
      } @else if (page(); as p) {
        <div class="frame" [class.is-loading]="loading()">
          @for (ad of p.items; track ad.id) {
            <div class="ad">
              <div class="cell cell--wide"><cx-trader-badge [trader]="ad.maker" /></div>
              <div class="cell">
                <span class="price">{{ ngn(ad.price) }}</span>
                <small>{{ ad.priceType === 'Floating' ? margin(ad.floatingMarginBps) : 'Fixed price' }}</small>
              </div>
              <div class="cell">
                <span class="figure">{{ crypto(ad.remainingQuantity, ad.asset) }}</span>
                <small>{{ ngn(ad.minOrderFiat, 0) }} to {{ ngn(ad.maxOrderFiat, 0) }}</small>
              </div>
              <div class="cell">
                <div class="banks">
                  @for (bank of ad.paymentBanks.slice(0, 3); track bank) {
                    <span class="chip">{{ bank }}</span>
                  } @empty {
                    <span class="chip">Bank transfer</span>
                  }
                </div>
                <small>Pay within {{ ad.paymentWindowMinutes }} min</small>
              </div>
              <button type="button" class="btn" [class.btn--primary]="side() === 'buy'" (click)="take(ad)" [disabled]="gated()">
                {{ side() === 'buy' ? 'Buy' : 'Sell' }} {{ ad.asset }}
              </button>
            </div>
          } @empty {
            <div class="empty">
              <strong>No offers right now</strong>
              <p>
                Nobody is {{ side() === 'buy' ? 'selling' : 'buying' }} {{ asset() }}
                {{ parsedAmount() ? 'for that amount' : 'at the moment' }}. Post your own ad and let traders come to you.
              </p>
              <a class="btn btn--sm" routerLink="/p2p/ads/new">Post an ad</a>
            </div>
          }
        </div>
        <cx-pager [page]="p.page" [pageSize]="p.pageSize" [totalCount]="p.totalCount" [totalPages]="p.totalPages" (pageChange)="pageNumber.set($event)" />
      } @else {
        <div class="panel__body"><span class="skeleton" style="height: 14rem"></span></div>
      }
    </section>

    @if (config(); as c) {
      <p class="caption">Makers pay a {{ (c.makerFeeBps / 100).toFixed(2) }}% fee in crypto. Taking an offer is free. Always pay from a bank account in your own name.</p>
    }
  `,
})
export class Market implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly market = inject(MarketService);
  private readonly dialogs = inject(Dialogs);

  protected readonly assets: AssetCode[] = ['USDT', 'BTC', 'ETH'];
  protected readonly side = signal<'buy' | 'sell'>('buy');
  protected readonly asset = signal<AssetCode>('USDT');
  protected readonly amount = signal('');
  protected readonly pageNumber = signal(1);
  protected readonly page = signal<Page<MarketAd> | null>(null);
  protected readonly loading = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly config = signal<P2PConfig | null>(null);

  protected readonly parsedAmount = computed(() => parseAmount(this.amount()));
  protected readonly gated = computed(() => {
    const config = this.config();
    return !!config && (this.auth.user()?.kycTier ?? 0) < config.minKycTier;
  });
  protected readonly marketRate = computed(() => {
    const price = this.market.price(this.asset());
    return price ? `${formatRate(price.priceNgn)}` : null;
  });

  constructor() {
    toObservable(computed(() => ({ side: this.side(), asset: this.asset(), amount: this.parsedAmount(), page: this.pageNumber() })))
      .pipe(
        debounceTime(250),
        tap(() => this.loading.set(true)),
        switchMap((query) =>
          this.api.p2pMarket({ side: query.side, asset: query.asset, amount: query.amount, page: query.page, pageSize: 20 }).pipe(
            catchError((error: unknown) => {
              this.problem.set(toProblem(error));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.loading.set(false);
        if (page) {
          this.problem.set(null);
          this.page.set(page);
        }
      });
  }

  ngOnInit(): void {
    this.api.p2pConfig().subscribe({ next: (c) => this.config.set(c), error: () => undefined });
  }

  setSide(side: 'buy' | 'sell'): void {
    this.side.set(side);
    this.pageNumber.set(1);
  }

  setAmount(value: string): void {
    this.amount.set(value);
    this.pageNumber.set(1);
  }

  setAsset(asset: AssetCode): void {
    this.asset.set(asset);
    this.pageNumber.set(1);
  }

  take(ad: MarketAd): void {
    this.dialogs.open<void, TakeOfferData, TakeOfferDialog>(TakeOfferDialog, { ad }, '32rem');
  }

  protected ngn(value: string, digits = 2): string {
    return formatNgn(value, digits);
  }

  protected crypto(value: string, asset: AssetCode): string {
    return formatAsset(value, asset, { full: true });
  }

  protected margin(bps: number): string {
    if (bps === 0) {
      return 'At market price';
    }

    return `${(Math.abs(bps) / 100).toFixed(2)}% ${bps > 0 ? 'above' : 'below'} market`;
  }
}
