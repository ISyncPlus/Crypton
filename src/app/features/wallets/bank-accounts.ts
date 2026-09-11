import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { formatDate } from '../../core/format';
import { Bank, BankAccount, Problem, ResolvedAccount } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'cx-bank-accounts',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .account {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5);
    }

    .account + .account {
      border-top: 1px solid var(--rule);
    }

    .account__main {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }

    .account__icon {
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: var(--radius-sm);
      background: var(--sunken);
      color: var(--ink-2);
    }

    .account__text {
      display: grid;
      min-width: 0;
      line-height: 1.35;
    }

    .account__text small {
      color: var(--ink-3);
    }

    .resolved {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      background: var(--up-soft);
      font-weight: 600;
    }

    .resolved cx-icon {
      color: var(--up);
    }

    .form {
      display: grid;
      gap: var(--space-4);
    }
  `,
  template: `
    <div class="split">
      <section class="panel" aria-labelledby="saved-title">
        <div class="panel__header">
          <h2 class="panel__title" id="saved-title">Saved accounts</h2>
          <span class="caption">{{ accounts().length }} of 10</span>
        </div>
        @for (account of accounts(); track account.id) {
          <div class="account">
            <div class="account__main">
              <span class="account__icon"><cx-icon name="bank" [size]="18" /></span>
              <span class="account__text">
                <strong>{{ account.accountName }}</strong>
                <small>{{ account.bankName }} ••{{ account.accountNumber.slice(-4) }}, added {{ date(account.createdAt) }}</small>
              </span>
            </div>
            <button type="button" class="btn btn--sm btn--quiet" [attr.aria-busy]="removing() === account.id" (click)="remove(account)" [attr.aria-label]="'Remove ' + account.bankName + ' account ending ' + account.accountNumber.slice(-4)">
              <cx-icon name="trash" [size]="16" />
            </button>
          </div>
        } @empty {
          @if (loaded()) {
            <div class="empty">
              <strong>No bank accounts yet</strong>
              <p>Add an account in your own name to withdraw naira and receive P2P payments.</p>
            </div>
          } @else {
            <div class="panel__body"><span class="skeleton" style="height: 6rem"></span></div>
          }
        }
      </section>

      <section class="panel" aria-labelledby="add-title">
        <div class="panel__header">
          <h2 class="panel__title" id="add-title">Add a bank account</h2>
        </div>
        <div class="panel__body form">
          @if (tier() >= 1) {
            <p class="caption">The account name must match your verified name: {{ fullName() }}.</p>
          }

          <label class="field">
            <span class="field__label">Bank</span>
            <select class="select" [value]="bankCode()" (change)="setBank($any($event.target).value)" [disabled]="!banks().length">
              <option value="">{{ banks().length ? 'Choose a bank' : 'Loading banks…' }}</option>
              @for (bank of banks(); track bank.code) {
                <option [value]="bank.code" [selected]="bank.code === bankCode()">{{ bank.name }}</option>
              }
            </select>
          </label>

          <label class="field">
            <span class="field__label">Account number</span>
            <input
              class="input"
              inputmode="numeric"
              autocomplete="off"
              maxlength="10"
              placeholder="10 digits"
              [value]="accountNumber()"
              (input)="setNumber($event)"
              [attr.aria-invalid]="!!problem()"
            />
            <span class="field__hint">Your 10-digit NUBAN account number.</span>
          </label>

          @if (resolving()) {
            <span class="caption" aria-live="polite">Checking the account name…</span>
          } @else if (resolved(); as r) {
            <div class="resolved" aria-live="polite"><cx-icon name="check" [size]="18" />{{ r.accountName }}</div>
          }

          @if (problem(); as p) {
            <div class="notice notice--bad" role="alert">
              <cx-icon name="alert" [size]="18" />
              <span>{{ p.title }}</span>
            </div>
          }

          <button type="button" class="btn btn--primary" [disabled]="!resolved() || saving()" [attr.aria-busy]="saving()" (click)="save()">Save account</button>
        </div>
      </section>
    </div>
  `,
})
export class BankAccounts implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);
  private readonly auth = inject(AuthService);

  protected readonly accounts = signal<BankAccount[]>([]);
  protected readonly loaded = signal(false);
  protected readonly banks = signal<Bank[]>([]);
  protected readonly bankCode = signal('');
  protected readonly accountNumber = signal('');
  protected readonly resolved = signal<ResolvedAccount | null>(null);
  protected readonly resolving = signal(false);
  protected readonly saving = signal(false);
  protected readonly removing = signal<string | null>(null);
  protected readonly problem = signal<Problem | null>(null);

  protected readonly tier = computed(() => this.auth.user()?.kycTier ?? 0);
  protected readonly fullName = computed(() => `${this.auth.user()?.firstName ?? ''} ${this.auth.user()?.lastName ?? ''}`.trim());

  private resolveSeq = 0;

  ngOnInit(): void {
    this.load();
    this.api.banks().subscribe({
      next: (banks) => this.banks.set([...banks].sort((a, b) => a.name.localeCompare(b.name))),
      error: (error: unknown) => this.problem.set(toProblem(error)),
    });
  }

  load(): void {
    this.api.bankAccounts().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        this.loaded.set(true);
        this.toast.error(error);
      },
    });
  }

  setBank(code: string): void {
    this.bankCode.set(code);
    this.tryResolve();
  }

  setNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    if (input.value !== digits) {
      input.value = digits;
    }

    this.accountNumber.set(digits);
    this.tryResolve();
  }

  save(): void {
    const resolved = this.resolved();
    if (!resolved || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.problem.set(null);
    this.api.addBankAccount(this.bankCode(), resolved.accountNumber).subscribe({
      next: (account) => {
        this.saving.set(false);
        this.accounts.update((list) => [account, ...list.filter((a) => a.id !== account.id)]);
        this.bankCode.set('');
        this.accountNumber.set('');
        this.resolved.set(null);
        this.toast.success('Bank account saved', `${account.bankName} ••${account.accountNumber.slice(-4)}`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.problem.set(toProblem(error));
      },
    });
  }

  async remove(account: BankAccount): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: 'Remove this bank account?',
      body: `${account.bankName} ••${account.accountNumber.slice(-4)} will no longer be available for withdrawals or P2P ads. Past withdrawals are not affected.`,
      confirmLabel: 'Remove account',
      tone: 'danger',
    });
    if (!ok) {
      return;
    }

    this.removing.set(account.id);
    this.api.removeBankAccount(account.id).subscribe({
      next: () => {
        this.removing.set(null);
        this.accounts.update((list) => list.filter((a) => a.id !== account.id));
        this.toast.success('Bank account removed');
      },
      error: (error: unknown) => {
        this.removing.set(null);
        this.toast.error(error);
      },
    });
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  private tryResolve(): void {
    this.resolved.set(null);
    this.problem.set(null);
    const code = this.bankCode();
    const number = this.accountNumber();
    if (!code || number.length !== 10) {
      this.resolving.set(false);
      return;
    }

    const seq = ++this.resolveSeq;
    this.resolving.set(true);
    this.api.resolveAccount(code, number).subscribe({
      next: (resolved) => {
        if (seq === this.resolveSeq) {
          this.resolving.set(false);
          this.resolved.set(resolved);
        }
      },
      error: (error: unknown) => {
        if (seq === this.resolveSeq) {
          this.resolving.set(false);
          this.problem.set(toProblem(error));
        }
      },
    });
  }
}
