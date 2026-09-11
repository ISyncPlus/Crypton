import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api.service';
import { formatAsset, formatDateTime } from '../../core/format';
import { journalLabel } from '../../core/labels';
import { AssetCode, Page, WalletTransaction } from '../../core/models';
import { AssetMark } from '../../ui/asset-mark';
import { Pager } from '../../ui/pager';

@Component({
  selector: 'cx-activity',
  imports: [AssetMark, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    .type {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .type span {
      display: grid;
      line-height: 1.3;
    }

    .type small {
      max-width: 36ch;
      overflow: hidden;
      color: var(--ink-3);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .frame.is-loading {
      opacity: 0.5;
    }
  `,
  template: `
    <div class="filters">
      <div class="segmented" role="group" aria-label="Filter by asset">
        @for (option of filters; track option.label) {
          <button type="button" [attr.aria-pressed]="asset() === option.value" (click)="setAsset(option.value)">{{ option.label }}</button>
        }
      </div>
    </div>

    <section class="panel" aria-label="Ledger activity">
      @if (page(); as p) {
        <div class="table-wrap frame" [class.is-loading]="loading()">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col">When</th>
                <th scope="col" class="end">Amount</th>
              </tr>
            </thead>
            <tbody>
              @for (tx of p.items; track tx.journalEntryId + tx.asset) {
                <tr>
                  <td>
                    <div class="type">
                      <cx-asset-mark [asset]="tx.asset" [size]="28" />
                      <span>
                        <strong>{{ label(tx.type) }}</strong>
                        @if (tx.description) {
                          <small [title]="tx.description">{{ tx.description }}</small>
                        }
                      </span>
                    </div>
                  </td>
                  <td class="muted">{{ when(tx.createdAt) }}</td>
                  <td class="end figure" [class.up]="!tx.amount.startsWith('-')">{{ signed(tx) }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3">
                    <div class="empty">
                      <strong>Nothing here yet</strong>
                      <p>Every credit and debit to your balances is recorded here, including fees.</p>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <cx-pager [page]="p.page" [pageSize]="p.pageSize" [totalCount]="p.totalCount" [totalPages]="p.totalPages" (pageChange)="pageNumber.set($event)" />
      } @else {
        <div class="panel__body"><span class="skeleton" style="height: 12rem"></span></div>
      }
    </section>
  `,
})
export class Activity {
  private readonly api = inject(Api);
  protected readonly filters: { label: string; value: AssetCode | null }[] = [
    { label: 'All', value: null },
    { label: 'NGN', value: 'NGN' },
    { label: 'BTC', value: 'BTC' },
    { label: 'ETH', value: 'ETH' },
    { label: 'USDT', value: 'USDT' },
  ];

  protected readonly asset = signal<AssetCode | null>(null);
  protected readonly pageNumber = signal(1);
  protected readonly page = signal<Page<WalletTransaction> | null>(null);
  protected readonly loading = signal(false);

  constructor() {
    toObservable(computed(() => ({ asset: this.asset(), page: this.pageNumber() })))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(({ asset, page }) => this.api.transactions({ asset, page, pageSize: 25 }).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.loading.set(false);
        if (page) {
          this.page.set(page);
        }
      });
  }

  setAsset(asset: AssetCode | null): void {
    this.asset.set(asset);
    this.pageNumber.set(1);
  }

  protected label(type: string): string {
    return journalLabel(type);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected signed(tx: WalletTransaction): string {
    const negative = tx.amount.startsWith('-');
    return `${negative ? '−' : '+'}${formatAsset(negative ? tx.amount.slice(1) : tx.amount, tx.asset, { full: true })}`;
  }
}
