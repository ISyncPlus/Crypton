import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { PASSWORD_HINT, controlError, defaultMessage, passwordValidator } from '../../core/forms';
import { Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { Icon } from '../../ui/icon';
import { authStyles } from './auth-styles';

function matchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm');
  if (confirm && confirm.value && password !== confirm.value) {
    confirm.setErrors({ ...(confirm.errors ?? {}), mismatch: true });
  } else if (confirm?.hasError('mismatch')) {
    const { mismatch: _removed, ...rest } = confirm.errors ?? {};
    confirm.setErrors(Object.keys(rest).length ? rest : null);
  }

  return null;
}

@Component({
  selector: 'cx-reset-password',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [authStyles],
  template: `
    @if (!done()) {
      <div class="head">
        <h1>Choose a new password</h1>
        <p>You'll be signed out on every device. Withdrawals pause for a short time after a reset.</p>
      </div>

      @if (!userId() || !token()) {
        <div class="notice notice--bad" role="alert">
          <cx-icon name="alert" [size]="18" />
          <div class="notice__body">
            <span>This reset link is incomplete. Open the link from your email again, or request a new one.</span>
            <a class="inline-link" routerLink="/auth/forgot-password">Request a new link</a>
          </div>
        </div>
      } @else {
        @if (problem(); as p) {
          <div class="notice notice--bad" role="alert">
            <cx-icon name="alert" [size]="18" />
            <div class="notice__body">
              <span>{{ p.title }}</span>
              @if (p.code === 'invalid_token') {
                <a class="inline-link" routerLink="/auth/forgot-password">Request a new link</a>
              }
            </div>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <label class="field">
            <span class="field__label">New password</span>
            <input class="input" type="password" formControlName="password" autocomplete="new-password" [attr.aria-invalid]="!!error('password')" />
            @if (error('password'); as e) {
              <span class="field__error">{{ e }}</span>
            } @else {
              <span class="field__hint">{{ hint }}</span>
            }
          </label>
          <label class="field">
            <span class="field__label">Confirm new password</span>
            <input class="input" type="password" formControlName="confirm" autocomplete="new-password" [attr.aria-invalid]="!!error('confirm')" />
            @if (error('confirm'); as e) {
              <span class="field__error">{{ e }}</span>
            }
          </label>
          <button type="submit" class="btn btn--primary btn--lg btn--block" [attr.aria-busy]="busy()">Save new password</button>
        </form>
      }
    } @else {
      <div class="result">
        <span class="result__icon"><cx-icon name="check" [size]="22" /></span>
        <div class="head">
          <h1>Password updated</h1>
          <p>Sign in with your new password.</p>
        </div>
        <a class="btn btn--primary btn--lg" routerLink="/auth/sign-in">Sign in</a>
      </div>
    }
  `,
})
export class ResetPassword {
  private readonly api = inject(Api);
  readonly userId = input<string>();
  readonly token = input<string>();

  protected readonly hint = PASSWORD_HINT;
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      password: ['', [Validators.required, Validators.maxLength(128), passwordValidator]],
      confirm: ['', [Validators.required]],
    },
    { validators: matchValidator },
  );

  protected error(name: 'password' | 'confirm'): string | null {
    return controlError(this.form.controls[name], (key, value) => (key === 'mismatch' ? 'The passwords don’t match.' : defaultMessage(key, value)));
  }

  submit(): void {
    this.form.markAllAsTouched();
    const userId = this.userId();
    const token = this.token();
    if (this.form.invalid || this.busy() || !userId || !token) {
      return;
    }

    this.busy.set(true);
    this.problem.set(null);
    this.api.resetPassword(userId, token, this.form.controls.password.value).subscribe({
      next: () => {
        this.busy.set(false);
        this.done.set(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.problem.set(toProblem(error));
      },
    });
  }
}
