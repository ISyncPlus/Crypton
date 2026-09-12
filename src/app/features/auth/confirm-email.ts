import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../ui/icon';
import { authStyles } from './auth-styles';

@Component({
  selector: 'cx-confirm-email',
  imports: [RouterLink, Icon, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [authStyles],
  template: `
    @switch (state()) {
      @case ('working') {
        <div class="head">
          <h1>Confirming your email</h1>
          <p>One moment.</p>
        </div>
        <span class="skeleton" style="height: 2.75rem"></span>
      }
      @case ('done') {
        <div class="result">
          <span class="result__icon"><cx-icon name="check" [size]="22" /></span>
          <div class="head">
            <h1>Email confirmed</h1>
            <p>Your account is ready.</p>
          </div>
          <a class="btn btn--primary btn--lg" [routerLink]="auth.isAuthenticated() ? auth.homeFor() : '/auth/sign-in'">
            {{ auth.isAuthenticated() ? 'Continue' : 'Sign in' }}
          </a>
        </div>
      }
      @case ('failed') {
        <div class="result">
          <span class="result__icon is-bad"><cx-icon name="alert" [size]="22" /></span>
          <div class="head">
            <h1>This link didn't work</h1>
            <p>{{ message() }}</p>
          </div>
        </div>
        <form (submit)="$event.preventDefault(); resend()" novalidate>
          <label class="field">
            <span class="field__label">Email</span>
            <input class="input" type="email" [formControl]="email" autocomplete="email" />
          </label>
          <button type="submit" class="btn btn--primary btn--block" [attr.aria-busy]="busy()">Send a new link</button>
        </form>
        <p class="foot"><a routerLink="/auth/sign-in">Back to sign in</a></p>
      }
    }
  `,
})
export class ConfirmEmail implements OnInit {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly userId = input<string>();
  readonly token = input<string>();

  protected readonly state = signal<'working' | 'done' | 'failed'>('working');
  protected readonly message = signal('This link is invalid or has expired. Request a new one.');
  protected readonly busy = signal(false);
  protected readonly email = inject(FormBuilder).nonNullable.control('', [Validators.required, Validators.email]);

  ngOnInit(): void {
    const userId = this.userId();
    const token = this.token();
    if (!userId || !token) {
      this.state.set('failed');
      return;
    }

    this.api.confirmEmail(userId, token).subscribe({
      next: () => this.state.set('done'),
      error: (error: unknown) => {
        this.message.set(toProblem(error).title);
        this.state.set('failed');
      },
    });
  }

  resend(): void {
    if (this.email.invalid) {
      this.email.markAsTouched();
      this.toast.warning('Enter the email you signed up with.');
      return;
    }

    this.busy.set(true);
    this.api.resendConfirmation(this.email.value.trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('If that account needs confirming, a new link is on its way.');
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toast.error(error);
      },
    });
  }
}
