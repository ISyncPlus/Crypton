import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { AdminAd } from '../../core/admin-models';
import { formatAsset, formatDateTime, formatNgn } from '../../core/format';
import { P2PAdStatus } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Dialogs } from '../../ui/dialogs';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';
import { adminTableStyles, pagedList } from './admin-shared';

@Component({
  selector: 'cx-admin-p2p-ads',
  imports: [RouterLink, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [adminTableStyles],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">P2P ads</h1>
          <p class="lede">Suspend ads that break the rules. Suspended ads are hidden and can't be edited back to life by the maker.</p>
        </div>
      </header>

      <div class="segmented" role="group" aria-label="Status">
        @for (option of statuses; track option.label) {
          <button type="button" [attr.aria-pressed]="status() === option.value" (click)="setStatus(option.value)">{{ option.label }}</button>
        }
      </div>

      <section class="panel" aria-label="Ads">
        @if (list.data(); as page) {
          <div class="table-wrap frame" [class.is-loading]="list.loading()">
            <table class="table">
              <thead><tr><th scope="col">Maker</th><th scope="col">Ad</th><th scope="col" class="end">Price</th><th scope="col" class="end">Remaining</th><th scope="col">Status</th><th scope="col">Posted</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>
                @for (ad of page.items; track ad.id) {
                  <tr>
                    <td><a class="user-link" [routerLink]="['/admin/users', ad.userId]">{{ ad.userEmail }}</a></td>
                    <td>{{ ad.side === 'Sell' ? 'Selling' : 'Buying' }} {{ ad.asset }}</td>
                    <td class="end"><span class="figure">{{ ad.priceType === 'Fixed' && ad.fixedPrice ? ngn(ad.fixedPrice) : margin(ad.floatingMarginBps) }}</span><div class="sub">{{ ad.priceType }}</div></td>
                    <td class="end"><span class="figure">{{ asset(ad.remainingQuantity, ad) }}</span><div class="sub">of {{ asset(ad.totalQuantity, ad) }}</div></td>
                    <td><cx-status kind="ad" [status]="ad.status" />@if (ad.suspendedByAdmin) {<div class="sub">Suspended</div>}</td>
                    <td class="muted">{{ when(ad.createdAt) }}</td>
                    <td class="end">
                      @if (ad.status !== 'Closed') {
                        @if (ad.suspendedByAdmin) {
                          <button type="button" class="btn btn--sm" [attr.aria-busy]="busyId() === ad.id" [disabled]="!!busyId()" (click)="unsuspend(ad)">Unsuspend</button>
                        } @else {
                          <button type="button" class="btn btn--sm btn--danger" [attr.aria-busy]="busyId() === ad.id" [disabled]="!!busyId()" (click)="suspend(ad)">Suspend</button>
                        }
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="7"><div class="empty"><strong>No ads match</strong></div></td></tr>
                }
              </tbody>
            </table>
          </div>
          <cx-pager [page]="page.page" [pageSize]="page.pageSize" [totalCount]="page.totalCount" [totalPages]="page.totalPages" (pageChange)="list.page.set($event)" />
        } @else {
          <div class="panel__body"><span class="skeleton" style="height: 12rem"></span></div>
        }
      </section>
    </div>
  `,
})
export class AdminP2PAds {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);

  protected readonly statuses: { label: string; value: P2PAdStatus | '' }[] = [
    { label: 'Live', value: 'Active' },
    { label: 'Paused', value: 'Paused' },
    { label: 'Closed', value: 'Closed' },
    { label: 'All', value: '' },
  ];
  protected readonly status = signal<P2PAdStatus | ''>('Active');
  protected readonly busyId = signal<string | null>(null);
  protected readonly list = pagedList((p) => this.api.ads(p), () => ({ status: this.status() }));

  setStatus(status: P2PAdStatus | ''): void {
    this.status.set(status);
    this.list.page.set(1);
  }

  async suspend(ad: AdminAd): Promise<void> {
    const reason = await this.dialogs.prompt({ title: 'Suspend this ad?', body: 'It disappears from the market. The maker is notified with your reason.', label: 'Reason', multiline: true, confirmLabel: 'Suspend ad', tone: 'danger' });
    if (!reason) {
      return;
    }

    this.busyId.set(ad.id);
    this.api.suspendAd(ad.id, reason).subscribe({
      next: () => {
        this.busyId.set(null);
        this.list.replace((a) => a.id === ad.id, { ...ad, suspendedByAdmin: true });
        this.toast.success('Ad suspended');
      },
      error: (e: unknown) => {
        this.busyId.set(null);
        this.toast.error(e);
      },
    });
  }

  unsuspend(ad: AdminAd): void {
    this.busyId.set(ad.id);
    this.api.unsuspendAd(ad.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.list.replace((a) => a.id === ad.id, { ...ad, suspendedByAdmin: false });
        this.toast.success('Ad unsuspended');
      },
      error: (e: unknown) => {
        this.busyId.set(null);
        this.toast.error(e);
      },
    });
  }

  protected asset(value: string, ad: AdminAd): string {
    return formatAsset(value, ad.asset, { full: true });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected margin(bps: number): string {
    return bps === 0 ? 'Market' : `${bps > 0 ? '+' : '−'}${(Math.abs(bps) / 100).toFixed(2)}%`;
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
