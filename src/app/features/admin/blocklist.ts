import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/admin-api.service';
import { BlockedAddress } from '../../core/admin-models';
import { formatDateTime } from '../../core/format';
import { Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { Pager } from '../../ui/pager';
import { adminTableStyles, pagedList } from './admin-shared';

@Component({
  selector: 'cx-admin-blocklist',
  imports: [Icon, Pager],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    adminTableStyles,
    `
      .add {
        display: grid;
        grid-template-columns: 9rem minmax(0, 2fr) minmax(0, 1.5fr) auto;
        gap: var(--space-3);
        align-items: end;
      }

      @media (max-width: 900px) {
        .add {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Block list</h1>
          <p class="lede">Withdrawals to these addresses are refused when the blocked address rule is on.</p>
        </div>
      </header>

      <section class="panel" aria-labelledby="add-title">
        <div class="panel__header">
          <h2 class="panel__title" id="add-title">{{ importing() ? 'Import addresses' : 'Block an address' }}</h2>
          <button type="button" class="link" (click)="importing.set(!importing())">{{ importing() ? 'Add one address' : 'Import a list' }}</button>
        </div>
        <div class="panel__body stack">
          @if (problem(); as p) {
            <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
          }
          @if (!importing()) {
            <div class="add">
              <label class="field">
                <span class="field__label">Network</span>
                <select class="select" [value]="network()" (change)="network.set($any($event.target).value)">
                  <option value="bitcoin">Bitcoin</option>
                  <option value="ethereum">Ethereum</option>
                </select>
              </label>
              <label class="field"><span class="field__label">Address</span><input class="input mono" [value]="address()" (input)="address.set($any($event.target).value.trim())" /></label>
              <label class="field"><span class="field__label">Reason</span><input class="input" maxlength="300" [value]="reason()" (input)="reason.set($any($event.target).value)" /></label>
              <button type="button" class="btn btn--primary" [disabled]="!address() || !reason().trim() || busy()" [attr.aria-busy]="busy()" (click)="add()">Block</button>
            </div>
          } @else {
            <div class="add" style="grid-template-columns: 9rem minmax(0, 1fr) 10rem">
              <label class="field">
                <span class="field__label">Network</span>
                <select class="select" [value]="network()" (change)="network.set($any($event.target).value)">
                  <option value="bitcoin">Bitcoin</option>
                  <option value="ethereum">Ethereum</option>
                </select>
              </label>
              <label class="field"><span class="field__label">Reason</span><input class="input" maxlength="300" [value]="reason()" (input)="reason.set($any($event.target).value)" /></label>
              <label class="field"><span class="field__label">Source</span><input class="input" maxlength="40" placeholder="e.g. ofac-sdn" [value]="source()" (input)="source.set($any($event.target).value)" /></label>
            </div>
            <label class="field">
              <span class="field__label">Addresses</span>
              <textarea class="textarea mono" rows="6" placeholder="One per line, or separated by commas" [value]="bulk()" (input)="bulk.set($any($event.target).value)"></textarea>
              <span class="field__hint">Up to 10,000 at a time. Duplicates are skipped.</span>
            </label>
            <button type="button" class="btn btn--primary" style="justify-self: start" [disabled]="!bulk().trim() || !reason().trim() || busy()" [attr.aria-busy]="busy()" (click)="importList()">Import</button>
          }
        </div>
      </section>

      <div class="filters">
        <label class="sr-only" for="block-search">Search</label>
        <input id="block-search" class="input" type="search" placeholder="Search addresses or reasons" [value]="query()" (input)="onSearch($any($event.target).value)" style="min-width: 20rem" />
      </div>

      <section class="panel" aria-label="Blocked addresses">
        @if (list.data(); as page) {
          <div class="table-wrap frame" [class.is-loading]="list.loading()">
            <table class="table">
              <thead><tr><th scope="col">Address</th><th scope="col">Network</th><th scope="col">Reason</th><th scope="col">Added</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>
                @for (b of page.items; track b.id) {
                  <tr>
                    <td class="mono" style="word-break: break-all">{{ b.address }}</td>
                    <td>{{ b.network }}</td>
                    <td>{{ b.reason }}<div class="sub">{{ b.source }}</div></td>
                    <td class="muted">{{ when(b.createdAt) }}</td>
                    <td class="end"><button type="button" class="btn btn--sm btn--quiet" (click)="remove(b)" [attr.aria-label]="'Unblock ' + b.address"><cx-icon name="trash" [size]="16" /></button></td>
                  </tr>
                } @empty {
                  <tr><td colspan="5"><div class="empty"><strong>No blocked addresses</strong></div></td></tr>
                }
              </tbody>
            </table>
          </div>
          <cx-pager [page]="page.page" [pageSize]="page.pageSize" [totalCount]="page.totalCount" [totalPages]="page.totalPages" (pageChange)="list.page.set($event)" />
        } @else {
          <div class="panel__body"><span class="skeleton" style="height: 10rem"></span></div>
        }
      </section>
    </div>
  `,
})
export class AdminBlocklist {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);

  protected readonly importing = signal(false);
  protected readonly network = signal('ethereum');
  protected readonly address = signal('');
  protected readonly reason = signal('');
  protected readonly source = signal('');
  protected readonly bulk = signal('');
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly query = signal('');
  private readonly debounced = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected readonly list = pagedList((p) => this.api.blockedAddresses(p), () => ({ q: this.debounced() }), 50);

  onSearch(value: string): void {
    this.query.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.debounced.set(value.trim());
      this.list.page.set(1);
    }, 300);
  }

  add(): void {
    this.busy.set(true);
    this.problem.set(null);
    this.api.blockAddress(this.network(), this.address(), this.reason().trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.address.set('');
        this.toast.success('Address blocked');
        this.list.reload();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.problem.set(toProblem(e));
      },
    });
  }

  importList(): void {
    this.busy.set(true);
    this.problem.set(null);
    this.api.importBlockList(this.network(), this.bulk(), this.reason().trim(), this.source().trim() || undefined).subscribe({
      next: ({ added, invalid }) => {
        this.busy.set(false);
        this.bulk.set(invalid.join('\n'));
        this.toast.success(`${added} address${added === 1 ? '' : 'es'} added`, invalid.length ? `${invalid.length} invalid entries were left in the box.` : undefined);
        this.list.reload();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.problem.set(toProblem(e));
      },
    });
  }

  async remove(entry: BlockedAddress): Promise<void> {
    const ok = await this.dialogs.confirm({ title: 'Unblock this address?', body: entry.address, confirmLabel: 'Unblock', tone: 'danger' });
    if (!ok) {
      return;
    }

    this.api.unblockAddress(entry.id).subscribe({
      next: () => {
        this.toast.success('Address unblocked');
        this.list.reload();
      },
      error: (e: unknown) => this.toast.error(e),
    });
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }
}
