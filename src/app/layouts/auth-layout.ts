import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { changeLabel, formatRate } from '../core/format';
import { MarketService } from '../core/market.service';
import { AssetCode } from '../core/models';
import { ThemeService } from '../core/theme.service';
import { AssetMark } from '../ui/asset-mark';
import { Icon } from '../ui/icon';
import { Logo } from '../ui/logo';

@Component({
  selector: 'cx-auth-layout',
  imports: [RouterOutlet, RouterLink, Logo, AssetMark, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(22rem, 0.9fr) minmax(0, 1.1fr);
      min-height: 100dvh;
    }

    .brand {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-7);
      padding: var(--space-6) var(--space-7);
      background-color: var(--dye);
      background-image: var(--pattern);
      color: var(--dye-ink);
      overflow: hidden;
    }

    .brand a {
      color: inherit;
      text-decoration: none;
    }

    .pitch {
      display: grid;
      gap: var(--space-4);
      max-width: 30rem;
      margin-top: auto;
    }

    .pitch h1 {
      font-size: clamp(2rem, 3.4vw, 2.9rem);
      font-stretch: 118%;
      font-weight: 650;
      letter-spacing: -0.03em;
      line-height: 1.05;
    }

    .pitch p {
      max-width: 42ch;
      color: var(--dye-ink-2);
    }

    .board {
      border: 1px solid rgb(255 255 255 / 12%);
      border-radius: var(--radius);
      background: rgb(8 10 40 / 35%);
      backdrop-filter: blur(2px);
    }

    .board__head {
      display: flex;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      border-bottom: 1px solid rgb(255 255 255 / 10%);
      color: var(--dye-ink-2);
      font-size: var(--text-sm);
    }

    .board__row {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
    }

    .board__row + .board__row {
      border-top: 1px solid rgb(255 255 255 / 7%);
    }

    .board__name {
      display: grid;
      line-height: 1.2;
    }

    .board__name small {
      color: var(--dye-ink-2);
      font-size: var(--text-xs);
    }

    .board__price {
      font-size: var(--text-lg);
      font-stretch: 115%;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      text-align: right;
    }

    .board__change {
      min-width: 5.5rem;
      font-size: var(--text-sm);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .rise {
      color: #5fe0b0;
    }

    .fall {
      color: #ff9a8f;
    }

    .side {
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: var(--ground);
    }

    .side__top {
      display: flex;
      justify-content: flex-end;
      padding: var(--space-4) var(--space-5);
    }

    .side__main {
      display: grid;
      flex: 1;
      place-items: center;
      padding: var(--space-5) var(--space-5) var(--space-7);
    }

    .form-wrap {
      width: 100%;
      max-width: 25rem;
    }

    .mobile-logo {
      display: none;
    }

    @media (max-width: 900px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
      }

      .brand {
        display: none;
      }

      .side__top {
        justify-content: space-between;
      }

      .mobile-logo {
        display: inline-flex;
        text-decoration: none;
        color: var(--ink);
      }
    }
  `,
  template: `
    <aside class="brand">
      <a routerLink="/" aria-label="Crypton home"><cx-logo [size]="30" /></a>

      <div class="pitch">
        <h1>Buy, sell and trade crypto with naira.</h1>
        <p>Bitcoin, Ethereum and USDT in one wallet. Fund it in naira, trade person to person with escrow, and cash out to any Nigerian bank.</p>
      </div>

      <section class="board" aria-label="Current naira prices">
        <div class="board__head">
          <span>Rates now</span>
          <span>24h</span>
        </div>
        @for (row of rows(); track row.code) {
          <div class="board__row">
            <cx-asset-mark [asset]="row.code" [size]="30" />
            <div class="board__name">
              <strong>{{ row.code }}</strong>
              <small>{{ row.name }}</small>
            </div>
            <div class="board__price">{{ row.price }}</div>
            <div class="board__change" [class.rise]="row.direction > 0" [class.fall]="row.direction < 0">{{ row.change }}</div>
          </div>
        }
      </section>
    </aside>

    <main class="side">
      <div class="side__top">
        <a routerLink="/" class="mobile-logo" aria-label="Crypton home"><cx-logo [size]="26" /></a>
        <button type="button" class="btn btn--quiet btn--sm" (click)="theme.cycle()" [attr.aria-label]="'Theme: ' + theme.mode()">
          <cx-icon [name]="theme.mode() === 'dark' ? 'moon' : theme.mode() === 'light' ? 'sun' : 'monitor'" [size]="16" />
          <span>{{ theme.mode() === 'system' ? 'Auto' : theme.mode() === 'dark' ? 'Dark' : 'Light' }}</span>
        </button>
      </div>
      <div class="side__main">
        <div class="form-wrap">
          <router-outlet />
        </div>
      </div>
    </main>
  `,
})
export class AuthLayout {
  protected readonly theme = inject(ThemeService);
  private readonly market = inject(MarketService);

  protected readonly rows = computed(() => {
    const names: Record<string, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether USD' };
    return (['BTC', 'ETH', 'USDT'] as AssetCode[]).map((code) => {
      const price = this.market.price(code);
      const change = price?.change24hPercent ?? null;
      return {
        code,
        name: names[code],
        price: price ? formatRate(price.priceNgn) : '–',
        change: changeLabel(change),
        direction: change === null ? 0 : Math.sign(Number(change)),
      };
    });
  });
}
