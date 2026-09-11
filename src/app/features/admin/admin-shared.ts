import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { Params } from '../../core/api.service';
import { Page, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';

/**
 * A paged list that reloads whenever its filters change. Must be created in an injection context
 * (a field initializer or constructor).
 */
export function pagedList<T>(load: (params: Params) => Observable<Page<T>>, filters: () => Params, pageSize = 25) {
  const page = signal(1);
  const data = signal<Page<T> | null>(null);
  const loading = signal(false);
  const error = signal<Problem | null>(null);
  const tick = signal(0);

  toObservable(computed(() => ({ filters: filters(), page: page(), tick: tick() })))
    .pipe(
      tap(() => loading.set(true)),
      switchMap(({ filters: f, page: p }) =>
        load({ ...f, page: p, pageSize }).pipe(
          catchError((e: unknown) => {
            error.set(toProblem(e));
            return of(null);
          }),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe((result) => {
      loading.set(false);
      if (result) {
        error.set(null);
        data.set(result);
      }
    });

  return {
    page,
    data,
    loading,
    error,
    reload: () => tick.update((n) => n + 1),
    /** Replaces one row in place after an action, keeping the page stable. */
    replace: (match: (item: T) => boolean, next: T) => data.update((d) => (d ? { ...d, items: d.items.map((item) => (match(item) ? next : item)) } : d)),
  };
}

export const adminTableStyles = `
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .filters .input,
  .filters .select {
    width: auto;
    min-width: 12rem;
  }

  .sub {
    margin-top: 0.1rem;
    color: var(--ink-3);
    font-size: var(--text-xs);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .frame.is-loading {
    opacity: 0.5;
    transition: opacity var(--dur) var(--ease);
  }

  .user-link {
    color: var(--ink);
    font-weight: 550;
    text-decoration: none;
  }

  .user-link:hover {
    text-decoration: underline;
  }
`;
