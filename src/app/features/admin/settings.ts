import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminApi } from '../../core/admin-api.service';
import { AdminSettings, AssetUpdate, FiatSettings, KycLimitSettings, P2PSettings, TradingSettings, WithdrawalSettings } from '../../core/admin-models';
import { AuthService } from '../../core/auth.service';
import { Asset, KycTierLimits, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { MarketService } from '../../core/market.service';
import { Icon } from '../../ui/icon';

type SectionKey = 'trading' | 'withdrawals' | 'fiat' | 'p2P';
type FieldType = 'int' | 'decimal' | 'bool' | 'intList';

interface Field {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
}

interface Section {
  key: SectionKey;
  title: string;
  description: string;
  fields: Field[];
}

const SECTIONS: Section[] = [
  {
    key: 'trading',
    title: 'Instant trading',
    description: 'Fees and spread for buy, sell and swap against the treasury. 100 basis points = 1%.',
    fields: [
      { key: 'buyFeeBps', label: 'Buy fee (bps)', type: 'int' },
      { key: 'sellFeeBps', label: 'Sell fee (bps)', type: 'int' },
      { key: 'swapFeeBps', label: 'Swap fee (bps)', type: 'int' },
      { key: 'spreadBps', label: 'Spread (bps)', type: 'int', hint: 'Added to buys and taken from sells.' },
      { key: 'quoteTtlSeconds', label: 'Quote lifetime (seconds)', type: 'int' },
      { key: 'maxPriceAgeSeconds', label: 'Max price age (seconds)', type: 'int', hint: 'Quotes stop when prices are older.' },
      { key: 'minOrderNgn', label: 'Minimum order (₦)', type: 'decimal' },
      { key: 'maxOrderNgn', label: 'Maximum order (₦)', type: 'decimal' },
    ],
  },
  {
    key: 'withdrawals',
    title: 'Withdrawals',
    description: 'Security and review rules for crypto and naira withdrawals.',
    fields: [
      { key: 'requireTwoFactor', label: 'Require two-factor authentication', type: 'bool' },
      { key: 'securityLockHours', label: 'Pause after security changes (hours)', type: 'int' },
      { key: 'manualReviewAboveNgn', label: 'Manual review above (₦)', type: 'decimal' },
      { key: 'fiatWithdrawalFeeNgn', label: 'Naira withdrawal fee (₦)', type: 'decimal' },
      { key: 'minFiatWithdrawalNgn', label: 'Minimum naira withdrawal (₦)', type: 'decimal' },
      { key: 'maxFiatWithdrawalNgn', label: 'Maximum naira withdrawal (₦)', type: 'decimal' },
    ],
  },
  {
    key: 'fiat',
    title: 'Naira deposits',
    description: 'Fees charged to users on card and transfer deposits.',
    fields: [
      { key: 'depositFeeBps', label: 'Deposit fee (bps)', type: 'int' },
      { key: 'depositFeeCapNgn', label: 'Fee cap (₦)', type: 'decimal' },
      { key: 'minDepositNgn', label: 'Minimum deposit (₦)', type: 'decimal' },
      { key: 'maxDepositNgn', label: 'Maximum deposit (₦)', type: 'decimal' },
    ],
  },
  {
    key: 'p2P',
    title: 'P2P marketplace',
    description: 'Maker fees, payment windows and dispute timing.',
    fields: [
      { key: 'makerFeeBps', label: 'Maker fee (bps)', type: 'int' },
      { key: 'paymentWindowsMinutes', label: 'Payment windows (minutes)', type: 'intList', hint: 'Comma separated, e.g. 15, 30, 45, 60' },
      { key: 'disputeAfterMinutes', label: 'Disputes open after (minutes)', type: 'int' },
      { key: 'maxOpenOrdersPerUser', label: 'Max open orders per user', type: 'int' },
      { key: 'minKycTier', label: 'Minimum verification level', type: 'int' },
      { key: 'maxFloatingMarginBps', label: 'Max price margin (bps)', type: 'int' },
      { key: 'minOrderFiat', label: 'Smallest allowed order limit (₦)', type: 'decimal' },
    ],
  },
];

@Component({
  selector: 'cx-admin-settings',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .fields {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4) var(--space-5);
    }

    .input {
      max-width: 20rem;
    }

    .tiers td .input {
      min-width: 8rem;
      min-height: 2.25rem;
    }

    .assets td .input {
      min-width: 7rem;
      min-height: 2.25rem;
    }

    @media (max-width: 800px) {
      .fields {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Settings</h1>
          <p class="lede">Changes apply within a minute and are recorded in the audit log.</p>
        </div>
      </header>

      @if (!auth.isAdmin()) {
        <div class="notice"><cx-icon name="lock" [size]="18" /><span>Only admins can change settings. You can view them.</span></div>
      }
      @if (loadProblem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      }

      @if (drafts(); as d) {
        @for (section of sections; track section.key) {
          <section class="panel" [attr.aria-labelledby]="'s-' + section.key">
            <div class="panel__header">
              <div>
                <h2 class="panel__title" [id]="'s-' + section.key">{{ section.title }}</h2>
                <p class="caption">{{ section.description }}</p>
              </div>
            </div>
            <div class="panel__body stack">
              <div class="fields">
                @for (field of section.fields; track field.key) {
                  @if (field.type === 'bool') {
                    <label class="checkbox" style="align-self: end">
                      <input type="checkbox" [checked]="!!value(section.key, field.key)" [disabled]="!auth.isAdmin()" (change)="set(section.key, field.key, $any($event.target).checked)" />
                      {{ field.label }}
                    </label>
                  } @else {
                    <label class="field">
                      <span class="field__label">{{ field.label }}</span>
                      <input class="input" [attr.inputmode]="field.type === 'decimal' ? 'decimal' : 'numeric'" [value]="display(section.key, field)" [disabled]="!auth.isAdmin()" (input)="setText(section.key, field, $any($event.target).value)" />
                      @if (field.hint) {
                        <span class="field__hint">{{ field.hint }}</span>
                      }
                    </label>
                  }
                }
              </div>
              @if (problems()[section.key]; as p) {
                <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
              }
            </div>
            @if (auth.isAdmin()) {
              <div class="panel__footer">
                <button type="button" class="btn btn--primary" [disabled]="!dirty()[section.key] || saving() === section.key" [attr.aria-busy]="saving() === section.key" (click)="save(section.key)">Save {{ section.title.toLowerCase() }}</button>
              </div>
            }
          </section>
        }

        <section class="panel" aria-labelledby="tiers-title">
          <div class="panel__header">
            <div>
              <h2 class="panel__title" id="tiers-title">Verification levels and daily limits</h2>
              <p class="caption">Daily limits in naira. 0 means the activity is not allowed at that level.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table tiers">
              <thead><tr><th scope="col">Level</th><th scope="col">Name</th><th scope="col">Naira</th><th scope="col">P2P</th><th scope="col">Naira deposits</th><th scope="col">Naira withdrawals</th><th scope="col">Crypto withdrawals</th><th scope="col">Trading</th></tr></thead>
              <tbody>
                @for (tier of tiers(); track tier.tier; let i = $index) {
                  <tr>
                    <td>{{ tier.tier }}</td>
                    <td><input class="input" [value]="tier.name" [disabled]="!auth.isAdmin()" (input)="setTier(i, { name: $any($event.target).value })" /></td>
                    <td><input type="checkbox" [checked]="tier.fiatEnabled" [disabled]="!auth.isAdmin()" (change)="setTier(i, { fiatEnabled: $any($event.target).checked })" [attr.aria-label]="'Naira enabled for level ' + tier.tier" /></td>
                    <td><input type="checkbox" [checked]="tier.p2PEnabled" [disabled]="!auth.isAdmin()" (change)="setTier(i, { p2PEnabled: $any($event.target).checked })" [attr.aria-label]="'P2P enabled for level ' + tier.tier" /></td>
                    <td><input class="input" inputmode="decimal" [value]="tier.dailyFiatDepositNgn" [disabled]="!auth.isAdmin()" (input)="setTier(i, { dailyFiatDepositNgn: clean($any($event.target).value) })" /></td>
                    <td><input class="input" inputmode="decimal" [value]="tier.dailyFiatWithdrawalNgn" [disabled]="!auth.isAdmin()" (input)="setTier(i, { dailyFiatWithdrawalNgn: clean($any($event.target).value) })" /></td>
                    <td><input class="input" inputmode="decimal" [value]="tier.dailyCryptoWithdrawalNgn" [disabled]="!auth.isAdmin()" (input)="setTier(i, { dailyCryptoWithdrawalNgn: clean($any($event.target).value) })" /></td>
                    <td><input class="input" inputmode="decimal" [value]="tier.dailyTradeNgn" [disabled]="!auth.isAdmin()" (input)="setTier(i, { dailyTradeNgn: clean($any($event.target).value) })" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (problems()['tiers']; as p) {
            <div class="panel__body"><div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div></div>
          }
          @if (auth.isAdmin()) {
            <div class="panel__footer">
              <button type="button" class="btn btn--primary" [disabled]="!dirty()['tiers'] || saving() === 'tiers'" [attr.aria-busy]="saving() === 'tiers'" (click)="saveTiers()">Save limits</button>
            </div>
          }
        </section>

        <section class="panel" aria-labelledby="assets-title">
          <div class="panel__header">
            <div>
              <h2 class="panel__title" id="assets-title">Assets</h2>
              <p class="caption">Pause deposits, withdrawals or trading per asset, and set on-chain minimums and fees.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table assets">
              <thead><tr><th scope="col">Asset</th><th scope="col">Min deposit</th><th scope="col">Min withdrawal</th><th scope="col">Withdrawal fee</th><th scope="col">Confirmations</th><th scope="col">Deposits</th><th scope="col">Withdrawals</th><th scope="col">Trading</th><th scope="col"><span class="sr-only">Save</span></th></tr></thead>
              <tbody>
                @for (a of assets(); track a.code; let i = $index) {
                  <tr>
                    <td><strong>{{ a.code }}</strong></td>
                    <td><input class="input" inputmode="decimal" [value]="a.minDeposit" [disabled]="!auth.isAdmin()" (input)="setAsset(i, { minDeposit: clean($any($event.target).value) })" /></td>
                    <td><input class="input" inputmode="decimal" [value]="a.minWithdrawal" [disabled]="!auth.isAdmin()" (input)="setAsset(i, { minWithdrawal: clean($any($event.target).value) })" /></td>
                    <td><input class="input" inputmode="decimal" [value]="a.withdrawalFee" [disabled]="!auth.isAdmin()" (input)="setAsset(i, { withdrawalFee: clean($any($event.target).value) })" /></td>
                    <td><input class="input" inputmode="numeric" [value]="a.requiredConfirmations" [disabled]="!auth.isAdmin() || a.isFiat" (input)="setAsset(i, { requiredConfirmations: toInt($any($event.target).value) })" /></td>
                    <td><input type="checkbox" [checked]="a.depositsEnabled" [disabled]="!auth.isAdmin()" (change)="setAsset(i, { depositsEnabled: $any($event.target).checked })" [attr.aria-label]="a.code + ' deposits enabled'" /></td>
                    <td><input type="checkbox" [checked]="a.withdrawalsEnabled" [disabled]="!auth.isAdmin()" (change)="setAsset(i, { withdrawalsEnabled: $any($event.target).checked })" [attr.aria-label]="a.code + ' withdrawals enabled'" /></td>
                    <td><input type="checkbox" [checked]="a.tradingEnabled" [disabled]="!auth.isAdmin()" (change)="setAsset(i, { tradingEnabled: $any($event.target).checked })" [attr.aria-label]="a.code + ' trading enabled'" /></td>
                    <td class="end">
                      @if (auth.isAdmin()) {
                        <button type="button" class="btn btn--sm" [disabled]="!dirtyAssets().includes(a.code) || saving() === a.code" [attr.aria-busy]="saving() === a.code" (click)="saveAsset(a)">Save</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else if (!loadProblem()) {
        <span class="skeleton" style="height: 24rem"></span>
      }
    </div>
  `,
})
export class AdminSettingsPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly market = inject(MarketService);
  protected readonly auth = inject(AuthService);

  protected readonly sections = SECTIONS;
  protected readonly drafts = signal<Record<SectionKey, Record<string, unknown>> | null>(null);
  protected readonly tiers = signal<KycTierLimits[]>([]);
  protected readonly assets = signal<Asset[]>([]);
  protected readonly dirty = signal<Record<string, boolean>>({});
  protected readonly dirtyAssets = signal<string[]>([]);
  protected readonly problems = signal<Record<string, Problem | null>>({});
  protected readonly loadProblem = signal<Problem | null>(null);
  protected readonly saving = signal<string | null>(null);

  ngOnInit(): void {
    this.api.settings().subscribe({ next: (s) => this.fill(s), error: (e: unknown) => this.loadProblem.set(toProblem(e)) });
    this.api.assets().subscribe({ next: (a) => this.assets.set(a), error: () => undefined });
  }

  value(section: SectionKey, key: string): unknown {
    return this.drafts()?.[section][key];
  }

  display(section: SectionKey, field: Field): string {
    const value = this.value(section, field.key);
    return Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }

  set(section: SectionKey, key: string, value: unknown): void {
    this.drafts.update((d) => (d ? { ...d, [section]: { ...d[section], [key]: value } } : d));
    this.dirty.update((flags) => ({ ...flags, [section]: true }));
  }

  setText(section: SectionKey, field: Field, text: string): void {
    const cleaned = text.replace(/,(?=\d{3})/g, '').trim();
    switch (field.type) {
      case 'int':
        this.set(section, field.key, cleaned === '' ? null : Number.parseInt(cleaned, 10));
        break;
      case 'intList':
        this.set(
          section,
          field.key,
          text
            .split(/[,\s]+/)
            .map((part) => Number.parseInt(part, 10))
            .filter((n) => Number.isFinite(n)),
        );
        break;
      default:
        this.set(section, field.key, cleaned);
    }
  }

  save(section: SectionKey): void {
    const draft = this.drafts()?.[section];
    if (!draft) {
      return;
    }

    const requests: Record<SectionKey, () => Observable<unknown>> = {
      trading: () => this.api.saveTrading(draft as unknown as TradingSettings),
      withdrawals: () => this.api.saveWithdrawals(draft as unknown as WithdrawalSettings),
      fiat: () => this.api.saveFiat(draft as unknown as FiatSettings),
      p2P: () => this.api.saveP2P(draft as unknown as P2PSettings),
    };

    this.saving.set(section);
    this.problems.update((p) => ({ ...p, [section]: null }));
    requests[section]().subscribe({
      next: (saved) => {
        this.saving.set(null);
        this.drafts.update((d) => (d ? { ...d, [section]: saved as Record<string, unknown> } : d));
        this.dirty.update((flags) => ({ ...flags, [section]: false }));
        this.toast.success('Settings saved');
      },
      error: (e: unknown) => {
        this.saving.set(null);
        this.problems.update((p) => ({ ...p, [section]: toProblem(e) }));
      },
    });
  }

  setTier(index: number, patch: Partial<KycTierLimits>): void {
    this.tiers.update((tiers) => tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    this.dirty.update((flags) => ({ ...flags, tiers: true }));
  }

  saveTiers(): void {
    const value: KycLimitSettings = { tiers: this.tiers() };
    this.saving.set('tiers');
    this.problems.update((p) => ({ ...p, tiers: null }));
    this.api.saveKycLimits(value).subscribe({
      next: (saved) => {
        this.saving.set(null);
        this.tiers.set(saved.tiers);
        this.dirty.update((flags) => ({ ...flags, tiers: false }));
        this.toast.success('Limits saved');
      },
      error: (e: unknown) => {
        this.saving.set(null);
        this.problems.update((p) => ({ ...p, tiers: toProblem(e) }));
      },
    });
  }

  setAsset(index: number, patch: Partial<Asset>): void {
    const code = this.assets()[index]?.code;
    this.assets.update((list) => list.map((a, i) => (i === index ? { ...a, ...patch } : a)));
    if (code && !this.dirtyAssets().includes(code)) {
      this.dirtyAssets.update((codes) => [...codes, code]);
    }
  }

  saveAsset(asset: Asset): void {
    const body: AssetUpdate = {
      minDeposit: asset.minDeposit,
      minWithdrawal: asset.minWithdrawal,
      withdrawalFee: asset.withdrawalFee,
      requiredConfirmations: asset.requiredConfirmations,
      depositsEnabled: asset.depositsEnabled,
      withdrawalsEnabled: asset.withdrawalsEnabled,
      tradingEnabled: asset.tradingEnabled,
    };
    this.saving.set(asset.code);
    this.api.updateAsset(asset.code, body).subscribe({
      next: (saved) => {
        this.saving.set(null);
        this.assets.update((list) => list.map((a) => (a.code === saved.code ? saved : a)));
        this.dirtyAssets.update((codes) => codes.filter((c) => c !== saved.code));
        this.market.loadAssets(true);
        this.toast.success(`${saved.code} updated`);
      },
      error: (e: unknown) => {
        this.saving.set(null);
        this.toast.error(e);
      },
    });
  }

  protected clean(value: string): string {
    return value.replace(/,/g, '').trim();
  }

  protected toInt(value: string): number {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : 0;
  }

  private fill(settings: AdminSettings): void {
    this.drafts.set({
      trading: { ...settings.trading },
      withdrawals: { ...settings.withdrawals },
      fiat: { ...settings.fiat },
      p2P: { ...settings.p2P },
    });
    this.tiers.set(settings.kycLimits.tiers);
  }
}
