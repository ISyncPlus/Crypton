import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { AuthResponse, User } from './models';

const user: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Okafor',
  displayName: 'ada',
  kycTier: 1,
  status: 'Active',
  twoFactorEnabled: false,
  roles: [],
  withdrawalsLockedUntil: null,
  createdAt: '2026-01-01T00:00:00Z',
};

function session(token: string, minutes = 15): AuthResponse {
  return { requiresTwoFactor: false, challengeToken: null, accessToken: token, accessTokenExpiresAt: new Date(Date.now() + minutes * 60_000).toISOString(), user };
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'auth/sign-in', children: [] },
          { path: '**', children: [] },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    vi.useRealTimers();
    backend.verify();
  });

  function signIn(token = 'old', minutes = 15): void {
    auth.login('ada@example.com', 'Password-123').subscribe();
    const login = backend.expectOne('/api/auth/login');
    expect(login.request.headers.get('X-Crypton-Client')).toBe('crypton-web');
    login.flush(session(token, minutes));
  }

  it('sends the bearer token and client header to the API only', () => {
    signIn();
    http.get('/api/me').subscribe();
    http.get('https://example.com/other').subscribe();

    const api = backend.expectOne('/api/me');
    expect(api.request.headers.get('Authorization')).toBe('Bearer old');
    expect(api.request.headers.get('X-Crypton-Client')).toBe('crypton-web');
    api.flush({});

    const external = backend.expectOne('https://example.com/other');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush({});
  });

  it('refreshes once for concurrent 401s and retries each request with the new token', () => {
    signIn();
    const results: unknown[] = [];
    http.get('/api/me').subscribe((r) => results.push(r));
    http.get('/api/wallets').subscribe((r) => results.push(r));

    backend.expectOne('/api/me').flush({ code: 'invalid_token' }, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/wallets').flush({ code: 'invalid_token' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = backend.match('/api/auth/refresh');
    expect(refresh.length).toBe(1);
    expect(refresh[0].request.headers.get('X-Crypton-Client')).toBe('crypton-web');
    refresh[0].flush(session('new'));

    backend.expectOne((r) => r.url === '/api/me' && r.headers.get('Authorization') === 'Bearer new').flush({ me: true });
    backend.expectOne((r) => r.url === '/api/wallets' && r.headers.get('Authorization') === 'Bearer new').flush({ wallets: true });
    expect(results).toEqual([{ me: true }, { wallets: true }]);
    expect(auth.token()).toBe('new');
  });

  it('ends the session and sends the user to sign in when refresh is rejected', async () => {
    signIn();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    let failed = false;
    http.get('/api/me').subscribe({ error: () => (failed = true) });

    backend.expectOne('/api/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/auth/refresh').flush({ code: 'invalid_token' }, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/auth/sign-in'], expect.objectContaining({ queryParams: expect.objectContaining({ reason: 'expired' }) }));
  });

  it('retries a refresh that raced another tab', () => {
    vi.useFakeTimers();
    auth.refresh().subscribe();
    backend.expectOne('/api/auth/refresh').flush({ code: 'refresh_in_progress' }, { status: 409, statusText: 'Conflict' });
    vi.advanceTimersByTime(350);
    backend.expectOne('/api/auth/refresh').flush(session('fresh'));
    expect(auth.token()).toBe('fresh');
    expect(auth.user()?.email).toBe('ada@example.com');
  });

  it('refreshes ahead of time when the token is about to expire', () => {
    signIn('stale', 0.25);
    http.get('/api/wallets').subscribe();
    backend.expectOne('/api/auth/refresh').flush(session('renewed'));
    const request = backend.expectOne('/api/wallets');
    expect(request.request.headers.get('Authorization')).toBe('Bearer renewed');
    request.flush({});
  });
});
