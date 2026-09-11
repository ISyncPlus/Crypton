import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api.service';
import { formatAsset, formatDateTime, formatNgn } from '../../core/format';
import { P2POrder, Page } from '../../core/models';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';

@Component({
  selector: 'cx-p2p-orders',
  imports: [RouterLink, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .sub {
      color: var(--ink-3);
      font-size: var(--text-xs);
    }

    .frame.is-loading {
      opacity: 0.5;
    }
  `,
  template: `
    <div class="segmented" role="group" aria-label="Order state">
      <button type="button" [attr.aria-pressed]="state() === 'open'" (click)="setState('open')">In progress</button>
      <button type="button" [attr.aria-pressed]="state() === 'closed'" (click)="setState('closed')">Finished</button>
    </div>

    <section class="panel" aria-label="P2P orders">
      @if (page(); as p) {
        <div class="table-wrap frame" [class.is-loading]="loading()">
          <table class="table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col" class="end">Crypto</th>
                <th scope="col" class="end">Naira</th>
                <th scope="col">With</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (order of p.items; track order.id) {
                <tr class="is-link" (click)="open(order)">
                  <td>
                    <a class="link" [routerLink]="['/p2p/orders', order.id]" (click)="$event.stopPropagation()">{{ order.myRole === 'buyer' ? 'Buy' : 'Sell' }} {{ order.asset }}</a>
                    <div class="sub mono">#{{ order.orderNumber }}, {{ when(order.createdAt) }}</div>
                  </td>
                  <td class="end figure">{{ crypto(order) }}</td>
                  <td class="end figure">{{ ngn(order.fiatAmount) }}</td>
                  <td>{{ order.counterparty.displayName }}</td>
                  <td><cx-status kind="p2pOrder" [status]="order.status" /></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <div class="empty">
                      <strong>{{ state() === 'open' ? 'No orders in progress' : 'No finished orders yet' }}</strong>
                      <p>Orders you place on the market, and orders on your ads, show up here.</p>
                      <a class="btn btn--sm" routerLink="/p2p">Browse the market</a>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <cx-pager [page]="p.page" [pageSize]="p.pageSize" [totalCount]="p.totalCount" [totalPages]="p.totalPages" (pageChange)="pageNumber.set($event)" />
      } @else {
        <div class="panel__body"><span class="skeleton" style="height: 10rem"></span></div>
      }
    </section>
  `,
})
export class Orders {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly state = signal<'open' | 'closed'>('open');
  protected readonly pageNumber = signal(1);
  protected readonly page = signal<Page<P2POrder> | null>(null);
  protected readonly loading = signal(false);

  constructor() {
    toObservable(computed(() => ({ state: this.state(), page: this.pageNumber() })))
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((q) => this.api.p2pOrders({ state: q.state, page: q.page, pageSize: 20 }).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.loading.set(false);
        if (page) {
          this.page.set(page);
        }
      });
  }

  setState(state: 'open' | 'closed'): void {
    this.state.set(state);
    this.pageNumber.set(1);
  }

  open(order: P2POrder): void {
    void this.router.navigate(['/p2p/orders', order.id]);
  }

  protected crypto(order: P2POrder): string {
    return formatAsset(order.quantity, order.asset, { full: true });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
