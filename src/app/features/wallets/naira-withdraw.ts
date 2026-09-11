import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ClockService } from '../../core/clock.service';
import { add, gt, sub } from '../../core/decimal';
import { fixed, formatDateTime, formatNgn } from '../../core/format';
import { AmountInput, checkAmount, errorsMessage, parseAmount } from '../../core/forms';
import { newId } from '../../core/ids';
import { BankAccount, FiatConfig, FiatWithdrawal, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { WalletService } from '../../core/wallet.service';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';

@Component({
  selector: 'cx-naira-withdraw',
  imports: [RouterLink, Icon, Status, AmountInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .form {
      display: grid;
      gap: var(--space-5);
    }

    .choice small {
      display: block;
      color: var(--ink-3);
    }

    .result {
      display: grid;
      justify-items: start;
      gap: var(--space-4);
    }

    .result .figure-xl {
      font-size: var(--text-3xl);
    }
  `,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/wallets"><cx-icon name="arrow-left" [size]="16" />Wallets</a>
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Withdraw naira</h1>
          <p class="lede">Send naira to a Nigerian bank account in your name.</p>
        </div>
      </header>

      @if (tier() < 1) {
        <div class="notice notice--warn" role="status">
          <cx-icon name="id" [size]="18" />
          <div class="notice__body">
            <strong>Verify your identity first</strong>
            <span>Naira withdrawals unlock after identity verification.</span>
            <a class="link" routerLink="/account/verification">Verify now</a>
          </div>
        </div>
      }

      <div class="split">
        <section class="panel" aria-label="Withdrawal form">
          @if (result(); as w) {
            <div class="panel__body result" aria-live="polite">
              <cx-status kind="fiatWithdrawal" [status]="w.status" />
              <span class="figure-xl">{{ ngn(w.amount) }}</span>
              <p class="secondary">
                @if (w.status === 'PendingReview') {
                  Your withdrawal is waiting for a quick review. We'll notify you once it's sent to {{ w.bankName }}.
                } @else {
                  On its way to {{ w.accountName }}, {{ w.bankName }} ••{{ w.accountNumber.slice(-4) }}. We'll notify you when the bank confirms.
                }
              </p>
              <div class="row">
                <a class="btn btn--primary" routerLink="/wallets/withdrawals">Track withdrawal</a>
                <button type="button" class="btn" (click)="reset()">Make another</button>
              </div>
            </div>
          } @else {
            <div class="panel__body form">
              @if (lockedUntil(); as until) {
                <div class="notice notice--warn" role="status">
                  <cx-icon name="lock" [size]="18" />
                  <span>Withdrawals are paused until {{ until }} after a recent security change.</span>
                </div>
              }

              <fieldset class="field" style="border: 0; margin: 0; padding: 0">
                <legend class="field__label" style="margin-bottom: 0.375rem">
                  <span>Send to</span>
                  <a class="link field__aside" routerLink="/wallets/bank-accounts">Manage accounts</a>
                </legend>
                @if (accounts(); as list) {
                  <div class="choice-list">
                    @for (account of list; track account.id) {
                      <label class="choice">
                        <input type="radio" name="bank-account" [checked]="accountId() === account.id" (change)="accountId.set(account.id)" />
                        <cx-icon name="bank" [size]="18" />
                        <span>
                          <strong>{{ account.accountName }}</strong>
                          <small>{{ account.bankName }} ••{{ account.accountNumber.slice(-4) }}</small>
                        </span>
                      </label>
                    } @empty {
                      <div class="notice">
                        <cx-icon name="bank" [size]="18" />
                        <div class="notice__body">
                          <span>Add a bank account in your name to withdraw.</span>
                          <a class="link" routerLink="/wallets/bank-accounts">Add bank account</a>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <span class="skeleton" style="height: 4rem"></span>
                }
              </fieldset>

              <div class="field">
                <label class="field__label" for="naira-amount">
                  <span>Amount</span>
                  <button type="button" class="link field__aside" (click)="useMax()" [disabled]="!gt(maxAmount(), '0')">Max {{ ngn(maxAmount()) }}</button>
                </label>
                <div class="input-group" style="--addon-width: 4rem">
                  <input id="naira-amount" class="input input--amount" cxAmount placeholder="0.00" [value]="amount()" (input)="amount.set($any($event.target).value)" [attr.aria-invalid]="!!amountError()" />
                  <span class="input-group__addon">NGN</span>
                </div>
                @if (amountError(); as e) {
                  <span class="field__error">{{ e }}</span>
                } @else {
                  <span class="field__hint">Available {{ ngn(available()) }}</span>
                }
              </div>

              @if (config(); as c) {
                <div class="kv kv--total">
                  <div class="kv__row"><span class="kv__key">Transfer fee</span><span class="kv__value figure">{{ ngn(c.withdrawalFeeNgn) }}</span></div>
                  <div class="kv__row"><span class="kv__key">The bank receives</span><span class="kv__value figure">{{ parsed() ? ngn(parsed()!) : '–' }}</span></div>
                  <div class="kv__row"><span class="kv__key">Total deducted</span><span class="kv__value figure">{{ parsed() ? ngn(total()) : '–' }}</span></div>
                </div>
              }

              @if (problem(); as p) {
                <div class="notice notice--bad" role="alert">
                  <cx-icon name="alert" [size]="18" />
                  <div class="notice__body">
                    <span>{{ p.title }}</span>
                    @if (p.code === 'two_factor_required') {
                      <a class="link" routerLink="/account/security">Turn on two-factor authentication</a>
                    }
                    @if (p.code === 'limit_exceeded' || p.code === 'kyc_required') {
                      <a class="link" routerLink="/account/verification">Raise your limits</a>
                    }
                  </div>
                </div>
              }

              <button type="button" class="btn btn--primary btn--lg btn--block" [disabled]="!canSubmit()" [attr.aria-busy]="submitting()" (click)="submit()">
                {{ parsed() && !amountError() ? 'Withdraw ' + ngn(parsed()!) : 'Withdraw' }}
              </button>
            </div>
          }
        </section>

        <aside class="panel" aria-labelledby="naira-facts">
          <div class="panel__header">
            <h2 class="panel__title" id="naira-facts">Good to know</h2>
          </div>
          <div class="panel__body stack">
            @if (config(); as c) {
              <p class="secondary">Each withdrawal can be between {{ ngn(c.minWithdrawalNgn, 0) }} and {{ ngn(c.maxWithdrawalNgn, 0) }}, with a flat {{ ngn(c.withdrawalFeeNgn) }} transfer fee.</p>
            }
            <p class="secondary">Most transfers arrive within minutes. Larger amounts may be reviewed by our team first.</p>
            <p class="secondary">You can cancel a withdrawal while it is still in review or queued.</p>
          </div>
        </aside>
      </div>
    </div>
  `,
})
export class NairaWithdraw implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly wallet = inject(WalletService);
  private readonly dialogs = inject(Dialogs);
  private readonly clock = inject(ClockService);

  protected readonly gt = gt;
  protected readonly tier = computed(() => this.auth.user()?.kycTier ?? 0);
  protected readonly config = signal<FiatConfig | null>(null);
  protected readonly accounts = signal<BankAccount[] | null>(null);
  protected readonly accountId = signal<string | null>(null);
  protected readonly amount = signal('');
  protected readonly submitting = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly result = signal<FiatWithdrawal | null>(null);
  private idempotency: { key: string; fingerprint: string } | null = null;

  protected readonly available = computed(() => this.wallet.balance('NGN').available);
  protected readonly lockedUntil = computed(() => {
    const until = this.auth.user()?.withdrawalsLockedUntil;
    return until && Date.parse(until) > this.clock.serverNow() ? formatDateTime(until) : null;
  });

  protected readonly maxAmount = computed(() => {
    const c = this.config();
    if (!c) {
      return '0';
    }

    let max = sub(this.available(), c.withdrawalFeeNgn);
    if (gt(max, c.maxWithdrawalNgn)) {
      max = c.maxWithdrawalNgn;
    }

    return gt(max, '0') ? fixed(max, 2).replace(/,/g, '') : '0';
  });

  protected readonly amountError = computed(() => {
    const c = this.config();
    if (!c) {
      return null;
    }

    const basic = checkAmount(this.amount(), 2, c.minWithdrawalNgn, c.maxWithdrawalNgn);
    if (basic) {
      return errorsMessage(basic, (key, value) =>
        key === 'min' ? `The minimum withdrawal is ${formatNgn(String(value), 0)}.` : key === 'max' ? `The maximum per withdrawal is ${formatNgn(String(value), 0)}.` : key === 'decimals' ? 'Use at most 2 decimal places.' : 'Enter an amount like 25000.',
      );
    }

    const amount = parseAmount(this.amount());
    if (amount && gt(add(amount, c.withdrawalFeeNgn), this.available())) {
      return `Not enough naira. With the fee you need ${formatNgn(add(amount, c.withdrawalFeeNgn))}.`;
    }

    return null;
  });

  protected readonly parsed = computed(() => (this.amountError() ? null : parseAmount(this.amount())));
  protected readonly total = computed(() => {
    const amount = this.parsed();
    const c = this.config();
    return amount && c ? add(amount, c.withdrawalFeeNgn) : '0';
  });

  protected readonly canSubmit = computed(() => this.tier() >= 1 && !this.lockedUntil() && !!this.accountId() && !!this.parsed() && !this.submitting());

  ngOnInit(): void {
    this.wallet.reload();
    this.api.fiatConfig().subscribe({ next: (c) => this.config.set(c), error: (e: unknown) => this.problem.set(toProblem(e)) });
    this.api.bankAccounts().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        if (accounts.length === 1) {
          this.accountId.set(accounts[0].id);
        }
      },
      error: (e: unknown) => {
        this.accounts.set([]);
        this.problem.set(toProblem(e));
      },
    });
  }

  useMax(): void {
    this.amount.set(this.maxAmount());
  }

  reset(): void {
    this.result.set(null);
    this.problem.set(null);
    this.amount.set('');
    this.idempotency = null;
  }

  async submit(): Promise<void> {
    const amount = this.parsed();
    const account = this.accounts()?.find((a) => a.id === this.accountId());
    const config = this.config();
    if (!amount || !account || !config || !this.canSubmit()) {
      return;
    }

    const confirmed = await this.dialogs.confirm({
      title: `Withdraw ${formatNgn(amount)}?`,
      body: `To ${account.accountName}, ${account.bankName} ••${account.accountNumber.slice(-4)}. ${formatNgn(add(amount, config.withdrawalFeeNgn))} including the fee leaves your balance.`,
      confirmLabel: 'Withdraw now',
    });
    if (!confirmed) {
      return;
    }

    let twoFactorCode: string | undefined;
    if (this.auth.user()?.twoFactorEnabled) {
      const code = await this.dialogs.twoFactorCode({ title: 'Confirm withdrawal', confirmLabel: 'Confirm and withdraw' });
      if (!code) {
        return;
      }

      twoFactorCode = code;
    }

    const fingerprint = `${account.id}|${amount}`;
    if (!this.idempotency || this.idempotency.fingerprint !== fingerprint) {
      this.idempotency = { key: newId(), fingerprint };
    }

    this.submitting.set(true);
    this.problem.set(null);
    this.api.withdrawFiat({ bankAccountId: account.id, amount, twoFactorCode, idempotencyKey: this.idempotency.key }).subscribe({
      next: (withdrawal) => {
        this.submitting.set(false);
        this.result.set(withdrawal);
        this.idempotency = null;
        this.wallet.reload();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const problem = toProblem(error);
        this.problem.set(problem);
        if (problem.status >= 400 && problem.status < 500) {
          this.idempotency = null;
        }
      },
    });
  }

  protected ngn(value: string, digits = 2): string {
    return formatNgn(value, digits);
  }
}
