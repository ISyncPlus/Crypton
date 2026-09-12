import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { controlError } from '../../core/forms';
import { safeReturnUrl } from '../../core/guards';
import { AuthResponse, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../ui/icon';
import { authStyles } from './auth-styles';

@Component({
  selector: 'cx-sign-in',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [authStyles],
  template: `
    @if (step() === 'credentials') {
      <div class="head">
        <h1>Sign in</h1>
        <p>Welcome back. Enter your email and password.</p>
      </div>

      @if (reason() === 'expired' && !problem()) {
        <div class="notice" role="status">
          <cx-icon name="clock" [size]="18" />
          <span>Your session ended. Sign in again to continue.</span>
        </div>
      }

      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert">
          <cx-icon name="alert" [size]="18" />
          <div class="notice__body">
            <span>{{ p.title }}</span>
            @if (p.code === 'email_not_confirmed') {
              <button type="button" class="link" [disabled]="resending()" (click)="resend()">Resend confirmation email</button>
            }
          </div>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label class="field">
          <span class="field__label">Email</span>
          <input class="input" type="email" formControlName="email" autocomplete="username" [attr.aria-invalid]="!!error('email')" />
          @if (error('email'); as e) {
            <span class="field__error">{{ e }}</span>
          }
        </label>

        <div class="field">
          <label class="field__label" for="password">
            <span>Password</span>
            <a class="inline-link field__aside" routerLink="/auth/forgot-password">Forgot password?</a>
          </label>
          <div class="password">
            <input
              id="password"
              class="input"
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="current-password"
              [attr.aria-invalid]="!!error('password')"
            />
            <button type="button" class="btn btn--quiet btn--icon btn--sm" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showPassword()">
              <cx-icon name="eye" [size]="16" />
            </button>
          </div>
          @if (error('password'); as e) {
            <span class="field__error">{{ e }}</span>
          }
        </div>

        <button type="submit" class="btn btn--primary btn--lg btn--block" [attr.aria-busy]="busy()">Sign in</button>
      </form>

      <p class="foot">New to Crypton? <a routerLink="/auth/sign-up">Create an account</a></p>
    } @else {
      <div class="head">
        <h1>Two-factor check</h1>
        @if (useRecovery()) {
          <p>Enter one of the recovery codes you saved when you turned on two-factor authentication. Each code works once.</p>
        } @else {
          <p>Open your authenticator app and enter the 6-digit code for Crypton.</p>
        }
      </div>

      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert">
          <cx-icon name="alert" [size]="18" />
          <span>{{ p.title }}</span>
        </div>
      }

      <form (submit)="$event.preventDefault(); submitCode()" novalidate>
        @if (useRecovery()) {
          <label class="field">
            <span class="field__label">Recovery code</span>
            <input class="input" [formControl]="recoveryCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXXX" />
          </label>
        } @else {
          <label class="field">
            <span class="field__label">Authentication code</span>
            <input class="input input--code" [formControl]="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" (input)="onCodeInput()" />
          </label>
        }
        <button type="submit" class="btn btn--primary btn--lg btn--block" [attr.aria-busy]="busy()">Verify and sign in</button>
      </form>

      <div class="row-between">
        <button type="button" class="link" (click)="toggleRecovery()">{{ useRecovery() ? 'Use authenticator code' : 'Use a recovery code' }}</button>
        <button type="button" class="link" (click)="backToCredentials()">Start again</button>
      </div>
    }
  `,
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  protected readonly step = signal<'credentials' | 'twoFactor'>('credentials');
  protected readonly busy = signal(false);
  protected readonly resending = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly useRecovery = signal(false);
  private challengeToken = '';

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly code = inject(FormBuilder).nonNullable.control('');
  protected readonly recoveryCode = inject(FormBuilder).nonNullable.control('');

  protected error(name: 'email' | 'password'): string | null {
    return controlError(this.form.controls[name]);
  }

  protected readonly target = computed(() => safeReturnUrl(this.returnUrl()));

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.problem.set(null);
    this.auth.login(email.trim(), password).subscribe({
      next: (response) => {
        this.busy.set(false);
        if (response.requiresTwoFactor && response.challengeToken) {
          this.challengeToken = response.challengeToken;
          this.step.set('twoFactor');
          return;
        }

        this.finish(response);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.problem.set(toProblem(error));
      },
    });
  }

  onCodeInput(): void {
    const digits = this.code.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== this.code.value) {
      this.code.setValue(digits);
    }

    if (digits.length === 6 && !this.busy()) {
      this.submitCode();
    }
  }

  submitCode(): void {
    if (this.busy()) {
      return;
    }

    const recovery = this.useRecovery() ? this.recoveryCode.value.replace(/\s/g, '').toUpperCase() : '';
    const code = this.useRecovery() ? '' : this.code.value.replace(/\D/g, '');
    if (this.useRecovery() ? !recovery : code.length !== 6) {
      this.problem.set({ status: 0, code: 'validation_error', title: this.useRecovery() ? 'Enter a recovery code.' : 'Enter all 6 digits.' });
      return;
    }

    this.busy.set(true);
    this.problem.set(null);
    this.auth.completeTwoFactor(this.challengeToken, code || undefined, recovery || undefined).subscribe({
      next: (response) => {
        this.busy.set(false);
        this.finish(response);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const problem = toProblem(error);
        this.problem.set(problem);
        this.code.setValue('');
        if (problem.code === 'invalid_token') {
          this.backToCredentials(problem);
        }
      },
    });
  }

  toggleRecovery(): void {
    this.useRecovery.set(!this.useRecovery());
    this.problem.set(null);
  }

  backToCredentials(problem: Problem | null = null): void {
    this.step.set('credentials');
    this.challengeToken = '';
    this.code.setValue('');
    this.recoveryCode.setValue('');
    this.useRecovery.set(false);
    this.form.controls.password.setValue('');
    this.problem.set(problem);
  }

  resend(): void {
    const email = this.form.controls.email.value.trim();
    if (!email) {
      return;
    }

    this.resending.set(true);
    this.api.resendConfirmation(email).subscribe({
      next: () => {
        this.resending.set(false);
        this.problem.set(null);
        this.toast.success('Confirmation email sent', 'Check your inbox for a new link.');
      },
      error: (error: unknown) => {
        this.resending.set(false);
        this.toast.error(error);
      },
    });
  }

  private finish(response: AuthResponse): void {
    if (!response.user) {
      return;
    }

    void this.router.navigateByUrl(this.target() ?? this.auth.homeFor(response.user));
  }
}
