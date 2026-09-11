import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/admin-api.service';
import { TreasuryAsset } from '../../core/admin-models';
import { AuthService } from '../../core/auth.service';
import { lt, sub } from '../../core/decimal';
import { formatAsset, shortAddress } from '../../core/format';
import { parseAmount } from '../../core/forms';
import { AssetCode, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { AssetMark } from '../../ui/asset-mark';
import { CopyButton } from '../../ui/copy-button';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { adminTableStyles } from './admin-shared';

@Component({
  selector: 'cx-admin-treasury',
  imports: [AssetMark, CopyButton, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    adminTableStyles,
    `
      .assets {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-5);
      }

      .asset-head {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .form {
        display: grid;
        grid-template-columns: 7rem minmax(0, 1fr) minmax(0, 1fr);
        gap: var(--space-3);
      }

      @media (max-width: 900px) {
        .assets,
        .form {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Treasury</h1>
          <p class="lede">Ledger view of what Crypton holds per asset, against what users own. Reconcile custody with on-chain and bank balances regularly.</p>
        </div>
        <button type="button" class="btn btn--sm" [attr.aria-busy]="loading()" (click)="load()"><cx-icon name="refresh" [size]="16" />Refresh</button>
      </header>

      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      }

      <div class="assets">
        @for (a of assets(); track a.asset) {
          <section class="panel" [attr.aria-labelledby]="'treasury-' + a.asset">
            <div class="panel__header">
              <div class="asset-head">
                <cx-asset-mark [asset]="a.asset" [size]="28" />
                <h2 class="panel__title" [id]="'treasury-' + a.asset">{{ a.asset }}</h2>
              </div>
              @if (negative(a)) {
                <span class="status status--bad">House position negative</span>
              }
            </div>
            <div class="panel__body stack">
              <div class="kv">
                <div class="kv__row"><span class="kv__key">Held in custody</span><span class="kv__value figure">{{ fmt(a.custodyHeld, a.asset) }}</span></div>
                <div class="kv__row"><span class="kv__key">Treasury inventory (for instant trades)</span><span class="kv__value figure">{{ fmt(a.treasuryInventory, a.asset) }}</span></div>
                <div class="kv__row"><span class="kv__key">User balances, available</span><span class="kv__value figure">{{ fmt(a.userAvailable, a.asset) }}</span></div>
                <div class="kv__row"><span class="kv__key">User balances, on hold</span><span class="kv__value figure">{{ fmt(a.userLocked, a.asset) }}</span></div>
                <div class="kv__row"><span class="kv__key">P2P escrow</span><span class="kv__value figure">{{ fmt(a.p2PEscrow, a.asset) }}</span></div>
                <div class="kv__row"><span class="kv__key">Pending withdrawals</span><span class="kv__value figure">{{ fmt(a.pendingWithdrawals, a.asset) }}</span></div>
                <div class="kv__row"><span class="kv__key">Fees earned</span><span class="kv__value figure">{{ fmt(a.feesEarned, a.asset) }}</span></div>
                <div class="kv__row"><span class="kv__key">Network fees paid</span><span class="kv__value figure">{{ fmt(a.networkFeesPaid, a.asset) }}</span></div>
                @if (a.asset === 'NGN') {
                  <div class="kv__row"><span class="kv__key">Payment provider costs</span><span class="kv__value figure">{{ fmt(a.paymentCosts, a.asset) }}</span></div>
                }
                <div class="kv__row"><span class="kv__key">Manual adjustments</span><span class="kv__value figure">{{ fmt(a.adjustments, a.asset) }}</span></div>
              </div>
              <div class="kv kv--total">
                <div class="kv__row"><span class="kv__key">House position (custody minus user funds and escrow)</span><span class="kv__value figure">{{ fmt(house(a), a.asset) }}</span></div>
              </div>
              @if (a.asset !== 'NGN') {
                <div class="kv">
                  <div class="kv__row">
                    <span class="kv__key">Hot wallet</span>
                    <span class="kv__value">
                      @if (a.hotWalletAddress) {
                        <span class="mono">{{ short(a.hotWalletAddress) }}</span><cx-copy [value]="a.hotWalletAddress" what="hot wallet address" />
                      } @else {
                        Not configured
                      }
                    </span>
                  </div>
                  <div class="kv__row">
                    <span class="kv__key">On-chain balance</span>
                    <span class="kv__value figure">{{ a.hotWalletBalance !== null ? fmt(a.hotWalletBalance, a.asset) : a.hotWalletError ?? '–' }}</span>
                  </div>
                </div>
              }
            </div>
          </section>
        } @empty {
          @if (loading()) {
            <span class="skeleton" style="height: 18rem"></span>
          }
        }
      </div>

      @if (auth.isAdmin()) {
        <section class="panel" aria-labelledby="fund-title">
          <div class="panel__header"><h2 class="panel__title" id="fund-title">Record treasury movement</h2></div>
          <div class="panel__body stack">
            <p class="caption">Records crypto or naira moved into or out of company custody, for example a top-up from cold storage. Each reference can be used once.</p>
            <div class="form">
              <select class="select" aria-label="Asset" [value]="asset()" (change)="asset.set($any($event.target).value)">
                @for (code of codes; track code) {
                  <option [value]="code" [selected]="code === asset()">{{ code }}</option>
                }
              </select>
              <input class="input" aria-label="Amount" inputmode="decimal" placeholder="Amount" [value]="amount()" (input)="amount.set($any($event.target).value)" />
              <input class="input" aria-label="Reference" maxlength="100" placeholder="Reference (tx hash or bank ref)" [value]="reference()" (input)="reference.set($any($event.target).value)" />
            </div>
            <input class="input" aria-label="Note" maxlength="500" placeholder="Note" [value]="note()" (input)="note.set($any($event.target).value)" />
            <div class="row">
              <button type="button" class="btn btn--primary" [disabled]="!valid() || !!busy()" [attr.aria-busy]="busy() === 'fund'" (click)="move(false)">Add to treasury</button>
              <button type="button" class="btn" [disabled]="!valid() || !!busy()" [attr.aria-busy]="busy() === 'defund'" (click)="move(true)">Remove from treasury</button>
            </div>
          </div>
        </section>
      }
    </div>
  `,
})
export class AdminTreasury implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);
  protected readonly auth = inject(AuthService);

  protected readonly codes: AssetCode[] = ['NGN', 'BTC', 'ETH', 'USDT'];
  protected readonly assets = signal<TreasuryAsset[]>([]);
  protected readonly loading = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly busy = signal<'fund' | 'defund' | null>(null);
  protected readonly asset = signal<AssetCode>('USDT');
  protected readonly amount = signal('');
  protected readonly reference = signal('');
  protected readonly note = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.treasury(true).subscribe({
      next: (assets) => {
        this.loading.set(false);
        this.assets.set(assets);
        this.problem.set(null);
      },
      error: (e: unknown) => {
        this.loading.set(false);
        this.problem.set(toProblem(e));
      },
    });
  }

  valid(): boolean {
    const amount = parseAmount(this.amount());
    return !!amount && Number(amount) > 0 && !!this.reference().trim() && !!this.note().trim();
  }

  async move(defund: boolean): Promise<void> {
    const amount = parseAmount(this.amount());
    if (!amount) {
      return;
    }

    const ok = await this.dialogs.confirm({
      title: `${defund ? 'Remove' : 'Add'} ${formatAsset(amount, this.asset(), { full: true })}?`,
      body: `Reference ${this.reference().trim()}. This posts to the ledger immediately.`,
      confirmLabel: defund ? 'Remove from treasury' : 'Add to treasury',
      tone: defund ? 'danger' : 'primary',
    });
    if (!ok) {
      return;
    }

    const body = { asset: this.asset(), amount, reference: this.reference().trim(), note: this.note().trim() };
    this.busy.set(defund ? 'defund' : 'fund');
    (defund ? this.api.defundTreasury(body) : this.api.fundTreasury(body)).subscribe({
      next: () => {
        this.busy.set(null);
        this.amount.set('');
        this.reference.set('');
        this.note.set('');
        this.toast.success('Treasury updated');
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.toast.error(error);
      },
    });
  }

  /** Ledger custody minus everything owed to users. Negative means fees and costs exceed house funds. */
  protected house(a: TreasuryAsset): string {
    return sub(sub(sub(a.custodyHeld, a.userAvailable), a.userLocked), a.p2PEscrow);
  }

  protected negative(a: TreasuryAsset): boolean {
    return lt(this.house(a), '0');
  }

  protected fmt(value: string, code: AssetCode): string {
    return formatAsset(value, code, { full: true });
  }

  protected short(value: string): string {
    return shortAddress(value, 10, 8);
  }
}
