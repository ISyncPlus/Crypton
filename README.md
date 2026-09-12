# Crypton — web app

The customer app and staff back office for Crypton, a naira ⇄ crypto exchange. Angular 22, standalone and
zoneless, signals throughout, Angular CDK for overlays, no UI framework — the design system lives in
`src/styles`.

It talks to the Crypton API (`Crypton_Server.git`) under `/api`. There is nothing else to configure: no
API keys live in the browser.

- [Run it](#run-it)
- [How it is put together](#how-it-is-put-together)
- [Tests](#tests)
- [End-to-end tests](#end-to-end-tests)
- [Build and deploy](#build-and-deploy)

## Run it

Requirements: Node 22.12+ (24 recommended) and the API running on <http://localhost:5080>.

```bash
npm install
npm start            # http://localhost:4200
```

`proxy.conf.json` forwards `/api` to `http://localhost:5080`, so the browser sees one origin and the
refresh-token cookie works. If your API runs elsewhere, change the target there.

Signing in with the API's development seed data:

| Account | Email | Password |
| --- | --- | --- |
| Staff (back office) | `admin@crypton.local` | `Admin-Password-2026` |
| Customer | `ada@demo.crypton.local` | `Demo-Password-2026` |
| Customer | `tunde@demo.crypton.local` | `Demo-Password-2026` |

Staff land in the back office at `/admin`; customers land on the dashboard.

## How it is put together

```
src/app/core        Services, models, guards, interceptors, formatting, decimal maths
src/app/ui          Presentational pieces: icons, charts, dialogs, toasts, QR, status, pager
src/app/layouts     The customer shell, the back-office shell and the menus
src/app/features    Screens by area: auth, dashboard, trade, wallets, p2p, account, admin
src/styles          Design tokens, base styles and the component classes
e2e                 Playwright end-to-end suite
```

A few things worth knowing before changing code:

- **Money never becomes a JavaScript number.** Amounts are decimal strings and arithmetic goes through
  `core/decimal.ts` (BigInt based). `core/format.ts` turns them into display strings.
- **Time comes from the server.** `ClockService` corrects for clock skew using the `Date` header, so held
  quote timers and P2P deadlines match the API.
- **Auth**: the access token is held in memory only, the refresh token is an HttpOnly cookie. The interceptor
  refreshes ahead of expiry, single-flights concurrent refreshes, and retries a 401 once.
- **Design**: colours, spacing, radii and type live in `src/styles/_tokens.scss`; shared classes such as
  `.panel`, `.btn`, `.field`, `.table`, `.status` are in `_components.scss`. Dark mode is a token swap —
  no component needs its own dark rules. Charts draw one validated series colour, with keyboard readouts and
  a "View as table" twin for every chart.
- **Forms** use `(submit)` with `preventDefault`, not `(ngSubmit)`, unless the form has a `[formGroup]`
  directive — a plain `<form (ngSubmit)>` with no form directive silently reloads the page.

## Tests

```bash
npm test             # 23 unit tests (Vitest via ng test)
npm run format       # Prettier
```

The unit tests cover the decimal maths, amount parsing and validation, the auth interceptor's refresh
behaviour, and the chart tick maths.

## End-to-end tests

Playwright drives a real browser through the actual flows: sign-in and session handling, registration with
email confirmation and KYC approval, buying and swapping, deposits and withdrawals, a complete P2P trade with
two-factor release, the back office, and light/dark/mobile screenshots.

It needs the whole stack running, with a **fresh development database** so the demo balances are predictable:

```bash
# 1. API, with demo data, on port 5080 (see the backend README)
dropdb crypton_dev && createdb -O crypton crypton_dev     # start clean
dotnet run --project src/Crypton.Api

# 2. mail catcher — the tests read confirmation links from it
mailpit                                                   # API on http://localhost:8025

# 3. web app
npm start                                                 # must be http://localhost:4200

# 4. tests
npx playwright install chromium    # once; or set E2E_CHANNEL=chrome to use installed Chrome
npm run e2e
npx playwright show-report
```

Environment variables the suite understands: `E2E_BASE_URL` (default `http://localhost:4200`),
`E2E_MAILPIT_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_DEMO_PASSWORD`, `E2E_CHANNEL`.

Screenshots of each key screen are written to `test-results/screens` on every run — useful for reviewing a
visual change.

The base URL must be `localhost:4200` (not `127.0.0.1`), because it has to match the API's
`App:FrontendBaseUrl` for the refresh cookie to survive redirects.

> If pages mysteriously reload mid-test, or dialogs and menus never open, check that only one `ng serve` is
> running: a second, older dev server bound to `[::1]:4200` will be the one the browser actually reaches.

## Build and deploy

```bash
npx ng build                     # production build into dist/crypton/browser
```

(The build prints one warning about a `tsconfig.json` it cannot resolve. It comes from the TypeScript
sources RxJS ships inside `node_modules`, not from this project, and is safe to ignore.)

The output is static files. Serve them from any web server, with two rules:

1. Unknown paths fall back to `index.html` (it is a single-page app).
2. `/api` is proxied to the Crypton API on the same origin, so the refresh cookie is first-party.

`Dockerfile` and `nginx.conf` in this repository do exactly that: the image builds the app and serves it with
nginx on port 8080, forwarding `/api` to the host named in `API_HOST` (default `api:8080`). The backend
repository's `docker-compose.yml` builds this image alongside the API, the database and Mailpit.

> Docker was not available on the machine this was built on, so the image has not been built end to end.

CI (`.github/workflows/ci.yml`) installs dependencies, runs the unit tests, builds production, uploads the
build, and builds the Docker image. The end-to-end suite is not run in CI because it needs the API and a
database; run it locally or from the compose stack.
