import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { controlError } from '../../core/forms';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../ui/icon';
import { authStyles } from './auth-styles';

@Component({
  selector: 'cx-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [authStyles],
  template: `
    @if (!sent()) {
      <div class="head">
        <h1>Reset your password</h1>
        <p>Enter the email on your account and we'll send a reset link.</p>
      </div>
      <form (ngSubmit)="submit()" novalidate>
        <label class="field">
          <span class="field__label">Email</span>
          <input class="input" type="email" [formControl]="email" autocomplete="email" [attr.aria-invalid]="!!error()" />
          @if (error(); as e) {
            <span class="field__error">{{ e }}</span>
          }
        </label>
        <button type="submit" class="btn btn--primary btn--lg btn--block" [attr.aria-busy]="busy()">Send reset link</button>
      </form>
      <p class="foot"><a routerLink="/auth/sign-in">Back to sign in</a></p>
    } @else {
      <div class="result">
        <span class="result__icon is-info"><cx-icon name="mail" [size]="22" /></span>
        <div class="head">
          <h1>Check your email</h1>
          <p>If an account uses <strong>{{ email.value }}</strong>, a reset link is on its way.</p>
        </div>
        <p class="secondary">For your security, withdrawals pause for a short time after a password reset.</p>
        <a class="btn" routerLink="/auth/sign-in">Back to sign in</a>
      </div>
    }
  `,
})
export class ForgotPassword {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  protected readonly email = inject(FormBuilder).nonNullable.control('', [Validators.required, Validators.email]);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);

  protected error(): string | null {
    return controlError(this.email);
  }

  submit(): void {
    this.email.markAsTouched();
    if (this.email.invalid || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.api.forgotPassword(this.email.value.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toast.error(error);
      },
    });
  }
}
