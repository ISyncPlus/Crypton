import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { AdminUserDetail, STAFF_ROLES } from '../../core/admin-models';
import { AuthService } from '../../core/auth.service';
import { formatAsset, formatDate, formatDateTime, formatNgn } from '../../core/format';
import { parseAmount } from '../../core/forms';
import { AssetCode, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { AssetMark } from '../../ui/asset-mark';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';
import { adminTableStyles } from './admin-shared';

@Component({
  selector: 'cx-admin-user-detail',
  imports: [RouterLink, AssetMark, Icon, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    adminTableStyles,
    `
      .asset {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .roles {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
      }

      .adjust {
        display: grid;
        grid-template-columns: 7rem minmax(0, 1fr);
        gap: var(--space-3);
      }
    `,
  ],
  template: `
    <div class="page">
      <a class="back-link" routerLink="/admin/users"><cx-icon name="arrow-left" [size]="16" />Users</a>

      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      }

      @if (detail(); as d) {
        <header class="page-head">
          <div class="page-head__text">
            <h1 class="page-title">{{ d.user.firstName }} {{ d.user.lastName }}</h1>
            <div class="row">
              <cx-status kind="user" [status]="d.user.status" />
              <span class="caption">{{ d.user.email }}{{ d.user.displayName ? ', @' + d.user.displayName : '' }}</span>
            </div>
          </div>
          <div class="row">
            @if (auth.isCompliance()) {
              @if (d.user.status === 'Frozen') {
                <button type="button" class="btn" [attr.aria-busy]="busy() === 'unfreeze'" [disabled]="!!busy()" (click)="unfreeze(d)">Unfreeze</button>
              } @else if (d.user.status === 'Active') {
                <button type="button" class="btn btn--danger" [attr.aria-busy]="busy() === 'freeze'" [disabled]="!!busy()" (click)="freeze(d)">Freeze account</button>
              }
              <button type="button" class="btn" [attr.aria-busy]="busy() === 'sessions'" [disabled]="!!busy() || d.activeSessions === 0" (click)="revokeSessions(d)">Sign out everywhere</button>
            }
            @if (auth.isAdmin() && d.user.twoFactorEnabled) {
              <button type="button" class="btn" [attr.aria-busy]="busy() === '2fa'" [disabled]="!!busy()" (click)="resetTwoFactor(d)">Reset two-factor</button>
            }
          </div>
        </header>

        @if (d.frozenReason) {
          <div class="notice notice--bad"><cx-icon name="lock" [size]="18" /><span>Frozen: {{ d.frozenReason }}</span></div>
        }
        @if (d.openAlerts > 0 && auth.isCompliance()) {
          <div class="notice notice--warn">
            <cx-icon name="flag" [size]="18" />
            <div class="notice__body">
              <span>{{ d.openAlerts }} open compliance alert{{ d.openAlerts === 1 ? '' : 's' }} for this user.</span>
              <a class="link" routerLink="/admin/aml" [queryParams]="{ userId: d.user.id }">Review alerts</a>
            </div>
          </div>
        }

        <div class="split">
          <div class="stack-lg">
            <section class="panel" aria-labelledby="balances-title">
              <div class="panel__header"><h2 class="panel__title" id="balances-title">Balances</h2></div>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th scope="col">Asset</th><th scope="col" class="end">Available</th><th scope="col" class="end">On hold</th><th scope="col" class="end">Value</th></tr></thead>
                  <tbody>
                    @for (b of d.balances; track b.asset) {
                      <tr>
                        <td><span class="asset"><cx-asset-mark [asset]="b.asset" [size]="22" />{{ b.asset }}</span></td>
                        <td class="end figure">{{ asset(b.available, b.asset) }}</td>
                        <td class="end figure muted">{{ asset(b.locked, b.asset) }}</td>
                        <td class="end figure">{{ ngn(b.valueNgn) }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="4" class="muted">No balances yet.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>

            <section class="panel" aria-labelledby="kyc-title">
              <div class="panel__header"><h2 class="panel__title" id="kyc-title">Verification</h2><span class="caption">Level {{ d.user.kycTier }}</span></div>
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th scope="col">Submission</th><th scope="col">Provider</th><th scope="col">Status</th><th scope="col">Submitted</th></tr></thead>
                  <tbody>
                    @for (k of d.kyc; track k.id) {
                      <tr>
                        <td>
                          @if (auth.isCompliance()) {
                            <a class="user-link" [routerLink]="['/admin/kyc', k.id]">Tier {{ k.targetTier }}</a>
                          } @else {
                            Tier {{ k.targetTier }}
                          }
                          @if (k.rejectionReason) {
                            <div class="sub">{{ k.rejectionReason }}</div>
                          }
                        </td>
                        <td>{{ k.provider }}</td>
                        <td><cx-status kind="kyc" [status]="k.status" /></td>
                        <td class="muted">{{ when(k.createdAt) }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="4" class="muted">No submissions.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>

            <section class="panel" aria-labelledby="banks-title">
              <div class="panel__header"><h2 class="panel__title" id="banks-title">Bank accounts</h2></div>
              <div class="table-wrap">
                <table class="table">
                  <tbody>
                    @for (b of d.bankAccounts; track b.id) {
                      <tr><td>{{ b.accountName }}</td><td>{{ b.bankName }}</td><td class="figure">{{ b.accountNumber }}</td><td class="muted">{{ date(b.createdAt) }}</td></tr>
                    } @empty {
                      <tr><td class="muted">No bank accounts.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div class="stack-lg">
            <section class="panel" aria-labelledby="facts-title">
              <div class="panel__header"><h2 class="panel__title" id="facts-title">Account</h2></div>
              <div class="panel__body">
                <div class="kv">
                  <div class="kv__row"><span class="kv__key">Joined</span><span class="kv__value">{{ when(d.user.createdAt) }}</span></div>
                  <div class="kv__row"><span class="kv__key">Last sign-in</span><span class="kv__value">{{ d.lastLoginAt ? when(d.lastLoginAt) : 'Never' }}</span></div>
                  <div class="kv__row"><span class="kv__key">Email confirmed</span><span class="kv__value">{{ d.emailConfirmed ? 'Yes' : 'No' }}</span></div>
                  <div class="kv__row"><span class="kv__key">Two-factor</span><span class="kv__value">{{ d.user.twoFactorEnabled ? 'On' : 'Off' }}</span></div>
                  <div class="kv__row"><span class="kv__key">Active sessions</span><span class="kv__value">{{ d.activeSessions }}</span></div>
                  @if (d.lockoutEnd && isFuture(d.lockoutEnd)) {
                    <div class="kv__row"><span class="kv__key">Locked out until</span><span class="kv__value">{{ when(d.lockoutEnd) }}</span></div>
                  }
                  @if (d.user.withdrawalsLockedUntil && isFuture(d.user.withdrawalsLockedUntil)) {
                    <div class="kv__row"><span class="kv__key">Withdrawals paused until</span><span class="kv__value">{{ when(d.user.withdrawalsLockedUntil) }}</span></div>
                  }
                  <div class="kv__row"><span class="kv__key">User ID</span><span class="kv__value mono">{{ d.user.id }}</span></div>
                </div>
              </div>
              @if (auth.isCompliance()) {
                <div class="panel__footer">
                  <a class="btn btn--sm" routerLink="/admin/audit" [queryParams]="{ userId: d.user.id }">Audit trail</a>
                  <a class="btn btn--sm" routerLink="/admin/trades" [queryParams]="{ userId: d.user.id }">Trades</a>
                </div>
              }
            </section>

            @if (auth.isAdmin()) {
              <section class="panel" aria-labelledby="roles-title">
                <div class="panel__header"><h2 class="panel__title" id="roles-title">Staff roles</h2></div>
                <div class="panel__body stack">
                  <div class="roles">
                    @for (role of roles; track role) {
                      <label class="checkbox"><input type="checkbox" [checked]="selectedRoles().includes(role)" (change)="toggleRole(role)" />{{ role }}</label>
                    }
                  </div>
                  <button type="button" class="btn btn--sm" style="justify-self: start" [disabled]="!rolesChanged() || !!busy()" [attr.aria-busy]="busy() === 'roles'" (click)="saveRoles(d)">Save roles</button>
                </div>
              </section>

              <section class="panel" aria-labelledby="adjust-title">
                <div class="panel__header"><h2 class="panel__title" id="adjust-title">Adjust balance</h2></div>
                <div class="panel__body stack">
                  <p class="caption">Posts a ledger adjustment against the adjustments account. Use a negative amount to debit. Every adjustment is audited and the user is notified.</p>
                  <div class="adjust">
                    <select class="select" aria-label="Asset" [value]="adjustAsset()" (change)="adjustAsset.set($any($event.target).value)">
                      @for (code of assetCodes; track code) {
                        <option [value]="code" [selected]="code === adjustAsset()">{{ code }}</option>
                      }
                    </select>
                    <input class="input" aria-label="Amount" inputmode="decimal" placeholder="Amount, e.g. 2500 or -0.01" [value]="adjustAmount()" (input)="adjustAmount.set($any($event.target).value)" />
                  </div>
                  <input class="input" aria-label="Reason" maxlength="500" placeholder="Reason (shown to the user)" [value]="adjustReason()" (input)="adjustReason.set($any($event.target).value)" />
                  <button type="button" class="btn btn--sm" style="justify-self: start" [disabled]="!canAdjust() || !!busy()" [attr.aria-busy]="busy() === 'adjust'" (click)="adjust(d)">Post adjustment</button>
                </div>
              </section>
            }
          </div>
        </div>
      } @else if (!problem()) {
        <span class="skeleton" style="height: 20rem"></span>
      }
    </div>
  `,
})
export class AdminUserDetailPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  protected readonly roles = STAFF_ROLES;
  protected readonly assetCodes: AssetCode[] = ['NGN', 'BTC', 'ETH', 'USDT'];
  protected readonly detail = signal<AdminUserDetail | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly busy = signal<string | null>(null);
  protected readonly selectedRoles = signal<string[]>([]);
  protected readonly adjustAsset = signal<AssetCode>('NGN');
  protected readonly adjustAmount = signal('');
  protected readonly adjustReason = signal('');

  protected readonly rolesChanged = computed(() => {
    const current = [...(this.detail()?.user.roles ?? [])].sort().join(',');
    return current !== [...this.selectedRoles()].sort().join(',');
  });

  protected readonly canAdjust = computed(() => {
    const text = this.adjustAmount().trim();
    const negative = text.startsWith('-');
    const amount = parseAmount(negative ? text.slice(1) : text);
    return !!amount && Number(amount) > 0 && this.adjustReason().trim().length >= 5;
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.api.user(this.id()).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.selectedRoles.set(d.user.roles);
        this.problem.set(null);
      },
      error: (e: unknown) => this.problem.set(toProblem(e)),
    });
  }

  async freeze(d: AdminUserDetail): Promise<void> {
    const reason = await this.dialogs.prompt({
      title: `Freeze ${d.user.firstName}'s account?`,
      body: 'They can still sign in and see balances, but trading, withdrawals and P2P stop. The reason is recorded in the audit log.',
      label: 'Reason',
      multiline: true,
      confirmLabel: 'Freeze account',
      tone: 'danger',
    });
    if (reason) {
      this.act('freeze', this.api.freezeUser(d.user.id, reason), 'Account frozen');
    }
  }

  unfreeze(d: AdminUserDetail): void {
    this.act('unfreeze', this.api.unfreezeUser(d.user.id), 'Account unfrozen');
  }

  async revokeSessions(d: AdminUserDetail): Promise<void> {
    const ok = await this.dialogs.confirm({ title: 'Sign this user out everywhere?', body: 'All their devices will need to sign in again.', confirmLabel: 'Sign out everywhere' });
    if (ok) {
      this.act('sessions', this.api.revokeSessions(d.user.id), 'Sessions revoked');
    }
  }

  async resetTwoFactor(d: AdminUserDetail): Promise<void> {
    const reason = await this.dialogs.prompt({
      title: 'Reset two-factor authentication?',
      body: 'Only do this after verifying the user\'s identity through a separate channel. Their withdrawals pause for the security lock period.',
      label: 'Reason and how identity was verified',
      multiline: true,
      confirmLabel: 'Reset two-factor',
      tone: 'danger',
    });
    if (reason) {
      this.act('2fa', this.api.resetTwoFactor(d.user.id, reason), 'Two-factor reset');
    }
  }

  toggleRole(role: string): void {
    this.selectedRoles.update((roles) => (roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]));
  }

  saveRoles(d: AdminUserDetail): void {
    this.act('roles', this.api.setRoles(d.user.id, this.selectedRoles()), 'Roles updated');
  }

  async adjust(d: AdminUserDetail): Promise<void> {
    const amount = this.adjustAmount().trim();
    const asset = this.adjustAsset();
    const ok = await this.dialogs.confirm({
      title: `${amount.startsWith('-') ? 'Debit' : 'Credit'} ${formatAsset(amount.replace('-', ''), asset, { full: true })}?`,
      body: `This changes ${d.user.firstName} ${d.user.lastName}'s ${asset} balance immediately. Reason: ${this.adjustReason().trim()}`,
      confirmLabel: 'Post adjustment',
      tone: amount.startsWith('-') ? 'danger' : 'primary',
    });
    if (!ok) {
      return;
    }

    this.act('adjust', this.api.adjustBalance(d.user.id, asset, amount.replace(/,/g, ''), this.adjustReason().trim()), 'Balance adjusted', () => {
      this.adjustAmount.set('');
      this.adjustReason.set('');
    });
  }

  protected asset(value: string, code: AssetCode): string {
    return formatAsset(value, code, { full: true });
  }

  protected ngn(value: string): string {
    return formatNgn(value);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  protected isFuture(iso: string): boolean {
    return Date.parse(iso) > Date.now();
  }

  private act(kind: string, request: ReturnType<AdminApi['unfreezeUser']>, success: string, after?: () => void): void {
    this.busy.set(kind);
    request.subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.success(success);
        after?.();
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.toast.error(error);
      },
    });
  }
}
