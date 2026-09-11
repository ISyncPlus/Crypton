import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { saveBlob } from '../../core/files';
import { formatDateTime } from '../../core/format';
import { PASSWORD_HINT, passwordValidator } from '../../core/forms';
import { activityLabel } from '../../core/labels';
import { Activity, Problem, Session, TwoFactorSetup, TwoFactorStatus } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { CopyButton } from '../../ui/copy-button';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { QrCode } from '../../ui/qr-code';

type TfaStep = 'idle' | 'setup' | 'codes';

@Component({
  selector: 'cx-security',
  imports: [CopyButton, Icon, QrCode],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .setup {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--space-5);
      align-items: start;
    }

    .key {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      overflow-wrap: anywhere;
    }

    .codes {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-2) var(--space-5);
      margin: 0;
      padding: var(--space-4);
      border: 1px dashed var(--rule-strong);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
      list-style: none;
    }

    .form {
      display: grid;
      gap: var(--space-4);
      max-width: 28rem;
    }

    .session {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-5);
    }

    .session + .session {
      border-top: 1px solid var(--rule);
    }

    .session span {
      display: grid;
      min-width: 0;
      line-height: 1.35;
    }

    .session small {
      color: var(--ink-3);
    }

    .activity {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-5);
      font-size: var(--text-sm);
    }

    .activity + .activity {
      border-top: 1px solid var(--rule);
    }

    @media (max-width: 640px) {
      .setup {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  template: `
    <div class="stack-lg">
      <section class="panel" aria-labelledby="tfa-title">
        <div class="panel__header">
          <h2 class="panel__title" id="tfa-title">Two-factor authentication</h2>
          @if (status(); as s) {
            <span class="status" [class.status--ok]="s.enabled">{{ s.enabled ? 'On' : 'Off' }}</span>
          }
        </div>
        <div class="panel__body stack">
          @if (tfaProblem(); as p) {
            <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
          }

          @switch (step()) {
            @case ('setup') {
              @if (setup(); as s) {
                <p class="secondary">Scan the QR code with an authenticator app such as Google Authenticator, 1Password or Authy, then enter the 6-digit code it shows.</p>
                <div class="setup">
                  <cx-qr [value]="s.otpAuthUri" label="Authenticator setup QR code" />
                  <div class="stack">
                    <div class="stack-sm">
                      <span class="caption">Can't scan? Enter this key manually</span>
                      <div class="key"><span style="flex: 1">{{ s.sharedKey }}</span><cx-copy [value]="plainKey(s.sharedKey)" what="setup key" /></div>
                    </div>
                    <label class="field">
                      <span class="field__label">Code from the app</span>
                      <input class="input input--code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" [value]="setupCode()" (input)="onSetupCode($event)" />
                    </label>
                    <div class="row">
                      <button type="button" class="btn btn--primary" [disabled]="setupCode().length !== 6 || busy()" [attr.aria-busy]="busy()" (click)="enable()">Turn on</button>
                      <button type="button" class="btn btn--quiet" (click)="step.set('idle')">Cancel</button>
                    </div>
                  </div>
                </div>
              } @else {
                <span class="skeleton" style="height: 10rem"></span>
              }
            }
            @case ('codes') {
              <div class="notice notice--warn">
                <cx-icon name="key" [size]="18" />
                <span>Save these recovery codes somewhere safe, like a password manager. Each works once if you lose your phone. They won't be shown again.</span>
              </div>
              <ol class="codes">
                @for (code of recoveryCodes(); track code) {
                  <li>{{ code }}</li>
                }
              </ol>
              <div class="row">
                <cx-copy [value]="codesText()" what="recovery codes" label="Copy all" />
                <button type="button" class="btn btn--sm" (click)="downloadCodes()"><cx-icon name="download" [size]="16" />Download</button>
                <button type="button" class="btn btn--primary btn--sm" (click)="finishCodes()">I've saved them</button>
              </div>
            }
            @default {
              @if (status(); as s) {
                @if (s.enabled) {
                  <p class="secondary">Sign-ins, withdrawals and P2P releases ask for a code from your authenticator app. You have {{ s.recoveryCodesLeft }} recovery code{{ s.recoveryCodesLeft === 1 ? '' : 's' }} left.</p>
                  @if (s.recoveryCodesLeft <= 3) {
                    <div class="notice notice--warn"><cx-icon name="alert" [size]="18" /><span>You're running low on recovery codes. Replace them so you don't get locked out.</span></div>
                  }
                  <div class="row">
                    <button type="button" class="btn" [attr.aria-busy]="busy()" (click)="regenerate()">Replace recovery codes</button>
                    @if (!auth.isStaff()) {
                      <button type="button" class="btn btn--danger" [disabled]="busy()" (click)="disable()">Turn off</button>
                    }
                  </div>
                } @else {
                  <p class="secondary">Protect your account and withdrawals with a code from your phone. Without it, anyone with your password could move your funds.</p>
                  <button type="button" class="btn btn--primary" style="justify-self: start" [attr.aria-busy]="busy()" (click)="startSetup()">Set up two-factor authentication</button>
                }
              } @else {
                <span class="skeleton" style="height: 4rem"></span>
              }
            }
          }
        </div>
      </section>

      <div class="split">
        <section class="panel" aria-labelledby="password-title">
          <div class="panel__header"><h2 class="panel__title" id="password-title">Change password</h2></div>
          <div class="panel__body form">
            <label class="field">
              <span class="field__label">Current password</span>
              <input class="input" type="password" autocomplete="current-password" [value]="current()" (input)="current.set($any($event.target).value)" />
            </label>
            <label class="field">
              <span class="field__label">New password</span>
              <input class="input" type="password" autocomplete="new-password" [value]="next()" (input)="next.set($any($event.target).value)" [attr.aria-invalid]="!!nextError()" />
              @if (nextError(); as e) {
                <span class="field__error">{{ e }}</span>
              } @else {
                <span class="field__hint">{{ hint }}</span>
              }
            </label>
            <label class="field">
              <span class="field__label">Confirm new password</span>
              <input class="input" type="password" autocomplete="new-password" [value]="confirm()" (input)="confirm.set($any($event.target).value)" [attr.aria-invalid]="!!confirmError()" />
              @if (confirmError(); as e) {
                <span class="field__error">{{ e }}</span>
              }
            </label>
            @if (status()?.enabled) {
              <label class="field">
                <span class="field__label">Authentication code</span>
                <input class="input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" [value]="passwordCode()" (input)="onPasswordCode($event)" />
              </label>
            }
            @if (passwordProblem(); as p) {
              <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
            }
            <p class="caption">Changing your password signs out your other devices and pauses withdrawals for 24 hours.</p>
            <button type="button" class="btn btn--primary" style="justify-self: start" [disabled]="!canChangePassword() || passwordBusy()" [attr.aria-busy]="passwordBusy()" (click)="changePassword()">Update password</button>
          </div>
        </section>

        <section class="panel" aria-labelledby="sessions-title">
          <div class="panel__header"><h2 class="panel__title" id="sessions-title">Signed-in devices</h2></div>
          @for (session of sessions(); track session.id) {
            <div class="session">
              <span>
                <strong>{{ session.device }}</strong>
                <small>{{ session.ipAddress ?? 'Unknown IP' }}, last active {{ when(session.lastUsedAt ?? session.createdAt) }}</small>
              </span>
              @if (session.current) {
                <span class="status status--ok">This device</span>
              } @else {
                <button type="button" class="btn btn--sm" [attr.aria-busy]="revoking() === session.id" (click)="revoke(session)">Sign out</button>
              }
            </div>
          } @empty {
            <div class="panel__body"><span class="skeleton" style="height: 4rem"></span></div>
          }
        </section>
      </div>

      <section class="panel" aria-labelledby="activity-title">
        <div class="panel__header"><h2 class="panel__title" id="activity-title">Recent security activity</h2></div>
        @for (item of activity(); track $index) {
          <div class="activity">
            <span>{{ label(item.action) }}</span>
            <span class="muted">{{ item.ipAddress ? item.ipAddress + ', ' : '' }}{{ when(item.createdAt) }}</span>
          </div>
        } @empty {
          <div class="empty"><strong>No activity yet</strong></div>
        }
      </section>
    </div>
  `,
})
export class Security implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);
  protected readonly auth = inject(AuthService);

  protected readonly hint = PASSWORD_HINT;
  protected readonly status = signal<TwoFactorStatus | null>(null);
  protected readonly step = signal<TfaStep>('idle');
  protected readonly setup = signal<TwoFactorSetup | null>(null);
  protected readonly setupCode = signal('');
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly tfaProblem = signal<Problem | null>(null);

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');
  protected readonly passwordCode = signal('');
  protected readonly passwordBusy = signal(false);
  protected readonly passwordProblem = signal<Problem | null>(null);

  protected readonly sessions = signal<Session[]>([]);
  protected readonly revoking = signal<string | null>(null);
  protected readonly activity = signal<Activity[]>([]);

  protected readonly codesText = computed(() => this.recoveryCodes().join('\n'));
  protected readonly nextError = computed(() => (this.next() && passwordValidator(new FormControl(this.next())) ? PASSWORD_HINT : null));
  protected readonly confirmError = computed(() => (this.confirm() && this.confirm() !== this.next() ? 'The passwords don’t match.' : null));
  protected readonly canChangePassword = computed(
    () => !!this.current() && !!this.next() && !this.nextError() && this.confirm() === this.next() && (!this.status()?.enabled || this.passwordCode().length === 6),
  );

  ngOnInit(): void {
    this.loadStatus();
    this.api.sessions().subscribe({ next: (s) => this.sessions.set(s), error: () => undefined });
    this.api.activity().subscribe({ next: (a) => this.activity.set(a), error: () => undefined });
  }

  startSetup(): void {
    this.busy.set(true);
    this.tfaProblem.set(null);
    this.api.twoFactorSetup().subscribe({
      next: (setup) => {
        this.busy.set(false);
        this.setup.set(setup);
        this.setupCode.set('');
        this.step.set('setup');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.tfaProblem.set(toProblem(error));
      },
    });
  }

  onSetupCode(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    if (input.value !== digits) {
      input.value = digits;
    }

    this.setupCode.set(digits);
    if (digits.length === 6 && !this.busy()) {
      this.enable();
    }
  }

  onPasswordCode(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 6);
    if (input.value !== digits) {
      input.value = digits;
    }

    this.passwordCode.set(digits);
  }

  plainKey(key: string): string {
    return key.replace(/\s+/g, '');
  }

  enable(): void {
    this.busy.set(true);
    this.tfaProblem.set(null);
    this.api.twoFactorEnable(this.setupCode()).subscribe({
      next: ({ recoveryCodes }) => {
        this.busy.set(false);
        this.recoveryCodes.set(recoveryCodes);
        this.step.set('codes');
        this.setup.set(null);
        this.refreshUser();
        this.toast.success('Two-factor authentication is on');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.setupCode.set('');
        this.tfaProblem.set(toProblem(error));
      },
    });
  }

  async regenerate(): Promise<void> {
    const code = await this.dialogs.twoFactorCode({ title: 'Replace recovery codes', body: 'Your old recovery codes stop working. Enter a code from your authenticator app to continue.', confirmLabel: 'Replace codes' });
    if (!code) {
      return;
    }

    this.busy.set(true);
    this.tfaProblem.set(null);
    this.api.regenerateRecoveryCodes(code).subscribe({
      next: ({ recoveryCodes }) => {
        this.busy.set(false);
        this.recoveryCodes.set(recoveryCodes);
        this.step.set('codes');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.tfaProblem.set(toProblem(error));
      },
    });
  }

  async disable(): Promise<void> {
    const password = await this.dialogs.prompt({
      title: 'Turn off two-factor authentication?',
      body: 'Withdrawals pause for 24 hours afterwards, and your account becomes easier to take over. Enter your password to continue.',
      label: 'Password',
      confirmLabel: 'Continue',
      tone: 'danger',
    });
    if (!password) {
      return;
    }

    const code = await this.dialogs.twoFactorCode({ title: 'Confirm with your authenticator', confirmLabel: 'Turn off' });
    if (!code) {
      return;
    }

    this.busy.set(true);
    this.tfaProblem.set(null);
    this.api.twoFactorDisable(password, code).subscribe({
      next: () => {
        this.busy.set(false);
        this.loadStatus();
        this.refreshUser();
        this.toast.success('Two-factor authentication is off');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.tfaProblem.set(toProblem(error));
      },
    });
  }

  finishCodes(): void {
    this.recoveryCodes.set([]);
    this.step.set('idle');
    this.loadStatus();
  }

  downloadCodes(): void {
    saveBlob(new Blob([`Crypton recovery codes\n\n${this.recoveryCodes().join('\n')}\n`], { type: 'text/plain' }), 'crypton-recovery-codes.txt');
  }

  changePassword(): void {
    if (!this.canChangePassword()) {
      return;
    }

    this.passwordBusy.set(true);
    this.passwordProblem.set(null);
    this.api.changePassword(this.current(), this.next(), this.status()?.enabled ? this.passwordCode() : undefined).subscribe({
      next: () => {
        this.passwordBusy.set(false);
        this.current.set('');
        this.next.set('');
        this.confirm.set('');
        this.passwordCode.set('');
        this.refreshUser();
        this.api.sessions().subscribe({ next: (s) => this.sessions.set(s), error: () => undefined });
        this.toast.success('Password updated', 'Your other devices were signed out.');
      },
      error: (error: unknown) => {
        this.passwordBusy.set(false);
        this.passwordProblem.set(toProblem(error));
      },
    });
  }

  async revoke(session: Session): Promise<void> {
    const ok = await this.dialogs.confirm({ title: 'Sign out this device?', body: `${session.device} will need to sign in again.`, confirmLabel: 'Sign out device' });
    if (!ok) {
      return;
    }

    this.revoking.set(session.id);
    this.api.revokeSession(session.id).subscribe({
      next: () => {
        this.revoking.set(null);
        this.sessions.update((list) => list.filter((s) => s.id !== session.id));
        this.toast.success('Device signed out');
      },
      error: (error: unknown) => {
        this.revoking.set(null);
        this.toast.error(error);
      },
    });
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected label(action: string): string {
    return activityLabel(action);
  }

  private loadStatus(): void {
    this.api.twoFactorStatus().subscribe({ next: (s) => this.status.set(s), error: (e: unknown) => this.tfaProblem.set(toProblem(e)) });
  }

  private refreshUser(): void {
    this.api.me().subscribe({ next: (me) => this.auth.setUser(me.user), error: () => undefined });
  }
}
