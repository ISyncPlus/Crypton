import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/admin-api.service';
import { LedgerCheckReport } from '../../core/admin-models';
import { formatDateTime } from '../../core/format';
import { Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'cx-admin-system',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .check {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--space-1) var(--space-3);
      padding: var(--space-3) var(--space-5);
    }

    .check + .check {
      border-top: 1px solid var(--rule);
    }

    .check cx-icon.ok {
      color: var(--up);
    }

    .check cx-icon.bad {
      color: var(--down);
    }

    .problems {
      grid-column: 2;
      margin: 0;
      padding-left: 1rem;
      color: var(--down);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
    }
  `,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">System health</h1>
          <p class="lede">Ledger invariants checked directly in the database. Every check should always pass; a failure means money is unaccounted for and needs investigation before anything else.</p>
        </div>
        <button type="button" class="btn btn--primary" [attr.aria-busy]="loading()" (click)="run()"><cx-icon name="refresh" [size]="16" />Run checks</button>
      </header>

      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      }

      @if (report(); as r) {
        <div class="notice" [class.notice--ok]="r.ok" [class.notice--bad]="!r.ok" role="status">
          <cx-icon [name]="r.ok ? 'check' : 'alert'" [size]="18" />
          <span>{{ r.ok ? 'All ledger checks passed' : 'Some ledger checks failed' }}, checked {{ when(r.checkedAt) }}.</span>
        </div>
        <section class="panel" aria-label="Ledger checks">
          @for (check of r.checks; track check.name) {
            <div class="check">
              <cx-icon [name]="check.ok ? 'check' : 'x'" [class.ok]="check.ok" [class.bad]="!check.ok" [size]="18" />
              <span>{{ check.name }}</span>
              @if (check.problems.length) {
                <ul class="problems">
                  @for (item of check.problems.slice(0, 20); track $index) {
                    <li>{{ item }}</li>
                  }
                </ul>
              }
            </div>
          }
        </section>
      } @else if (loading()) {
        <span class="skeleton" style="height: 12rem"></span>
      }
    </div>
  `,
})
export class AdminSystem implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly report = signal<LedgerCheckReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  ngOnInit(): void {
    this.run();
  }

  run(): void {
    this.loading.set(true);
    this.problem.set(null);
    this.api.ledgerCheck().subscribe({
      next: (r) => {
        this.loading.set(false);
        this.report.set(r);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.problem.set(toProblem(e));
      },
    });
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
