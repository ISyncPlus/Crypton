import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../ui/icon';
import { authStyles } from './auth-styles';

@Component({
  selector: 'cx-check-email',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [authStyles],
  template: `
    <div class="result">
      <span class="result__icon is-info"><cx-icon name="mail" [size]="22" /></span>
      <div class="head">
        <h1>Check your email</h1>
        @if (email) {
          <p>We sent a confirmation link to <strong>{{ email }}</strong>. Open it on this device to activate your account.</p>
        } @else {
          <p>We sent you a confirmation link. Open it to activate your account.</p>
        }
      </div>
      <p class="secondary">The link expires after a while. Didn't get it? Check spam, or send a new one.</p>
      <div class="row">
        @if (email) {
          <button type="button" class="btn" [attr.aria-busy]="busy()" [disabled]="cooldown()" (click)="resend()">
            {{ cooldown() ? 'Link sent' : 'Send a new link' }}
          </button>
        }
        <a class="btn btn--quiet" routerLink="/auth/sign-in">Back to sign in</a>
      </div>
    </div>
  `,
})
export class CheckEmail {
  private readonly api = inject(Api);
  private readonly toast = inject(ToastService);
  protected readonly email: string | null = typeof history !== 'undefined' ? ((history.state as { email?: string } | null)?.email ?? null) : null;
  protected readonly busy = signal(false);
  protected readonly cooldown = signal(false);

  resend(): void {
    if (!this.email) {
      return;
    }

    this.busy.set(true);
    this.api.resendConfirmation(this.email).subscribe({
      next: () => {
        this.busy.set(false);
        this.cooldown.set(true);
        this.toast.success('New link sent');
        setTimeout(() => this.cooldown.set(false), 30_000);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.toast.error(error);
      },
    });
  }
}
