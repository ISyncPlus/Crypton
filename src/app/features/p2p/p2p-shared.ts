import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trader } from '../../core/models';
import { Icon } from '../../ui/icon';

/** completionRate30d is a 0..1 fraction; traders with no finished orders report 1. */
export function completionText(trader: Trader): string {
  if (trader.completedOrders30d === 0) {
    return 'No completed orders in 30 days';
  }

  const percent = Math.round(Number(trader.completionRate30d) * 100);
  return `${trader.completedOrders30d} order${trader.completedOrders30d === 1 ? '' : 's'} in 30 days, ${percent}% completed`;
}

export function releaseText(trader: Trader): string | null {
  const minutes = trader.averageReleaseMinutes;
  if (minutes === null || minutes === undefined) {
    return null;
  }

  return minutes < 1 ? 'Releases in under a minute' : `Releases in about ${Math.round(minutes)} min`;
}

@Component({
  selector: 'cx-trader-badge',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }

    .avatar {
      display: grid;
      flex: none;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      background: var(--sunken);
      color: var(--ink);
      font-size: var(--text-sm);
      font-weight: 650;
    }

    .text {
      display: grid;
      min-width: 0;
      line-height: 1.3;
    }

    .name {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      overflow: hidden;
      color: var(--ink);
      font-weight: 600;
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    a.name:hover {
      text-decoration: underline;
    }

    .verified {
      color: var(--info);
    }

    small {
      color: var(--ink-3);
      font-size: var(--text-xs);
    }
  `,
  template: `
    <span class="avatar" aria-hidden="true">{{ letter() }}</span>
    <span class="text">
      @if (link()) {
        <a class="name" [routerLink]="['/p2p/traders', trader().userId]">{{ trader().displayName }}@if (trader().verified) {<cx-icon class="verified" name="shield" [size]="14" />}</a>
      } @else {
        <span class="name">{{ trader().displayName }}@if (trader().verified) {<cx-icon class="verified" name="shield" [size]="14" />}</span>
      }
      <small>{{ stats() }}</small>
    </span>
  `,
})
export class TraderBadge {
  readonly trader = input.required<Trader>();
  readonly link = input(true);
  protected readonly letter = computed(() => this.trader().displayName.charAt(0).toUpperCase() || '?');
  protected readonly stats = computed(() => completionText(this.trader()));
}
