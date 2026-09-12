import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { formatAsset, formatDate, formatNgn } from '../../core/format';
import { MyAd } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { WalletService } from '../../core/wallet.service';
import { AssetMark } from '../../ui/asset-mark';
import { Dialogs } from '../../ui/dialogs';
import { Status } from '../../ui/status';

@Component({
  selector: 'cx-my-ads',
  imports: [RouterLink, AssetMark, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .ad-name {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .ad-name > span {
      display: grid;
      line-height: 1.3;
    }

    .sub {
      color: var(--ink-3);
      font-size: var(--text-xs);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
  `,
  template: `
    <section class="panel" aria-label="My ads">
      @if (ads(); as list) {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Ad</th>
                <th scope="col" class="end">Price</th>
                <th scope="col" class="end">Remaining</th>
                <th scope="col" class="end">Limits</th>
                <th scope="col">Status</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (ad of list; track ad.id) {
                <tr>
                  <td>
                    <div class="ad-name">
                      <cx-asset-mark [asset]="ad.asset" [size]="28" />
                      <span>
                        <strong>{{ ad.side === 'Sell' ? 'Selling' : 'Buying' }} {{ ad.asset }}</strong>
                        <small class="sub">Posted {{ date(ad.createdAt) }}, {{ ad.paymentWindowMinutes }} min window</small>
                      </span>
                    </div>
                  </td>
                  <td class="end">
                    <span class="figure">{{ ngn(ad.effectivePrice) }}</span>
                    <div class="sub">{{ ad.priceType === 'Floating' ? margin(ad.floatingMarginBps) : 'Fixed' }}</div>
                  </td>
                  <td class="end">
                    <span class="figure">{{ crypto(ad.remainingQuantity, ad) }}</span>
                    <div class="sub">of {{ crypto(ad.totalQuantity, ad) }}</div>
                  </td>
                  <td class="end figure">{{ ngn(ad.minOrderFiat, 0) }} to {{ ngn(ad.maxOrderFiat, 0) }}</td>
                  <td>
                    <cx-status kind="ad" [status]="ad.status" />
                    @if (ad.suspendedByAdmin) {
                      <div class="sub">Suspended by compliance</div>
                    }
                  </td>
                  <td>
                    @if (ad.status !== 'Closed') {
                      <div class="actions">
                        <a class="btn btn--sm" [routerLink]="['/p2p/ads', ad.id]">Edit</a>
                        <button type="button" class="btn btn--sm btn--danger" [attr.aria-busy]="busyId() === ad.id" (click)="close(ad)">Close</button>
                      </div>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <div class="empty">
                      <strong>You haven't posted any ads</strong>
                      <p>Set your own price and let other traders come to you. Crypto for sell ads is reserved from your balance while the ad is open.</p>
                      <a class="btn btn--sm btn--primary" routerLink="/p2p/ads/new">Post an ad</a>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="panel__body"><span class="skeleton" style="height: 10rem"></span></div>
      }
    </section>
  `,
})
export class MyAds implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);
  private readonly wallet = inject(WalletService);

  protected readonly ads = signal<MyAd[] | null>(null);
  protected readonly busyId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.myAds().subscribe({ next: (ads) => this.ads.set(ads), error: (e: unknown) => this.toast.error(e) });
  }

  async close(ad: MyAd): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Close this ad?',
      body:
        ad.side === 'Sell'
          ? `It disappears from the market and the unused ${ad.asset} reserve returns to your balance. Orders already in progress continue.`
          : 'It disappears from the market. Orders already in progress continue.',
      confirmLabel: 'Close ad',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }

    this.busyId.set(ad.id);
    this.api.closeAd(ad.id).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.ads.update((list) => list?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
        this.wallet.reload();
        this.toast.success('Ad closed');
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.toast.error(error);
      },
    });
  }

  protected ngn(value: string, digits = 2): string {
    return formatNgn(value, digits);
  }

  protected crypto(value: string, ad: MyAd): string {
    return formatAsset(value, ad.asset, { full: true });
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  protected margin(bps: number): string {
    return bps === 0 ? 'At market' : `${(Math.abs(bps) / 100).toFixed(2)}% ${bps > 0 ? 'above' : 'below'} market`;
  }
}
