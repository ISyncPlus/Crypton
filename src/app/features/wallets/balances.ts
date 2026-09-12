import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ASSET_META, formatAsset, formatNgn, formatRate } from '../../core/format';
import { MarketService } from '../../core/market.service';
import { AssetCode } from '../../core/models';
import { WalletService } from '../../core/wallet.service';
import { AssetMark } from '../../ui/asset-mark';

const ORDER: AssetCode[] = ['NGN', 'BTC', 'ETH', 'USDT'];

@Component({
  selector: 'cx-balances',
  imports: [RouterLink, AssetMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .asset {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .asset > span {
      display: grid;
      line-height: 1.3;
    }

    .asset small {
      color: var(--ink-3);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }

    .total {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-top: 1px solid var(--rule);
    }

    .total strong {
      font-size: var(--text-xl);
      font-stretch: 115%;
    }

    @media (max-width: 720px) {
      .hide-sm {
        display: none;
      }
    }
  `,
  template: `
    <section class="panel" aria-label="Balances">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">Asset</th>
              <th scope="col" class="end">Available</th>
              <th scope="col" class="end hide-sm">On hold</th>
              <th scope="col" class="end">Value</th>
              <th scope="col" class="end"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.asset) {
              <tr>
                <td>
                  <div class="asset">
                    <cx-asset-mark [asset]="row.asset" [size]="32" />
                    <span>
                      <strong>{{ row.name }}</strong>
                      <small>{{ row.rate }}</small>
                    </span>
                  </div>
                </td>
                <td class="end figure">{{ row.available }}</td>
                <td class="end figure hide-sm muted">{{ row.locked }}</td>
                <td class="end figure">{{ row.value }}</td>
                <td class="end">
                  <div class="actions">
                    @if (row.asset === 'NGN') {
                      <a class="btn btn--sm" [routerLink]="tier() >= 1 ? '/wallets/naira/deposit' : '/account/verification'">Add</a>
                      <a class="btn btn--sm" [routerLink]="tier() >= 1 ? '/wallets/naira/withdraw' : '/account/verification'">Withdraw</a>
                    } @else {
                      <a class="btn btn--sm" [routerLink]="['/wallets', row.slug, 'deposit']">Deposit</a>
                      <a class="btn btn--sm" [routerLink]="['/wallets', row.slug, 'withdraw']">Send</a>
                      <a class="btn btn--sm btn--quiet hide-sm" routerLink="/trade">Trade</a>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5"><span class="skeleton" style="height: 8rem"></span></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (wallet.data(); as data) {
        <div class="total">
          <span class="caption">Total value in naira</span>
          <strong class="figure">{{ ngn(data.totalValueNgn) }}</strong>
        </div>
      }
    </section>

    <p class="caption">"On hold" covers pending withdrawals and crypto reserved for your open P2P ads and orders.</p>
  `,
})
export class Balances implements OnInit {
  protected readonly wallet = inject(WalletService);
  private readonly market = inject(MarketService);
  private readonly auth = inject(AuthService);
  protected readonly tier = computed(() => this.auth.user()?.kycTier ?? 0);

  protected readonly rows = computed(() => {
    if (!this.wallet.data()) {
      return [];
    }

    return ORDER.map((asset) => {
      const balance = this.wallet.balance(asset);
      const price = this.market.price(asset);
      return {
        asset,
        slug: asset.toLowerCase(),
        name: ASSET_META[asset].name,
        rate: asset === 'NGN' ? 'Nigerian naira' : price ? `${formatRate(price.priceNgn)} per ${asset}` : 'Price unavailable',
        available: formatAsset(balance.available, asset, { full: true }),
        locked: formatAsset(balance.locked, asset, { full: true }),
        value: formatNgn(balance.valueNgn),
      };
    });
  });

  ngOnInit(): void {
    this.wallet.reload();
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }
}
