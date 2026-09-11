import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { formatDate } from '../../core/format';
import { Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'cx-profile',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .form {
      display: grid;
      gap: var(--space-4);
      max-width: 34rem;
    }

    .names {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }

    @media (max-width: 560px) {
      .names {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    @if (auth.user(); as user) {
      <div class="split">
        <section class="panel" aria-labelledby="profile-title">
          <div class="panel__header"><h2 class="panel__title" id="profile-title">Profile</h2></div>
          <div class="panel__body form">
            <div class="names">
              <label class="field">
                <span class="field__label">First name</span>
                <input class="input" [value]="firstName()" (input)="firstName.set($any($event.target).value)" [disabled]="locked()" autocomplete="given-name" maxlength="100" />
              </label>
              <label class="field">
                <span class="field__label">Last name</span>
                <input class="input" [value]="lastName()" (input)="lastName.set($any($event.target).value)" [disabled]="locked()" autocomplete="family-name" maxlength="100" />
              </label>
            </div>
            @if (locked()) {
              <p class="caption">Your name is locked after identity verification. Contact support if it needs correcting.</p>
            }

            <label class="field">
              <span class="field__label">Display name</span>
              <input class="input" [value]="displayName()" (input)="displayName.set($any($event.target).value)" autocomplete="nickname" maxlength="24" [attr.aria-invalid]="!!displayError()" placeholder="e.g. ada_trades" />
              @if (displayError(); as e) {
                <span class="field__error">{{ e }}</span>
              } @else {
                <span class="field__hint">Shown to other traders on P2P. 3 to 24 letters, numbers or underscores.</span>
              }
            </label>

            <label class="field">
              <span class="field__label">Email</span>
              <input class="input" [value]="user.email" readonly />
            </label>

            @if (problem(); as p) {
              <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
            }

            <div class="row">
              <button type="button" class="btn btn--primary" [disabled]="!dirty() || !!displayError() || saving()" [attr.aria-busy]="saving()" (click)="save()">Save changes</button>
            </div>
          </div>
        </section>

        <aside class="panel" aria-labelledby="summary-title">
          <div class="panel__header"><h2 class="panel__title" id="summary-title">Account</h2></div>
          <div class="panel__body">
            <div class="kv">
              <div class="kv__row"><span class="kv__key">Member since</span><span class="kv__value">{{ date(user.createdAt) }}</span></div>
              <div class="kv__row">
                <span class="kv__key">Verification</span>
                <span class="kv__value"><a class="link" routerLink="/account/verification">{{ tierName(user.kycTier) }}</a></span>
              </div>
              <div class="kv__row">
                <span class="kv__key">Two-factor</span>
                <span class="kv__value"><a class="link" routerLink="/account/security">{{ user.twoFactorEnabled ? 'On' : 'Off' }}</a></span>
              </div>
              <div class="kv__row"><span class="kv__key">Status</span><span class="kv__value">{{ user.status }}</span></div>
              @if (user.roles.length) {
                <div class="kv__row"><span class="kv__key">Staff roles</span><span class="kv__value">{{ user.roles.join(', ') }}</span></div>
              }
            </div>
          </div>
        </aside>
      </div>
    }
  `,
})
export class Profile implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly displayName = signal('');
  protected readonly saving = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  protected readonly locked = computed(() => (this.auth.user()?.kycTier ?? 0) >= 1);
  protected readonly displayError = computed(() => {
    const value = this.displayName().trim();
    return value && !/^[a-zA-Z0-9_]{3,24}$/.test(value) ? 'Use 3 to 24 letters, numbers or underscores.' : null;
  });
  protected readonly dirty = computed(() => {
    const user = this.auth.user();
    if (!user) {
      return false;
    }

    return (
      this.displayName().trim() !== (user.displayName ?? '') ||
      (!this.locked() && (this.firstName().trim() !== user.firstName || this.lastName().trim() !== user.lastName))
    );
  });

  ngOnInit(): void {
    this.fill();
    this.api.me().subscribe({
      next: (me) => {
        this.auth.setUser(me.user);
        this.fill();
      },
      error: () => undefined,
    });
  }

  save(): void {
    const user = this.auth.user();
    if (!user || !this.dirty()) {
      return;
    }

    const body: { firstName?: string; lastName?: string; displayName?: string } = {};
    if (this.displayName().trim() !== (user.displayName ?? '') && this.displayName().trim()) {
      body.displayName = this.displayName().trim();
    }

    if (!this.locked()) {
      if (this.firstName().trim() !== user.firstName) {
        body.firstName = this.firstName().trim();
      }

      if (this.lastName().trim() !== user.lastName) {
        body.lastName = this.lastName().trim();
      }
    }

    this.saving.set(true);
    this.problem.set(null);
    this.api.updateProfile(body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.auth.setUser(updated);
        this.fill();
        this.toast.success('Profile saved');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.problem.set(toProblem(error));
      },
    });
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  protected tierName(tier: number): string {
    return tier >= 2 ? 'Advanced' : tier === 1 ? 'Verified' : 'Not verified';
  }

  private fill(): void {
    const user = this.auth.user();
    if (user) {
      this.firstName.set(user.firstName);
      this.lastName.set(user.lastName);
      this.displayName.set(user.displayName ?? '');
    }
  }
}
