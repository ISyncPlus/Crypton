import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { PASSWORD_HINT, applyProblem, controlError, passwordValidator } from '../../core/forms';
import { Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { Icon } from '../../ui/icon';
import { authStyles } from './auth-styles';

type Field = 'firstName' | 'lastName' | 'email' | 'password';

@Component({
  selector: 'cx-sign-up',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [authStyles],
  template: `
    <div class="head">
      <h1>Create your account</h1>
      <p>Use your legal name. It has to match your ID when you verify later.</p>
    </div>

    @if (problem(); as p) {
      <div class="notice notice--bad" role="alert">
        <cx-icon name="alert" [size]="18" />
        <span>{{ p.title }}</span>
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="names">
        <label class="field">
          <span class="field__label">First name</span>
          <input class="input" formControlName="firstName" autocomplete="given-name" [attr.aria-invalid]="!!error('firstName')" />
          @if (error('firstName'); as e) {
            <span class="field__error">{{ e }}</span>
          }
        </label>
        <label class="field">
          <span class="field__label">Last name</span>
          <input class="input" formControlName="lastName" autocomplete="family-name" [attr.aria-invalid]="!!error('lastName')" />
          @if (error('lastName'); as e) {
            <span class="field__error">{{ e }}</span>
          }
        </label>
      </div>

      <label class="field">
        <span class="field__label">Email</span>
        <input class="input" type="email" formControlName="email" autocomplete="email" [attr.aria-invalid]="!!error('email')" />
        @if (error('email'); as e) {
          <span class="field__error">{{ e }}</span>
        }
      </label>

      <div class="field">
        <label class="field__label" for="new-password">Password</label>
        <div class="password">
          <input
            id="new-password"
            class="input"
            [type]="showPassword() ? 'text' : 'password'"
            formControlName="password"
            autocomplete="new-password"
            aria-describedby="password-hint"
            [attr.aria-invalid]="!!error('password')"
          />
          <button type="button" class="btn btn--quiet btn--icon btn--sm" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showPassword()">
            <cx-icon name="eye" [size]="16" />
          </button>
        </div>
        @if (error('password'); as e) {
          <span class="field__error" id="password-hint">{{ e }}</span>
        } @else {
          <span class="field__hint" id="password-hint">{{ hint }}</span>
        }
      </div>

      <button type="submit" class="btn btn--primary btn--lg btn--block" [attr.aria-busy]="busy()">Create account</button>
    </form>

    <p class="foot">Already have an account? <a routerLink="/auth/sign-in">Sign in</a></p>
  `,
})
export class SignUp {
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly hint = PASSWORD_HINT;
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    password: ['', [Validators.required, Validators.maxLength(128), passwordValidator]],
  });

  protected error(name: Field): string | null {
    return controlError(this.form.controls[name]);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }

    const value = this.form.getRawValue();
    const body = { firstName: value.firstName.trim(), lastName: value.lastName.trim(), email: value.email.trim(), password: value.password };
    this.busy.set(true);
    this.problem.set(null);
    this.api.register(body).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/auth/check-email'], { state: { email: body.email } });
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const problem = toProblem(error);
        if (problem.code === 'weak_password') {
          this.form.controls.password.setErrors({ server: problem.title });
          return;
        }

        if (!applyProblem(this.form, problem)) {
          this.problem.set(problem);
        }
      },
    });
  }
}
