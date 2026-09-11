import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { isZero, sub } from '../../core/decimal';
import { formatNgn } from '../../core/format';
import { FiatDeposit, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { WalletService } from '../../core/wallet.service';
import { Icon } from '../../ui/icon';

const MAX_CHECKS = 15;

@Component({
  selector: 'cx-deposit-return',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .card {
      display: grid;
      justify-items: start;
      gap: var(--space-4);
      max-width: 34rem;
    }

    .icon {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      background: var(--info-soft);
      color: var(--info);
    }

    .icon.is-ok {
      background: var(--up-soft);
      color: var(--up);
    }

    .icon.is-bad {
      background: var(--down-soft);
      color: var(--down);
    }

    .card .figure-xl {
      font-size: var(--text-3xl);
    }
  `,
  template: `
    <div class="page">
      <section class="panel">
        <div class="panel__body card" aria-live="polite">
          @if (problem(); as p) {
            <span class="icon is-bad"><cx-icon name="alert" [size]="22" /></span>
            <h1 class="page-title">We couldn't check this payment</h1>
            <p class="secondary">{{ p.title }}</p>
            <div class="row">
              <button type="button" class="btn btn--primary" (click)="check()">Try again</button>
              <a class="btn" routerLink="/wallets/deposits">View deposits</a>
            </div>
          } @else if (deposit(); as d) {
            @switch (d.status) {
              @case ('Succeeded') {
                <span class="icon is-ok"><cx-icon name="check" [size]="22" /></span>
                <h1 class="page-title">Naira added</h1>
                <span class="figure-xl">{{ ngn(credit(d)) }}</span>
                <p class="secondary">You paid {{ ngn(d.amount) }}{{ zero(d.fee) ? '' : ', including a ' + ngn(d.fee) + ' fee' }}. It's in your naira wallet now.</p>
                <div class="row">
                  <a class="btn btn--primary" routerLink="/trade">Buy crypto</a>
                  <a class="btn" routerLink="/wallets">View wallets</a>
                </div>
              }
              @case ('Initiated') {
                <span class="icon"><cx-icon name="clock" [size]="22" /></span>
                <h1 class="page-title">Waiting for confirmation</h1>
                <p class="secondary">
                  @if (checks() < max) {
                    We're confirming your payment of {{ ngn(d.amount) }} with the payment provider. This page updates by itself.
                  } @else {
                    We haven't received confirmation yet. If you completed the payment, it will be credited automatically once the provider confirms, and we'll notify you.
                  }
                </p>
                <div class="row">
                  @if (checks() >= max) {
                    <button type="button" class="btn btn--primary" (click)="restart()">Check again</button>
                  }
                  @if (d.authorizationUrl) {
                    <a class="btn" [href]="d.authorizationUrl">Return to payment page</a>
                  }
                  <a class="btn btn--quiet" routerLink="/wallets/deposits">View deposits</a>
                </div>
              }
              @default {
                <span class="icon is-bad"><cx-icon name="x" [size]="22" /></span>
                <h1 class="page-title">Payment not completed</h1>
                <p class="secondary">The payment of {{ ngn(d.amount) }} {{ d.status === 'Abandoned' ? 'was abandoned' : 'failed' }}, so nothing was charged to your wallet. You can start a new deposit.</p>
                <div class="row">
                  <a class="btn btn--primary" routerLink="/wallets/naira/deposit">Try again</a>
                  <a class="btn" routerLink="/wallets">View wallets</a>
                </div>
              }
            }
          } @else {
            <span class="icon"><cx-icon name="clock" [size]="22" /></span>
            <h1 class="page-title">Checking your payment</h1>
            <span class="skeleton" style="width: 14rem; height: 1.5rem"></span>
          }
        </div>
      </section>
    </div>
  `,
})
export class DepositReturn implements OnInit {
  private readonly api = inject(Api);
  private readonly wallet = inject(WalletService);
  readonly reference = input<string>();

  protected readonly max = MAX_CHECKS;
  protected readonly deposit = signal<FiatDeposit | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly checks = signal(0);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  ngOnInit(): void {
    this.check();
  }

  restart(): void {
    this.checks.set(0);
    this.check();
  }

  check(): void {
    const reference = this.reference();
    if (!reference) {
      this.problem.set({ status: 400, code: 'validation_error', title: 'This link is missing the payment reference.' });
      return;
    }

    this.problem.set(null);
    this.checks.update((n) => n + 1);
    this.api.verifyFiatDeposit(reference).subscribe({
      next: (deposit) => {
        this.deposit.set(deposit);
        if (deposit.status === 'Succeeded') {
          this.wallet.reload();
        } else if (deposit.status === 'Initiated' && this.checks() < MAX_CHECKS) {
          this.timer = setTimeout(() => this.check(), 4000);
        }
      },
      error: (error: unknown) => this.problem.set(toProblem(error)),
    });
  }

  protected zero(value: string): boolean {
    return isZero(value);
  }

  protected credit(d: FiatDeposit): string {
    return sub(d.amount, d.fee);
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }
}
