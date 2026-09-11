import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Logo } from '../ui/logo';

@Component({
  selector: 'cx-not-found',
  imports: [RouterLink, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: var(--space-5);
    }

    .box {
      display: grid;
      justify-items: start;
      gap: var(--space-4);
      max-width: 28rem;
    }

    h1 {
      font-size: var(--text-3xl);
      font-stretch: 120%;
      font-weight: 650;
      letter-spacing: -0.03em;
    }
  `,
  template: `
    <div class="box">
      <cx-logo />
      <h1>Page not found</h1>
      <p class="secondary">The link may be old or mistyped. Nothing has happened to your account or balances.</p>
      <a class="btn btn--primary" [routerLink]="auth.isAuthenticated() ? auth.homeFor() : '/auth/sign-in'">
        {{ auth.isAuthenticated() ? 'Go to overview' : 'Sign in' }}
      </a>
    </div>
  `,
})
export class NotFound {
  protected readonly auth = inject(AuthService);
}
