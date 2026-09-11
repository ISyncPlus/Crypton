import { HttpBackend, HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, defer, finalize, firstValueFrom, map, of, retry, shareReplay, tap, throwError, timeout, timer } from 'rxjs';
import { Api } from './api.service';
import { AuthResponse, User } from './models';

export const CLIENT_HEADER = 'X-Crypton-Client';
export const CLIENT_NAME = 'crypton-web';

const STAFF = ['Admin', 'Compliance', 'Support'];

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Holds the signed-in user. The access token lives only in memory; the refresh token is an
 * HttpOnly cookie scoped to /api/auth, rotated on every refresh.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  // Refresh and logout bypass the interceptors so they can never recurse.
  private readonly raw = new HttpClient(inject(HttpBackend));

  private readonly _user = signal<User | null>(null);
  private readonly _status = signal<AuthStatus>('unknown');
  private accessToken: string | null = null;
  private expiresAt = 0;
  private refreshing: Observable<string | null> | null = null;
  /** When a signed-in session was last ended by a rejected refresh, so the sign-in page can say why. */
  private endedAt = 0;

  readonly user = this._user.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly roles = computed(() => this._user()?.roles ?? []);
  readonly isStaff = computed(() => this.roles().some((role) => STAFF.includes(role)));
  readonly isAdmin = computed(() => this.roles().includes('Admin'));
  readonly isCompliance = computed(() => this.roles().some((role) => role === 'Admin' || role === 'Compliance'));

  /** Restores a session from the refresh cookie at startup. Never throws. */
  restore(): Promise<void> {
    return firstValueFrom(
      this.refresh().pipe(
        timeout(10_000),
        map(() => undefined),
        catchError(() => {
          this.clear();
          return of(undefined);
        }),
      ),
    );
  }

  token(): string | null {
    return this.accessToken;
  }

  tokenExpiresSoon(): boolean {
    return this.accessToken !== null && Date.now() > this.expiresAt - 30_000;
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api.login(email, password).pipe(tap((response) => this.accept(response)));
  }

  completeTwoFactor(challengeToken: string, code?: string, recoveryCode?: string): Observable<AuthResponse> {
    return this.api.loginTwoFactor(challengeToken, code, recoveryCode).pipe(tap((response) => this.accept(response)));
  }

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers share one request.
   * Emits null when the session is over; errors only for transport problems.
   */
  refresh(): Observable<string | null> {
    if (!this.refreshing) {
      this.refreshing = defer(() =>
        this.raw.post<AuthResponse>('/api/auth/refresh', {}, { headers: clientHeaders(), withCredentials: true }),
      ).pipe(
        // Another tab may be rotating the same cookie; the API answers 409 and we simply retry.
        retry({
          count: 4,
          delay: (error: unknown, attempt: number) => (isRefreshRace(error) ? timer(300 * attempt) : throwError(() => error)),
        }),
        map((response) => {
          this.accept(response);
          return this.accessToken;
        }),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && [400, 401, 403, 409].includes(error.status)) {
            this.clear();
            return of(null);
          }

          return throwError(() => error);
        }),
        finalize(() => (this.refreshing = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this.refreshing;
  }

  logout(): Observable<void> {
    return this.raw.post('/api/auth/logout', {}, { headers: clientHeaders(), withCredentials: true }).pipe(
      catchError(() => of(null)),
      map(() => undefined),
      finalize(() => {
        this.clear();
        void this.router.navigateByUrl('/auth/sign-in');
      }),
    );
  }

  /** Called when an authenticated request could not be recovered by refreshing. */
  sessionExpired(): void {
    const wasSignedIn = this._user() !== null || Date.now() - this.endedAt < 10_000;
    this.clear();
    const url = this.router.url;
    if (!url.startsWith('/auth')) {
      void this.router.navigate(['/auth/sign-in'], { queryParams: { returnUrl: url, reason: wasSignedIn ? 'expired' : null } });
    }
  }

  /** Keeps the cached user in step after profile, 2FA or verification changes. */
  setUser(user: User): void {
    if (this._user()) {
      this._user.set(user);
    }
  }

  homeFor(user: User | null = this._user()): string {
    return user && user.roles.some((role) => STAFF.includes(role)) ? '/admin' : '/dashboard';
  }

  private accept(response: AuthResponse): void {
    if (response.requiresTwoFactor || !response.accessToken || !response.user) {
      return;
    }

    this.accessToken = response.accessToken;
    this.expiresAt = response.accessTokenExpiresAt ? Date.parse(response.accessTokenExpiresAt) : Date.now() + 10 * 60_000;
    this._user.set(response.user);
    this._status.set('authenticated');
  }

  private clear(): void {
    if (this._user() !== null) {
      this.endedAt = Date.now();
    }

    this.accessToken = null;
    this.expiresAt = 0;
    this._user.set(null);
    this._status.set('anonymous');
  }
}

export function clientHeaders(): HttpHeaders {
  return new HttpHeaders({ [CLIENT_HEADER]: CLIENT_NAME });
}

function isRefreshRace(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409 && error.error?.code === 'refresh_in_progress';
}
