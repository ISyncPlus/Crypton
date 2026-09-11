import { CdkMenu, CdkMenuItem, CdkMenuItemRadio, CdkMenuGroup, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { initials } from '../core/format';
import { ThemeMode, ThemeService } from '../core/theme.service';
import { Icon, IconName } from '../ui/icon';

@Component({
  selector: 'cx-user-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuItemRadio, CdkMenuGroup, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .avatar {
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      padding: 0;
      border: 1px solid var(--rule-strong);
      border-radius: 50%;
      background: var(--surface);
      color: var(--ink);
      font-size: var(--text-sm);
      font-stretch: 110%;
      font-weight: 650;
      cursor: pointer;
    }

    .avatar:hover {
      border-color: var(--ink-3);
    }

    .who {
      display: grid;
      padding: var(--space-2) var(--space-3) var(--space-3);
      line-height: 1.3;
    }

    .who span {
      overflow: hidden;
      color: var(--ink-3);
      font-size: var(--text-sm);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  template: `
    <button
      type="button"
      class="avatar"
      [cdkMenuTriggerFor]="menu"
      [cdkMenuPosition]="[{ originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 }]"
      aria-label="Account menu"
    >
      {{ letters() }}
    </button>

    <ng-template #menu>
      <div class="menu" cdkMenu>
        <div class="who">
          <strong>{{ name() }}</strong>
          <span>{{ auth.user()?.email }}</span>
        </div>
        <div class="menu__rule"></div>
        <a class="menu__item" cdkMenuItem routerLink="/account"><cx-icon name="user" [size]="16" />Profile</a>
        <a class="menu__item" cdkMenuItem routerLink="/account/security"><cx-icon name="lock" [size]="16" />Security</a>
        <a class="menu__item" cdkMenuItem routerLink="/account/verification"><cx-icon name="id" [size]="16" />Verification</a>
        @if (auth.isStaff()) {
          <a class="menu__item" cdkMenuItem [routerLink]="inAdmin() ? '/dashboard' : '/admin'">
            <cx-icon [name]="inAdmin() ? 'wallet' : 'shield'" [size]="16" />{{ inAdmin() ? 'Open the exchange' : 'Open back office' }}
          </a>
        }
        <div class="menu__rule"></div>
        <div class="menu__label">Appearance</div>
        <div cdkMenuGroup>
          @for (option of themes; track option.mode) {
            <button type="button" class="menu__item" cdkMenuItemRadio [cdkMenuItemChecked]="theme.mode() === option.mode" (cdkMenuItemTriggered)="theme.mode.set(option.mode)">
              <cx-icon [name]="option.icon" [size]="16" />{{ option.label }}
              @if (theme.mode() === option.mode) {
                <cx-icon name="check" [size]="16" />
              }
            </button>
          }
        </div>
        <div class="menu__rule"></div>
        <button type="button" class="menu__item" cdkMenuItem (cdkMenuItemTriggered)="signOut()"><cx-icon name="logout" [size]="16" />Sign out</button>
      </div>
    </ng-template>
  `,
})
export class UserMenu {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  protected readonly themes: { mode: ThemeMode; label: string; icon: IconName }[] = [
    { mode: 'system', label: 'Match device', icon: 'monitor' },
    { mode: 'light', label: 'Light', icon: 'sun' },
    { mode: 'dark', label: 'Dark', icon: 'moon' },
  ];

  protected readonly letters = computed(() => initials(this.auth.user()?.firstName, this.auth.user()?.lastName));
  protected readonly name = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName} ${user.lastName}` : '';
  });

  readonly inAdmin = input(false);

  signOut(): void {
    this.auth.logout().subscribe();
  }
}
