import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'cx-account-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Account</h1>
          <p class="lede">Your profile, sign-in security, identity verification and notifications.</p>
        </div>
      </header>
      <nav class="tabs" aria-label="Account sections">
        <a routerLink="/account" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Profile</a>
        <a routerLink="/account/security" routerLinkActive="is-active" ariaCurrentWhenActive="page">Security</a>
        <a routerLink="/account/verification" routerLinkActive="is-active" ariaCurrentWhenActive="page">Verification</a>
        <a routerLink="/account/notifications" routerLinkActive="is-active" ariaCurrentWhenActive="page">Notifications</a>
      </nav>
      <router-outlet />
    </div>
  `,
})
export class AccountLayout {}
