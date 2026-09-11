import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'cx-pager',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
      border-top: 1px solid var(--rule);
      font-size: var(--text-sm);
      color: var(--ink-3);
    }
  `,
  template: `
    <span>{{ summary() }}</span>
    @if (totalPages() > 1) {
      <div class="row">
        <button type="button" class="btn btn--sm btn--icon" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)" aria-label="Previous page">
          <cx-icon name="chevron-left" [size]="16" />
        </button>
        <span class="figure">{{ page() }} / {{ totalPages() }}</span>
        <button type="button" class="btn btn--sm btn--icon" [disabled]="page() >= totalPages()" (click)="pageChange.emit(page() + 1)" aria-label="Next page">
          <cx-icon name="chevron-right" [size]="16" />
        </button>
      </div>
    }
  `,
})
export class Pager {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly summary = computed(() => {
    const total = this.totalCount();
    if (total === 0) {
      return 'No results';
    }

    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(total, this.page() * this.pageSize());
    return `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`;
  });
}
