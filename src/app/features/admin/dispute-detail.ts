import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { AdminDispute } from '../../core/admin-models';
import { saveBlob } from '../../core/files';
import { formatAsset, formatDateTime, formatNgn } from '../../core/format';
import { DisputeEvidence, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';

@Component({
  selector: 'cx-admin-dispute-detail',
  imports: [RouterLink, Icon, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .timeline {
      display: grid;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .evidence {
      display: grid;
      gap: var(--space-1);
      padding: var(--space-3) var(--space-5);
    }

    .evidence + .evidence {
      border-top: 1px solid var(--rule);
    }

    .evidence__meta {
      color: var(--ink-3);
      font-size: var(--text-xs);
    }

    .party {
      font-weight: 650;
      text-transform: capitalize;
    }

    .decide {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }
  `,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/admin/p2p/disputes"><cx-icon name="arrow-left" [size]="16" />Disputes</a>

      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      }

      @if (dispute(); as d) {
        <header class="page-head">
          <div class="page-head__text">
            <h1 class="page-title">Order #{{ d.order.orderNumber }}</h1>
            <div class="row">
              <cx-status kind="dispute" [status]="d.status" />
              <span class="caption">Opened by the {{ d.openedByRole }} on {{ when(d.createdAt) }}</span>
            </div>
          </div>
          <span class="figure-xl" style="font-size: var(--text-3xl)">{{ ngn(d.order.fiatAmount) }}</span>
        </header>

        <div class="split">
          <div class="stack-lg">
            <section class="panel" aria-labelledby="claim-title">
              <div class="panel__header"><h2 class="panel__title" id="claim-title">Claim</h2></div>
              <div class="panel__body stack">
                <p>{{ d.reason }}</p>
                @if (d.resolutionNote) {
                  <div class="notice notice--ok"><cx-icon name="check" [size]="18" /><span>Resolution: {{ d.resolutionNote }}</span></div>
                }
              </div>
            </section>

            <section class="panel" aria-labelledby="evidence-title">
              <div class="panel__header"><h2 class="panel__title" id="evidence-title">Evidence</h2><span class="caption">{{ d.evidence.length }} item{{ d.evidence.length === 1 ? '' : 's' }}</span></div>
              <ol class="timeline">
                @for (item of d.evidence; track item.id) {
                  <li class="evidence">
                    <span class="evidence__meta"><span class="party">{{ item.party }}</span>, {{ when(item.createdAt) }}</span>
                    @if (item.text) {
                      <span>{{ item.text }}</span>
                    }
                    @if (item.hasFile) {
                      <button type="button" class="link" style="justify-self: start" (click)="download(d, item)"><cx-icon name="file" [size]="14" /> {{ item.fileName ?? 'Attachment' }}</button>
                    }
                  </li>
                } @empty {
                  <li class="evidence"><span class="caption">No evidence submitted yet.</span></li>
                }
              </ol>
            </section>

            @if (d.status === 'Open') {
              <section class="panel" aria-labelledby="decide-title">
                <div class="panel__header"><h2 class="panel__title" id="decide-title">Decision</h2></div>
                <div class="panel__body stack">
                  <p class="secondary">Check the seller's bank statement for the buyer's payment before deciding. Both parties are notified with your note.</p>
                  <div class="decide">
                    <button type="button" class="btn btn--primary" [attr.aria-busy]="busy() === 'buyer'" [disabled]="!!busy()" (click)="resolve(d, true)">Release {{ asset(d.order.quantity, d) }} to buyer</button>
                    <button type="button" class="btn" [attr.aria-busy]="busy() === 'seller'" [disabled]="!!busy()" (click)="resolve(d, false)">Return to seller</button>
                  </div>
                </div>
              </section>
            }
          </div>

          <aside class="stack-lg">
            <section class="panel" aria-labelledby="order-title">
              <div class="panel__header"><h2 class="panel__title" id="order-title">Order</h2></div>
              <div class="panel__body">
                <div class="kv">
                  <div class="kv__row"><span class="kv__key">Ad side</span><span class="kv__value">{{ d.order.adSide === 'Sell' ? 'Seller posted the ad' : 'Buyer posted the ad' }}</span></div>
                  <div class="kv__row"><span class="kv__key">Crypto</span><span class="kv__value figure">{{ asset(d.order.quantity, d) }}</span></div>
                  <div class="kv__row"><span class="kv__key">Price</span><span class="kv__value figure">{{ ngn(d.order.price) }}</span></div>
                  <div class="kv__row"><span class="kv__key">Naira</span><span class="kv__value figure">{{ ngn(d.order.fiatAmount) }}</span></div>
                  <div class="kv__row"><span class="kv__key">Buyer</span><span class="kv__value"><a class="link" [routerLink]="['/admin/users', d.order.buyerId]">{{ d.order.buyerEmail }}</a></span></div>
                  <div class="kv__row"><span class="kv__key">Seller</span><span class="kv__value"><a class="link" [routerLink]="['/admin/users', d.order.sellerId]">{{ d.order.sellerEmail }}</a></span></div>
                  <div class="kv__row"><span class="kv__key">Placed</span><span class="kv__value">{{ when(d.order.createdAt) }}</span></div>
                  <div class="kv__row"><span class="kv__key">Marked paid</span><span class="kv__value">{{ d.order.paidAt ? when(d.order.paidAt) : 'Not marked' }}</span></div>
                  <div class="kv__row"><span class="kv__key">Buyer's reference</span><span class="kv__value mono">{{ d.buyerPaymentReference ?? '–' }}</span></div>
                </div>
              </div>
            </section>

            <section class="panel" aria-labelledby="pay-title">
              <div class="panel__header"><h2 class="panel__title" id="pay-title">Where the buyer had to pay</h2></div>
              <div class="panel__body">
                @for (p of d.paymentDetails; track p.accountNumber) {
                  <div class="kv">
                    <div class="kv__row"><span class="kv__key">{{ p.bankName }}</span><span class="kv__value figure">{{ p.accountNumber }}</span></div>
                    <div class="kv__row"><span class="kv__key">Account name</span><span class="kv__value">{{ p.accountName }}</span></div>
                  </div>
                }
              </div>
            </section>
          </aside>
        </div>
      } @else if (!problem()) {
        <span class="skeleton" style="height: 18rem"></span>
      }
    </div>
  `,
})
export class AdminDisputeDetail {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);

  readonly id = input.required<string>();
  protected readonly dispute = signal<AdminDispute | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly busy = signal<'buyer' | 'seller' | null>(null);

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.api.dispute(this.id()).subscribe({ next: (d) => this.dispute.set(d), error: (e: unknown) => this.problem.set(toProblem(e)) });
  }

  async resolve(d: AdminDispute, releaseToBuyer: boolean): Promise<void> {
    const note = await this.dialogs.prompt({
      title: releaseToBuyer ? 'Release the crypto to the buyer?' : 'Return the crypto to the seller?',
      body: releaseToBuyer
        ? `${this.asset(d.order.quantity, d)} goes to ${d.order.buyerEmail}. This can't be undone.`
        : `${this.asset(d.order.quantity, d)} goes back to ${d.order.sellerEmail}. This can't be undone.`,
      label: 'Note to both parties',
      multiline: true,
      confirmLabel: releaseToBuyer ? 'Release to buyer' : 'Return to seller',
      tone: 'danger',
    });
    if (!note) {
      return;
    }

    this.busy.set(releaseToBuyer ? 'buyer' : 'seller');
    this.api.resolveDispute(d.id, releaseToBuyer, note).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.dispute.set(updated);
        this.toast.success('Dispute resolved');
      },
      error: (e: unknown) => {
        this.busy.set(null);
        this.toast.error(e);
      },
    });
  }

  download(d: AdminDispute, item: DisputeEvidence): void {
    this.api.disputeEvidenceFile(d.id, item.id).subscribe({ next: (blob) => saveBlob(blob, item.fileName ?? 'evidence'), error: (e: unknown) => this.toast.error(e) });
  }

  protected asset(value: string, d: AdminDispute): string {
    return formatAsset(value, d.order.asset, { full: true });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
