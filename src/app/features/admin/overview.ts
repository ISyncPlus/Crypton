import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap, tap } from 'rxjs';
import { AdminApi } from '../../core/admin-api.service';
import { AdminDashboard, AnalyticsOverview, Metric, TimePoint } from '../../core/admin-models';
import { AuthService } from '../../core/auth.service';
import { compactNgn, formatDateTime, formatNgn } from '../../core/format';
import { BarChart, BarDatum } from '../../ui/charts';
import { Icon } from '../../ui/icon';

const METRICS: { metric: Metric; label: string; money: boolean }[] = [
  { metric: 'trade_volume', label: 'Instant trade volume', money: true },
  { metric: 'p2p_volume', label: 'P2P volume', money: true },
  { metric: 'fees_ngn', label: 'Naira fees earned', money: true },
  { metric: 'signups', label: 'New sign-ups', money: false },
];

@Component({
  selector: 'cx-admin-overview',
  imports: [RouterLink, BarChart, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .queues {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: var(--space-3);
    }

    .queue {
      display: grid;
      gap: var(--space-1);
      padding: var(--space-4);
      border: 1px solid var(--rule);
      border-radius: var(--radius);
      background: var(--surface);
      color: inherit;
      text-decoration: none;
    }

    .queue:hover {
      border-color: var(--rule-strong);
    }

    .queue.has-items {
      border-color: color-mix(in srgb, var(--signal) 55%, var(--rule));
      box-shadow: inset 3px 0 0 var(--signal);
    }

    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--space-5) var(--space-4);
    }

    .charts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-5);
    }

    .health td:first-child {
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }

    @media (max-width: 1100px) {
      .queues {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .queues,
      .charts {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Back office</h1>
          <p class="lede">What needs attention, and how the exchange is doing.</p>
        </div>
      </header>

      @if (dashboard(); as d) {
        <section aria-labelledby="queues-title" class="stack">
          <h2 class="section-title" id="queues-title">Waiting on staff</h2>
          <div class="queues">
            @for (q of queues(); track q.label) {
              <a class="queue" [class.has-items]="q.count > 0" [routerLink]="q.link" [queryParams]="q.query">
                <span class="stat__label">{{ q.label }}</span>
                <span class="stat__value">{{ q.count }}</span>
              </a>
            }
          </div>
        </section>
      } @else if (problem()) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ problem() }}</span></div>
      }

      <div class="row-between">
        <h2 class="section-title">Performance</h2>
        <div class="segmented" role="group" aria-label="Date range">
          @for (option of ranges; track option.days) {
            <button type="button" [attr.aria-pressed]="days() === option.days" (click)="days.set(option.days)">{{ option.label }}</button>
          }
        </div>
      </div>

      @if (overview(); as o) {
        <section class="panel" aria-label="Key figures" [style.opacity]="loading() ? 0.5 : 1">
          <div class="panel__body kpis">
            <div class="stat"><span class="stat__label">Instant trades</span><span class="stat__value">{{ money(o.tradeVolumeNgn) }}</span><span class="stat__note">{{ o.tradeCount.toLocaleString() }} orders</span></div>
            <div class="stat"><span class="stat__label">P2P completed</span><span class="stat__value">{{ money(o.p2PVolumeNgn) }}</span><span class="stat__note">{{ o.p2PCompletedOrders.toLocaleString() }} orders</span></div>
            <div class="stat"><span class="stat__label">Naira in / out</span><span class="stat__value">{{ money(o.fiatDepositsNgn) }}</span><span class="stat__note">{{ money(o.fiatWithdrawalsNgn) }} withdrawn</span></div>
            <div class="stat"><span class="stat__label">Crypto in / out</span><span class="stat__value">{{ money(o.cryptoDepositsNgn) }}</span><span class="stat__note">{{ money(o.cryptoWithdrawalsNgn) }} withdrawn</span></div>
            <div class="stat"><span class="stat__label">Fees earned (naira estimate)</span><span class="stat__value">{{ money(o.feesNgnEstimate) }}</span><span class="stat__note">{{ feeBreakdown(o) }}</span></div>
            <div class="stat"><span class="stat__label">New users</span><span class="stat__value">{{ o.newUsers.toLocaleString() }}</span><span class="stat__note">{{ o.totalUsers.toLocaleString() }} in total</span></div>
            <div class="stat"><span class="stat__label">Verified users</span><span class="stat__value">{{ o.verifiedUsers.toLocaleString() }}</span><span class="stat__note">{{ verifiedShare(o) }} of all users</span></div>
          </div>
        </section>
      } @else {
        <span class="skeleton" style="height: 9rem"></span>
      }

      <div class="charts">
        @for (m of metrics; track m.metric) {
          <section class="panel" [attr.aria-labelledby]="'chart-' + m.metric">
            <div class="panel__header"><h3 class="panel__title" [id]="'chart-' + m.metric">{{ m.label }}</h3><span class="caption">Daily</span></div>
            <div class="panel__body">
              <cx-bar-chart [data]="series()[m.metric] ?? []" [height]="190" [label]="m.label" [format]="m.money ? moneyFull : count" [axisFormat]="m.money ? moneyAxis : count" [loading]="loading()" />
            </div>
          </section>
        }
      </div>

      @if (dashboard(); as d) {
        <section class="panel" aria-labelledby="health-title">
          <div class="panel__header">
            <h2 class="panel__title" id="health-title">Background jobs</h2>
            <span class="caption">Price feed: {{ d.priceFeed.provider }}, {{ d.priceFeed.lastRefreshAt ? 'updated ' + when(d.priceFeed.lastRefreshAt) : 'no update yet' }}</span>
          </div>
          @if (d.priceFeed.lastError) {
            <div class="panel__body"><div class="notice notice--warn"><cx-icon name="alert" [size]="18" /><span>Price feed error: {{ d.priceFeed.lastError }}</span></div></div>
          }
          <div class="table-wrap">
            <table class="table health">
              <thead>
                <tr><th scope="col">Job</th><th scope="col">Last success</th><th scope="col">Last failure</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                @for (job of d.jobs; track job.name) {
                  <tr>
                    <td>{{ job.name }}</td>
                    <td class="muted">{{ job.lastSucceededAt ? when(job.lastSucceededAt) : 'Never' }}</td>
                    <td class="muted">{{ job.lastFailedAt ? when(job.lastFailedAt) : '–' }}</td>
                    <td>
                      @if (job.consecutiveFailures > 0) {
                        <span class="status status--bad">Failing ({{ job.consecutiveFailures }})</span>
                        <div class="caption" style="max-width: 32rem">{{ job.lastError }}</div>
                      } @else {
                        <span class="status status--ok">Healthy</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="muted">No job runs recorded yet.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
})
export class AdminOverview {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);

  protected readonly metrics = METRICS;
  protected readonly ranges = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
  ];

  protected readonly days = signal(30);
  protected readonly dashboard = signal<AdminDashboard | null>(null);
  protected readonly problem = signal<string | null>(null);
  protected readonly overview = signal<AnalyticsOverview | null>(null);
  protected readonly series = signal<Partial<Record<Metric, BarDatum[]>>>({});
  protected readonly loading = signal(false);

  protected readonly queues = computed(() => {
    const d = this.dashboard();
    if (!d) {
      return [];
    }

    const compliance = this.auth.isCompliance();
    return [
      { label: 'Verifications to review', count: d.queues.pendingKyc, link: compliance ? '/admin/kyc' : '/admin', query: {} },
      { label: 'Withdrawals to review', count: d.queues.pendingWithdrawals, link: '/admin/withdrawals', query: { status: 'PendingReview' } },
      { label: 'Withdrawals needing attention', count: d.queues.withdrawalsNeedingAttention, link: '/admin/withdrawals', query: { status: 'NeedsAttention' } },
      { label: 'Open compliance alerts', count: d.queues.openAmlAlerts, link: compliance ? '/admin/aml' : '/admin', query: {} },
      { label: 'Open P2P disputes', count: d.queues.openDisputes, link: compliance ? '/admin/p2p/disputes' : '/admin', query: {} },
    ];
  });

  protected readonly moneyFull = (value: number) => formatNgn(String(Math.round(value * 100) / 100));
  protected readonly moneyAxis = (value: number) => compactNgn(String(value));
  protected readonly count = (value: number) => Math.round(value).toLocaleString();

  constructor() {
    this.api.dashboard().subscribe({ next: (d) => this.dashboard.set(d), error: () => this.problem.set('The dashboard could not be loaded. Check your staff role and two-factor sign-in.') });

    toObservable(this.days)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((days) => {
          const to = new Date();
          const from = new Date(to.getTime() - days * 86_400_000);
          const fromIso = from.toISOString();
          const toIso = to.toISOString();
          return forkJoin({
            overview: this.api.overview(fromIso, toIso).pipe(catchError(() => of(null))),
            series: forkJoin(METRICS.map((m) => this.api.timeSeries(m.metric, fromIso, toIso).pipe(catchError(() => of([] as TimePoint[]))))),
          });
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ overview, series }) => {
        this.loading.set(false);
        this.overview.set(overview);
        const map: Partial<Record<Metric, BarDatum[]>> = {};
        METRICS.forEach((m, i) => (map[m.metric] = series[i].map((p) => toDatum(p))));
        this.series.set(map);
      });
  }

  protected money(value: string): string {
    return compactNgn(value);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected feeBreakdown(o: AnalyticsOverview): string {
    const parts = Object.entries(o.feesByAsset)
      .filter(([, v]) => Number(v) > 0)
      .map(([asset, v]) => `${Number(v).toLocaleString('en-NG', { maximumFractionDigits: 6 })} ${asset}`);
    return parts.length ? parts.join(', ') : 'No fees yet';
  }

  protected verifiedShare(o: AnalyticsOverview): string {
    return o.totalUsers ? `${Math.round((o.verifiedUsers / o.totalUsers) * 100)}%` : '0%';
  }
}

function toDatum(point: TimePoint): BarDatum {
  const date = new Date(`${point.date}T12:00:00Z`);
  return {
    label: date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
    title: date.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    value: Number(point.value),
  };
}
