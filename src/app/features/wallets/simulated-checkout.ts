import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { formatNgn } from '../../core/format';
import { Problem, SimulatedCheckout as Checkout } from '../../core/models';
import { toProblem } from '../../core/problem';
import { Icon } from '../../ui/icon';

/** Stand-in for the payment provider's hosted page when Payments:Provider is Simulated. */
@Component({
  selector: 'cx-simulated-checkout',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: calc(100dvh - var(--topbar-height));
      padding: var(--space-5);
    }

    .sheet {
      display: grid;
      gap: var(--space-5);
      width: 100%;
      max-width: 26rem;
      padding: var(--space-6);
      border: 2px dashed color-mix(in srgb, var(--warn) 55%, var(--rule));
      border-radius: var(--radius);
      background: var(--surface);
    }

    .banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--warn);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .amount {
      font-size: var(--text-3xl);
      font-stretch: 120%;
      font-weight: 650;
      letter-spacing: -0.02em;
    }
  `,
  template: `
    <div class="sheet">
      <div class="banner"><cx-icon name="info" [size]="18" />Test payment. No real money moves.</div>

      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert">
          <cx-icon name="alert" [size]="18" />
          <span>{{ p.title }}</span>
        </div>
        <a class="btn" routerLink="/wallets/naira/deposit">Back to deposits</a>
      } @else if (checkout(); as c) {
        <div class="stack-sm">
          <span class="caption">Paying Crypton</span>
          <span class="amount">{{ ngn(c.amount) }}</span>
          <span class="secondary">{{ c.email }}</span>
        </div>
        <div class="kv">
          <div class="kv__row"><span class="kv__key">Reference</span><span class="kv__value mono">{{ c.reference }}</span></div>
          <div class="kv__row"><span class="kv__key">Status</span><span class="kv__value">{{ c.status }}</span></div>
        </div>
        @if (c.status === 'pending') {
          <div class="stack-sm">
            <button type="button" class="btn btn--primary btn--lg btn--block" [attr.aria-busy]="busy() === 'pay'" [disabled]="!!busy()" (click)="complete(true)">Pay {{ ngn(c.amount) }}</button>
            <button type="button" class="btn btn--block" [attr.aria-busy]="busy() === 'decline'" [disabled]="!!busy()" (click)="complete(false)">Decline payment</button>
          </div>
        } @else {
          <button type="button" class="btn btn--primary btn--block" (click)="goBack()">Return to Crypton</button>
        }
      } @else {
        <span class="skeleton" style="height: 10rem"></span>
      }
    </div>
  `,
})
export class SimulatedCheckout implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly reference = input<string>();

  protected readonly checkout = signal<Checkout | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly busy = signal<'pay' | 'decline' | null>(null);

  ngOnInit(): void {
    const reference = this.reference();
    if (!reference) {
      this.problem.set({ status: 400, code: 'validation_error', title: 'This checkout link is missing its payment reference.' });
      return;
    }

    this.api.simulatedCheckout(reference).subscribe({ next: (c) => this.checkout.set(c), error: (e: unknown) => this.problem.set(toProblem(e)) });
  }

  complete(success: boolean): void {
    const reference = this.reference();
    if (!reference) {
      return;
    }

    this.busy.set(success ? 'pay' : 'decline');
    this.api.completeSimulatedCheckout(reference, success).subscribe({
      next: () => this.goBack(),
      error: (error: unknown) => {
        this.busy.set(null);
        this.problem.set(toProblem(error));
      },
    });
  }

  goBack(): void {
    void this.router.navigate(['/wallets/fiat/deposit/return'], { queryParams: { reference: this.reference() } });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }
}
