import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { AuthService, CLIENT_HEADER, CLIENT_NAME } from './auth.service';

/** Adds the client header and bearer token to API calls, refreshing once on expiry. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApi(req)) {
    return next(req);
  }

  if (req.url.startsWith('/api/auth/')) {
    return next(req.clone({ setHeaders: { [CLIENT_HEADER]: CLIENT_NAME }, withCredentials: true }));
  }

  const auth = inject(AuthService);
  const send = (token: string | null) =>
    next(req.clone({ setHeaders: token ? { [CLIENT_HEADER]: CLIENT_NAME, Authorization: `Bearer ${token}` } : { [CLIENT_HEADER]: CLIENT_NAME } }));

  const current = auth.token();
  const token$ = current && auth.tokenExpiresSoon() ? auth.refresh().pipe(catchError(() => of(current))) : of(current);

  return token$.pipe(
    switchMap((token) =>
      send(token).pipe(
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse) || error.status !== 401 || token === null) {
            return throwError(() => error);
          }

          return auth.refresh().pipe(
            catchError(() => of(null)),
            switchMap((fresh) => {
              if (!fresh) {
                auth.sessionExpired();
                return throwError(() => error);
              }

              return send(fresh);
            }),
          );
        }),
      ),
    ),
  );
};

function isApi(req: HttpRequest<unknown>): boolean {
  return req.url.startsWith('/api/');
}
