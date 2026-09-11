import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { ClockService } from './clock.service';

export const clockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const clock = inject(ClockService);
  const started = Date.now();
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        clock.observeServerDate(event.headers.get('Date'), started);
      }
    }),
  );
};
