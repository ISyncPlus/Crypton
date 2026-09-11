import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ClockService } from '../../core/clock.service';
import { formatAsset, formatDate, formatDateTime, formatNgn, formatTime } from '../../core/format';
import { ACCEPTED_UPLOADS, saveBlob, validateUpload } from '../../core/files';
import { DisputeEvidence, P2POrder, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { WalletService } from '../../core/wallet.service';
import { CopyButton } from '../../ui/copy-button';
import { Countdown } from '../../ui/countdown';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';
import { TraderBadge, releaseText } from './p2p-shared';

const LIVE = ['PendingPayment', 'Paid', 'Disputed'];

@Component({
  selector: 'cx-order-room',
  imports: [NgTemplateOutlet, RouterLink, CopyButton, Countdown, Icon, Status, TraderBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .steps {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--rule);
      border-radius: var(--radius);
      background: var(--surface);
      overflow: hidden;
    }

    .step {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0 var(--space-3);
      align-items: center;
      padding: var(--space-3) var(--space-4);
      color: var(--ink-3);
    }

    .step + .step {
      border-left: 1px solid var(--rule);
    }

    .step__num {
      display: grid;
      grid-row: span 2;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border: 1px solid var(--rule-strong);
      border-radius: 50%;
      font-size: var(--text-sm);
      font-weight: 650;
    }

    .step strong {
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .step small {
      font-size: var(--text-xs);
    }

    .step.is-done {
      color: var(--ink-2);
    }

    .step.is-done .step__num {
      border-color: var(--up);
      background: var(--up);
      color: #fff;
    }

    .step.is-current {
      background: var(--surface-2);
      color: var(--ink);
    }

    .step.is-current .step__num {
      border-color: var(--primary);
      background: var(--primary);
      color: var(--primary-ink);
    }

    .timer {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-sm);
      background: var(--warn-soft);
    }

    .timer cx-countdown {
      font-size: var(--text-xl);
    }

    .pay-to {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-4);
      border: 1px solid var(--rule);
      border-radius: var(--radius-sm);
    }

    .pay-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .pay-line span:first-child {
      color: var(--ink-3);
      font-size: var(--text-sm);
    }

    .pay-line strong {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
    }

    .evidence {
      display: grid;
      gap: var(--space-1);
      padding: var(--space-3) 0;
      font-size: var(--text-sm);
    }

    .evidence + .evidence {
      border-top: 1px solid var(--rule);
    }

    .evidence__meta {
      color: var(--ink-3);
      font-size: var(--text-xs);
    }

    .thumbs {
      display: flex;
      gap: var(--space-2);
    }

    @media (max-width: 720px) {
      .steps {
        grid-template-columns: minmax(0, 1fr);
      }

      .step + .step {
        border-top: 1px solid var(--rule);
        border-left: 0;
      }
    }
  `,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/p2p/orders"><cx-icon name="arrow-left" [size]="16" />My orders</a>

      @if (loadProblem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      } @else if (order(); as o) {
        <header class="page-head">
          <div class="page-head__text">
            <h1 class="page-title">{{ o.myRole === 'buyer' ? 'Buy' : 'Sell' }} {{ crypto(o.quantity) }}</h1>
            <div class="row">
              <cx-status kind="p2pOrder" [status]="o.status" />
              <span class="caption mono">Order #{{ o.orderNumber }}</span>
            </div>
          </div>
          <span class="figure-xl" style="font-size: var(--text-3xl)">{{ ngn(o.fiatAmount) }}</span>
        </header>

        <ol class="steps" aria-label="Order progress">
          @for (step of steps(); track step.label; let i = $index) {
            <li class="step" [class.is-done]="step.state === 'done'" [class.is-current]="step.state === 'current'" [attr.aria-current]="step.state === 'current' ? 'step' : null">
              <span class="step__num">
                @if (step.state === 'done') {
                  <cx-icon name="check" [size]="14" [stroke]="2.5" />
                } @else {
                  {{ i + 1 }}
                }
              </span>
              <strong>{{ step.label }}</strong>
              <small>{{ step.note }}</small>
            </li>
          }
        </ol>

        <div class="split">
          <section class="panel" aria-live="polite">
            <div class="panel__body stack">
              @if (problem(); as p) {
                <div class="notice notice--bad" role="alert">
                  <cx-icon name="alert" [size]="18" />
                  <div class="notice__body">
                    <span>{{ p.title }}</span>
                    @if (p.code === 'two_factor_required') {
                      <a class="link" routerLink="/account/security">Turn on two-factor authentication</a>
                    }
                  </div>
                </div>
              }

              @switch (o.status) {
                @case ('PendingPayment') {
                  <div class="timer">
                    <span>{{ o.myRole === 'buyer' ? 'Pay within' : 'Order expires in' }}</span>
                    <cx-countdown [deadline]="o.paymentDeadline" (expired)="reload()" />
                  </div>

                  @if (o.myRole === 'buyer') {
                    <h2 class="section-title">Send {{ ngn(o.fiatAmount) }} to the seller</h2>
                    @for (detail of o.paymentDetails; track detail.accountNumber) {
                      <div class="pay-to">
                        <div class="pay-line"><span>Bank</span><strong>{{ detail.bankName }}</strong></div>
                        <div class="pay-line"><span>Account number</span><strong class="figure">{{ detail.accountNumber }}<cx-copy [value]="detail.accountNumber" what="account number" /></strong></div>
                        <div class="pay-line"><span>Account name</span><strong>{{ detail.accountName }}</strong></div>
                        <div class="pay-line"><span>Amount</span><strong class="figure">{{ ngn(o.fiatAmount) }}<cx-copy [value]="plainAmount(o.fiatAmount)" what="amount" /></strong></div>
                      </div>
                    }
                    <div class="notice">
                      <cx-icon name="info" [size]="18" />
                      <span>Pay the exact amount, from a bank account in your own name, to the account shown above. Then mark the order as paid before the timer runs out.</span>
                    </div>
                    <label class="field">
                      <span class="field__label">Transfer reference <span class="field__aside">Optional</span></span>
                      <input class="input" maxlength="120" placeholder="Session ID or reference from your bank app" [value]="reference()" (input)="reference.set($any($event.target).value)" />
                    </label>
                    <div class="row">
                      <button type="button" class="btn btn--primary btn--lg" [attr.aria-busy]="busy() === 'paid'" [disabled]="!!busy()" (click)="markPaid(o)">I've sent the payment</button>
                      <button type="button" class="btn btn--quiet" [disabled]="!!busy()" (click)="cancel(o)">Cancel order</button>
                    </div>
                  } @else {
                    <h2 class="section-title">Waiting for {{ o.counterparty.displayName }} to pay</h2>
                    <p class="secondary">
                      They're sending {{ ngn(o.fiatAmount) }} to
                      @for (detail of o.paymentDetails; track detail.accountNumber; let last = $last) {
                        {{ detail.bankName }} ••{{ detail.accountNumber.slice(-4) }}{{ last ? '' : ' or ' }}
                      }. Your {{ crypto(o.quantity) }} is held in escrow.
                    </p>
                    <div class="notice notice--warn">
                      <cx-icon name="alert" [size]="18" />
                      <span>Only release after the money shows in your bank account. A screenshot or SMS is not proof of payment.</span>
                    </div>
                    <button type="button" class="link" style="justify-self: start" [disabled]="!!busy()" (click)="release(o)">The payment already arrived? Release now</button>
                  }
                }

                @case ('Paid') {
                  @if (o.myRole === 'seller') {
                    <h2 class="section-title">Check your bank account, then release</h2>
                    <p class="secondary">{{ o.counterparty.displayName }} says they sent {{ ngn(o.fiatAmount) }}{{ o.paidAt ? ' at ' + time(o.paidAt) : '' }}.</p>
                    @if (o.buyerPaymentReference) {
                      <div class="kv"><div class="kv__row"><span class="kv__key">Their reference</span><span class="kv__value mono">{{ o.buyerPaymentReference }}</span></div></div>
                    }
                    <div class="notice notice--warn">
                      <cx-icon name="alert" [size]="18" />
                      <span>Release only when {{ ngn(o.fiatAmount) }} has arrived. Check your bank app or statement, not a screenshot. Released crypto can't be taken back.</span>
                    </div>
                    <div class="row">
                      <button type="button" class="btn btn--primary btn--lg" [attr.aria-busy]="busy() === 'release'" [disabled]="!!busy()" (click)="release(o)">Release {{ crypto(o.quantity) }}</button>
                      <ng-container *ngTemplateOutlet="disputeAction; context: { $implicit: o }" />
                    </div>
                  } @else {
                    <h2 class="section-title">Waiting for the seller to release</h2>
                    <p class="secondary">You marked {{ ngn(o.fiatAmount) }} as sent. {{ o.counterparty.displayName }} will release {{ crypto(o.receiveQuantity) }} once they see it.</p>
                    @if (releaseHint(); as hint) {
                      <p class="caption">{{ hint }}</p>
                    }
                    <div class="row">
                      <ng-container *ngTemplateOutlet="disputeAction; context: { $implicit: o }" />
                      <button type="button" class="btn btn--quiet" [disabled]="!!busy()" (click)="cancel(o)">Cancel order</button>
                    </div>
                  }
                }

                @case ('Disputed') {
                  <h2 class="section-title">This order is in dispute</h2>
                  @if (o.dispute; as d) {
                    <p class="secondary">
                      Opened by {{ d.openedBy === o.myRole ? 'you' : 'the ' + d.openedBy }} on {{ dateTime(d.createdAt) }}. Our team reviews the evidence from both sides and
                      decides who receives the escrowed {{ o.asset }}.
                    </p>
                    <div class="kv"><div class="kv__row"><span class="kv__key">Reason</span><span class="kv__value">{{ d.reason }}</span></div></div>

                    <div>
                      <h3 class="section-title" style="font-size: var(--text-md)">Evidence</h3>
                      @for (item of d.evidence; track item.id) {
                        <div class="evidence">
                          <span class="evidence__meta">{{ item.party === o.myRole ? 'You' : item.party === 'support' ? 'Crypton support' : 'The ' + item.party }}, {{ dateTime(item.createdAt) }}</span>
                          @if (item.text) {
                            <span>{{ item.text }}</span>
                          }
                          @if (item.hasFile) {
                            <button type="button" class="link" style="justify-self: start" (click)="download(o, item)">
                              <cx-icon name="file" [size]="14" /> {{ item.fileName ?? 'Attachment' }}
                            </button>
                          }
                        </div>
                      } @empty {
                        <p class="caption">No evidence yet.</p>
                      }
                    </div>

                    <div class="stack-sm">
                      <label class="field">
                        <span class="field__label">Add a note</span>
                        <textarea class="textarea" maxlength="2000" placeholder="What happened? Include times, amounts and references." [value]="evidenceText()" (input)="evidenceText.set($any($event.target).value)"></textarea>
                      </label>
                      <label class="field">
                        <span class="field__label">Attach a file <span class="field__aside">JPG, PNG or PDF up to 5 MB</span></span>
                        <input class="input" type="file" [accept]="accepted" (change)="pickFile($event)" style="padding-top: 0.55rem" />
                        @if (fileError(); as e) {
                          <span class="field__error">{{ e }}</span>
                        }
                      </label>
                      <button type="button" class="btn" style="justify-self: start" [attr.aria-busy]="busy() === 'evidence'" [disabled]="!!busy() || (!evidenceText().trim() && !file()) || !!fileError()" (click)="addEvidence(o)">Submit evidence</button>
                    </div>
                  }
                }

                @case ('Completed') {
                  <ng-container *ngTemplateOutlet="finished; context: { $implicit: o }" />
                }
                @case ('ResolvedToBuyer') {
                  <ng-container *ngTemplateOutlet="finished; context: { $implicit: o }" />
                }
                @case ('ResolvedToSeller') {
                  <ng-container *ngTemplateOutlet="finished; context: { $implicit: o }" />
                }

                @default {
                  <h2 class="section-title">{{ o.status === 'Expired' ? 'This order expired' : 'This order was cancelled' }}</h2>
                  <p class="secondary">
                    @if (o.status === 'Expired') {
                      The payment window ended before the order was marked as paid.
                    } @else {
                      {{ o.cancelReason || 'The buyer cancelled the order.' }}
                    }
                    The escrowed {{ o.asset }} went back to the seller.
                  </p>
                  <a class="btn" style="justify-self: start" routerLink="/p2p">Back to the market</a>
                }
              }
            </div>
          </section>

          <aside class="stack-lg">
            <section class="panel" aria-labelledby="party-title">
              <div class="panel__header"><h2 class="panel__title" id="party-title">{{ o.myRole === 'buyer' ? 'Seller' : 'Buyer' }}</h2></div>
              <div class="panel__body stack">
                <cx-trader-badge [trader]="o.counterparty" />
                <div class="kv">
                  <div class="kv__row"><span class="kv__key">Member since</span><span class="kv__value">{{ date(o.counterparty.memberSince) }}</span></div>
                  <div class="kv__row"><span class="kv__key">Feedback</span><span class="kv__value">{{ o.counterparty.positiveFeedback }} positive, {{ o.counterparty.negativeFeedback }} negative</span></div>
                </div>
              </div>
            </section>

            <section class="panel" aria-labelledby="details-title">
              <div class="panel__header"><h2 class="panel__title" id="details-title">Order details</h2></div>
              <div class="panel__body">
                <div class="kv">
                  <div class="kv__row"><span class="kv__key">Price</span><span class="kv__value figure">{{ ngn(o.price) }}</span></div>
                  <div class="kv__row"><span class="kv__key">Quantity</span><span class="kv__value figure">{{ crypto(o.quantity) }}</span></div>
                  <div class="kv__row"><span class="kv__key">Naira amount</span><span class="kv__value figure">{{ ngn(o.fiatAmount) }}</span></div>
                  @if (o.myRole === 'buyer') {
                    <div class="kv__row"><span class="kv__key">You receive</span><span class="kv__value figure">{{ crypto(o.receiveQuantity) }}</span></div>
                  }
                  @if (hasFee(o)) {
                    <div class="kv__row"><span class="kv__key">Your maker fee</span><span class="kv__value figure">{{ crypto(o.fee) }}</span></div>
                  }
                  <div class="kv__row"><span class="kv__key">Placed</span><span class="kv__value">{{ dateTime(o.createdAt) }}</span></div>
                  <div class="kv__row">
                    <span class="kv__key">Order number</span>
                    <span class="kv__value mono">{{ o.orderNumber }}<cx-copy [value]="o.orderNumber" what="order number" /></span>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      } @else {
        <span class="skeleton" style="height: 20rem"></span>
      }
    </div>

    <ng-template #disputeAction let-o>
      @if (canDispute(o)) {
        <button type="button" class="btn btn--danger" [disabled]="!!busy()" (click)="dispute(o)">Open dispute</button>
      } @else if (o.disputeAvailableAt) {
        <span class="caption">You can open a dispute from {{ time(o.disputeAvailableAt) }}.</span>
      }
    </ng-template>

    <ng-template #finished let-o>
      <h2 class="section-title">
        @if (o.status === 'Completed') {
          {{ o.myRole === 'buyer' ? 'You received ' + crypto(o.receiveQuantity) : 'You sold ' + crypto(o.quantity) + ' for ' + ngn(o.fiatAmount) }}
        } @else {
          {{ o.status === 'ResolvedToBuyer' ? 'Resolved: crypto released to the buyer' : 'Resolved: crypto returned to the seller' }}
        }
      </h2>
      @if (o.dispute?.resolutionNote) {
        <div class="kv"><div class="kv__row"><span class="kv__key">Note from our team</span><span class="kv__value">{{ o.dispute.resolutionNote }}</span></div></div>
      }
      @if (o.completedAt) {
        <p class="caption">Finished {{ dateTime(o.completedAt) }}</p>
      }

      @if (!o.feedbackGiven) {
        <div class="stack-sm">
          <span class="field__label">How was trading with {{ o.counterparty.displayName }}?</span>
          <div class="thumbs" role="group" aria-label="Rate this trader">
            <button type="button" class="btn" [attr.aria-pressed]="positive() === true" [class.btn--primary]="positive() === true" (click)="positive.set(true)"><cx-icon name="thumbs-up" [size]="16" />Good</button>
            <button type="button" class="btn" [attr.aria-pressed]="positive() === false" [class.btn--primary]="positive() === false" (click)="positive.set(false)"><cx-icon name="thumbs-down" [size]="16" />Bad</button>
          </div>
          <textarea class="textarea" maxlength="500" placeholder="Optional comment for other traders" [value]="comment()" (input)="comment.set($any($event.target).value)"></textarea>
          <button type="button" class="btn" style="justify-self: start" [disabled]="positive() === null || !!busy()" [attr.aria-busy]="busy() === 'feedback'" (click)="feedback(o)">Leave feedback</button>
        </div>
      } @else {
        <p class="caption">Thanks, your feedback is saved.</p>
      }
      <a class="btn" style="justify-self: start" routerLink="/p2p">Back to the market</a>
    </ng-template>
  `,
})
export class OrderRoom {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);
  private readonly clock = inject(ClockService);
  private readonly auth = inject(AuthService);
  private readonly wallet = inject(WalletService);

  readonly id = input.required<string>();

  protected readonly order = signal<P2POrder | null>(null);
  protected readonly loadProblem = signal<Problem | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly busy = signal<'paid' | 'release' | 'cancel' | 'dispute' | 'evidence' | 'feedback' | null>(null);
  protected readonly reference = signal('');
  protected readonly evidenceText = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly positive = signal<boolean | null>(null);
  protected readonly comment = signal('');
  protected readonly accepted = ACCEPTED_UPLOADS;

  protected readonly releaseHint = computed(() => {
    const o = this.order();
    return o ? releaseText(o.counterparty) : null;
  });

  protected readonly steps = computed(() => {
    const o = this.order();
    if (!o) {
      return [];
    }

    const buyer = o.myRole === 'buyer';
    const finished = ['Completed', 'ResolvedToBuyer', 'ResolvedToSeller'].includes(o.status);
    const paid = !!o.paidAt || finished || o.status === 'Disputed';
    return [
      { label: 'Order placed', note: this.dateTime(o.createdAt), state: 'done' },
      {
        label: buyer ? `You pay ${formatNgn(o.fiatAmount)}` : `Buyer pays ${formatNgn(o.fiatAmount)}`,
        note: o.paidAt ? `Marked paid ${formatTime(o.paidAt)}` : o.status === 'PendingPayment' ? 'In progress' : '',
        state: paid ? 'done' : o.status === 'PendingPayment' ? 'current' : 'todo',
      },
      {
        label: o.status === 'Disputed' ? 'In dispute' : buyer ? 'Seller releases crypto' : 'You release crypto',
        note: o.completedAt ? this.dateTime(o.completedAt) : o.status === 'Paid' || o.status === 'Disputed' ? 'In progress' : '',
        state: finished ? 'done' : o.status === 'Paid' || o.status === 'Disputed' ? 'current' : 'todo',
      },
    ];
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.reload());
    });

    const timer = setInterval(() => {
      const o = this.order();
      if (o && LIVE.includes(o.status) && document.visibilityState === 'visible' && !this.busy()) {
        this.reload();
      }
    }, 5_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  reload(): void {
    this.api.p2pOrder(this.id()).subscribe({
      next: (order) => {
        const previous = this.order();
        this.order.set(order);
        this.loadProblem.set(null);
        if (previous && previous.status !== order.status) {
          this.problem.set(null);
          this.wallet.reload();
        }
      },
      error: (error: unknown) => {
        if (!this.order()) {
          this.loadProblem.set(toProblem(error));
        }
      },
    });
  }

  canDispute(o: P2POrder): boolean {
    return o.status === 'Paid' && !!o.disputeAvailableAt && Date.parse(o.disputeAvailableAt) <= this.clock.serverNow();
  }

  hasFee(o: P2POrder): boolean {
    return Number(o.fee) > 0;
  }

  async markPaid(o: P2POrder): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Have you sent the payment?',
      body: `Only continue once ${formatNgn(o.fiatAmount)} has left your bank account. Marking an order paid without paying can get your account restricted.`,
      confirmLabel: "Yes, I've paid",
    });
    if (!ok) {
      return;
    }

    this.run('paid', this.api.markPaid(o.id, this.reference().trim() || undefined), 'Marked as paid', 'The seller has been notified.');
  }

  async release(o: P2POrder): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: `Release ${this.crypto(o.quantity)}?`,
      body: `Only release if ${formatNgn(o.fiatAmount)} is in your bank account. This sends the crypto to ${o.counterparty.displayName} and can't be undone.`,
      confirmLabel: 'Release crypto',
    });
    if (!ok) {
      return;
    }

    let code: string | undefined;
    if (this.auth.user()?.twoFactorEnabled) {
      const entered = await this.dialogs.twoFactorCode({ title: 'Confirm release', confirmLabel: 'Release' });
      if (!entered) {
        return;
      }

      code = entered;
    }

    this.run('release', this.api.release(o.id, code), 'Crypto released', 'The order is complete.');
  }

  async cancel(o: P2POrder): Promise<void> {
    const reason = await this.dialogs.prompt({
      title: 'Cancel this order?',
      body: o.status === 'Paid' ? "Only cancel if you haven't paid, or the seller has refunded you. The seller's crypto goes back to them." : "The seller's crypto goes back to them.",
      label: 'Reason (optional)',
      required: false,
      multiline: true,
      maxLength: 1000,
      confirmLabel: 'Cancel order',
      cancelLabel: 'Keep order',
      tone: 'danger',
    });
    if (reason === null) {
      return;
    }

    this.run('cancel', this.api.cancelOrder(o.id, reason || undefined), 'Order cancelled');
  }

  async dispute(o: P2POrder): Promise<void> {
    const reason = await this.dialogs.prompt({
      title: 'Open a dispute',
      body: 'Tell our team what went wrong. You can add screenshots and statements after opening the dispute.',
      label: 'What happened?',
      hint: 'At least 10 characters.',
      multiline: true,
      maxLength: 1000,
      confirmLabel: 'Open dispute',
      tone: 'danger',
    });
    if (!reason) {
      return;
    }

    if (reason.length < 10) {
      this.problem.set({ status: 400, code: 'validation_error', title: 'Describe the problem in at least 10 characters.' });
      return;
    }

    this.run('dispute', this.api.openDispute(o.id, reason), 'Dispute opened', 'Our team will review it.');
  }

  pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.file.set(file);
    this.fileError.set(validateUpload(file));
  }

  addEvidence(o: P2POrder): void {
    const form = new FormData();
    const text = this.evidenceText().trim();
    if (text) {
      form.append('text', text);
    }

    const file = this.file();
    if (file) {
      form.append('file', file, file.name);
    }

    this.busy.set('evidence');
    this.problem.set(null);
    this.api.addEvidence(o.id, form).subscribe({
      next: (order) => {
        this.busy.set(null);
        this.order.set(order);
        this.evidenceText.set('');
        this.file.set(null);
        this.toast.success('Evidence added');
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.problem.set(toProblem(error));
      },
    });
  }

  feedback(o: P2POrder): void {
    const positive = this.positive();
    if (positive === null) {
      return;
    }

    this.run('feedback', this.api.leaveFeedback(o.id, positive, this.comment().trim() || undefined), 'Feedback saved');
  }

  download(o: P2POrder, item: DisputeEvidence): void {
    this.api.evidenceFile(o.id, item.id).subscribe({
      next: (blob) => saveBlob(blob, item.fileName ?? 'evidence'),
      error: (error: unknown) => this.toast.error(error),
    });
  }

  protected crypto(value: string): string {
    const o = this.order();
    return o ? formatAsset(value, o.asset, { full: true }) : value;
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected plainAmount(value: string): string {
    return formatNgn(value).replace('₦', '').replace(/,/g, '');
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  protected dateTime(iso: string): string {
    return formatDateTime(iso);
  }

  protected time(iso: string): string {
    return formatTime(iso);
  }

  private run(kind: 'paid' | 'release' | 'cancel' | 'dispute' | 'feedback', request: ReturnType<Api['markPaid']>, success: string, detail?: string): void {
    this.busy.set(kind);
    this.problem.set(null);
    request.subscribe({
      next: (order) => {
        this.busy.set(null);
        this.order.set(order);
        this.wallet.reload();
        this.toast.success(success, detail);
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.problem.set(toProblem(error));
        this.reload();
      },
    });
  }
}
