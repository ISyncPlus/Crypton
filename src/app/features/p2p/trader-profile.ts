import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api.service';
import { formatDate } from '../../core/format';
import { Problem, TraderProfile } from '../../core/models';
import { toProblem } from '../../core/problem';
import { Icon } from '../../ui/icon';
import { TraderBadge, releaseText } from './p2p-shared';

@Component({
  selector: 'cx-trader-profile',
  imports: [RouterLink, Icon, TraderBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .note {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-1) var(--space-3);
      padding: var(--space-4) var(--space-5);
    }

    .note + .note {
      border-top: 1px solid var(--rule);
    }

    .note cx-icon.good {
      color: var(--up);
    }

    .note cx-icon.bad {
      color: var(--down);
    }

    .note small {
      grid-column: 2;
      color: var(--ink-3);
    }
  `,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/p2p"><cx-icon name="arrow-left" [size]="16" />P2P market</a>
      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      } @else if (profile(); as p) {
        <header class="page-head">
          <cx-trader-badge [trader]="p.trader" [link]="false" />
        </header>

        <div class="grid-4">
          <div class="stat">
            <span class="stat__label">Orders in 30 days</span>
            <span class="stat__value">{{ p.trader.completedOrders30d }}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Completion rate</span>
            <span class="stat__value">{{ percent(p.trader.completionRate30d) }}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Feedback</span>
            <span class="stat__value">{{ p.trader.positiveFeedback }} / {{ p.trader.negativeFeedback }}</span>
            <span class="stat__note">positive / negative</span>
          </div>
          <div class="stat">
            <span class="stat__label">Member since</span>
            <span class="stat__value" style="font-size: var(--text-xl)">{{ date(p.trader.memberSince) }}</span>
            @if (release(p); as r) {
              <span class="stat__note">{{ r }}</span>
            }
          </div>
        </div>

        <section class="panel" aria-labelledby="feedback-title">
          <div class="panel__header"><h2 class="panel__title" id="feedback-title">Recent feedback</h2></div>
          @for (item of p.recentFeedback; track $index) {
            <div class="note">
              <cx-icon [name]="item.positive ? 'thumbs-up' : 'thumbs-down'" [class.good]="item.positive" [class.bad]="!item.positive" [size]="18" />
              <span>{{ item.comment || (item.positive ? 'Good trade' : 'Bad trade') }}</span>
              <small>{{ item.fromDisplayName }}, {{ date(item.createdAt) }}</small>
            </div>
          } @empty {
            <div class="empty"><strong>No feedback yet</strong></div>
          }
        </section>
      } @else {
        <span class="skeleton" style="height: 14rem"></span>
      }
    </div>
  `,
})
export class TraderProfilePage {
  private readonly api = inject(Api);
  readonly userId = input.required<string>();
  protected readonly profile = signal<TraderProfile | null>(null);
  protected readonly problem = signal<Problem | null>(null);

  constructor() {
    effect(() => {
      const id = this.userId();
      untracked(() => {
        this.profile.set(null);
        this.api.traderProfile(id).subscribe({ next: (p) => this.profile.set(p), error: (e: unknown) => this.problem.set(toProblem(e)) });
      });
    });
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  protected percent(rate: string): string {
    return `${Math.round(Number(rate) * 100)}%`;
  }

  protected release(p: TraderProfile): string | null {
    return releaseText(p.trader);
  }
}
