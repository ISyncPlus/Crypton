import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/admin-api.service';
import { ReportType } from '../../core/admin-models';
import { fileNameFrom, saveBlob } from '../../core/files';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../ui/icon';

const REPORTS: { type: ReportType; title: string; description: string }[] = [
  { type: 'trades', title: 'Instant trades', description: 'Every buy, sell and swap with amounts, fees, rate and naira value.' },
  { type: 'crypto-deposits', title: 'Crypto deposits', description: 'Detected and credited deposits with transaction hashes and confirmations.' },
  { type: 'crypto-withdrawals', title: 'Crypto withdrawals', description: 'Requests, network fees, transaction hashes and risk notes.' },
  { type: 'fiat-deposits', title: 'Naira deposits', description: 'Payment references, fees charged and provider fees.' },
  { type: 'fiat-withdrawals', title: 'Naira withdrawals', description: 'Payouts with bank details, fees and failure reasons.' },
  { type: 'p2p-orders', title: 'P2P orders', description: 'Orders with buyer, seller, price, amount and outcome.' },
  { type: 'ledger', title: 'Ledger postings', description: 'Every double-entry posting, for reconciliation and audit.' },
];

@Component({
  selector: 'cx-admin-reports',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .range {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--space-4);
    }

    .range .input {
      width: 12rem;
    }

    .report {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5);
    }

    .report + .report {
      border-top: 1px solid var(--rule);
    }

    .report > span {
      display: grid;
      gap: 0.15rem;
    }
  `,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Reports</h1>
          <p class="lede">CSV exports for finance and compliance, up to 100,000 rows each. Times are in UTC; days use the Lagos timezone.</p>
        </div>
      </header>

      <div class="range">
        <label class="field">
          <span class="field__label">From</span>
          <input class="input" type="date" [value]="from()" [max]="to()" (input)="from.set($any($event.target).value)" />
        </label>
        <label class="field">
          <span class="field__label">To (inclusive)</span>
          <input class="input" type="date" [value]="to()" [min]="from()" (input)="to.set($any($event.target).value)" />
        </label>
        <div class="segmented" role="group" aria-label="Quick ranges">
          <button type="button" (click)="quick(7)">7 days</button>
          <button type="button" (click)="quick(30)">30 days</button>
          <button type="button" (click)="month()">This month</button>
        </div>
      </div>

      <section class="panel" aria-label="Reports">
        @for (report of reports; track report.type) {
          <div class="report">
            <span>
              <strong>{{ report.title }}</strong>
              <span class="caption">{{ report.description }}</span>
            </span>
            <button type="button" class="btn btn--sm" [attr.aria-busy]="busy() === report.type" [disabled]="!!busy() || !from() || !to()" (click)="download(report.type)">
              <cx-icon name="download" [size]="16" />CSV
            </button>
          </div>
        }
      </section>
    </div>
  `,
})
export class AdminReports {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  protected readonly reports = REPORTS;
  protected readonly from = signal(isoDay(new Date(Date.now() - 30 * 86_400_000)));
  protected readonly to = signal(isoDay(new Date()));
  protected readonly busy = signal<ReportType | null>(null);

  quick(days: number): void {
    this.to.set(isoDay(new Date()));
    this.from.set(isoDay(new Date(Date.now() - days * 86_400_000)));
  }

  month(): void {
    const now = new Date();
    this.from.set(isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))));
    this.to.set(isoDay(now));
  }

  download(type: ReportType): void {
    const from = `${this.from()}T00:00:00Z`;
    const toDate = new Date(`${this.to()}T00:00:00Z`);
    const to = new Date(toDate.getTime() + 86_400_000).toISOString();
    this.busy.set(type);
    this.api.report(type, from, to).subscribe({
      next: (response) => {
        this.busy.set(null);
        if (response.body) {
          saveBlob(response.body, fileNameFrom(response, `crypton-${type}.csv`));
        }
      },
      error: (e: unknown) => {
        this.busy.set(null);
        this.toast.error(e);
      },
    });
  }
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
