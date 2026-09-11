import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { formatDate, formatDateTime } from '../../core/format';
import { UserStatus } from '../../core/models';
import { Icon } from '../../ui/icon';
import { Pager } from '../../ui/pager';
import { Status } from '../../ui/status';
import { adminTableStyles, pagedList } from './admin-shared';

@Component({
  selector: 'cx-admin-users',
  imports: [RouterLink, Icon, Pager, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [adminTableStyles],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Users</h1>
          <p class="lede">Search by email, name or display name.</p>
        </div>
      </header>

      <div class="filters">
        <label class="sr-only" for="user-search">Search users</label>
        <input id="user-search" class="input" type="search" placeholder="Search" [value]="query()" (input)="onSearch($any($event.target).value)" style="min-width: 18rem" />
        <select class="select" aria-label="Status" [value]="status()" (change)="setStatus($any($event.target).value)">
          <option value="">Any status</option>
          <option value="Active">Active</option>
          <option value="Frozen">Frozen</option>
          <option value="Closed">Closed</option>
        </select>
        <select class="select" aria-label="Verification level" [value]="tier()" (change)="setTier($any($event.target).value)">
          <option value="">Any level</option>
          <option value="0">Unverified</option>
          <option value="1">Verified</option>
          <option value="2">Advanced</option>
        </select>
      </div>

      <section class="panel" aria-label="Users">
        @if (list.error(); as p) {
          <div class="panel__body"><div class="notice notice--bad"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div></div>
        }
        @if (list.data(); as page) {
          <div class="table-wrap frame" [class.is-loading]="list.loading()">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Level</th>
                  <th scope="col">Status</th>
                  <th scope="col">Two-factor</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                @for (user of page.items; track user.id) {
                  <tr class="is-link" (click)="open(user.id)">
                    <td>
                      <a class="user-link" [routerLink]="['/admin/users', user.id]" (click)="$event.stopPropagation()">{{ user.fullName }}</a>
                      <div class="sub">{{ user.email }}{{ user.displayName ? ', @' + user.displayName : '' }}{{ user.emailConfirmed ? '' : ', email unconfirmed' }}</div>
                    </td>
                    <td>{{ tierName(user.kycTier) }}</td>
                    <td><cx-status kind="user" [status]="user.status" /></td>
                    <td>{{ user.twoFactorEnabled ? 'On' : 'Off' }}</td>
                    <td class="muted">{{ date(user.createdAt) }}</td>
                    <td class="muted">{{ user.lastLoginAt ? when(user.lastLoginAt) : 'Never' }}</td>
                  </tr>
                } @empty {
                  <tr><td colspan="6"><div class="empty"><strong>No users match</strong></div></td></tr>
                }
              </tbody>
            </table>
          </div>
          <cx-pager [page]="page.page" [pageSize]="page.pageSize" [totalCount]="page.totalCount" [totalPages]="page.totalPages" (pageChange)="list.page.set($event)" />
        } @else {
          <div class="panel__body"><span class="skeleton" style="height: 12rem"></span></div>
        }
      </section>
    </div>
  `,
})
export class AdminUsers {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);

  protected readonly query = signal('');
  private readonly debounced = signal('');
  protected readonly status = signal<UserStatus | ''>('');
  protected readonly tier = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected readonly list = pagedList(
    (params) => this.api.users(params),
    () => ({ q: this.debounced(), status: this.status(), tier: this.tier() }),
  );

  onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.debounced.set(value.trim());
      this.list.page.set(1);
    }, 300);
  }

  setStatus(value: UserStatus | ''): void {
    this.status.set(value);
    this.list.page.set(1);
  }

  setTier(value: string): void {
    this.tier.set(value);
    this.list.page.set(1);
  }

  open(id: string): void {
    void this.router.navigate(['/admin/users', id]);
  }

  protected tierName(tier: number): string {
    return tier >= 2 ? 'Advanced' : tier === 1 ? 'Verified' : 'Unverified';
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
