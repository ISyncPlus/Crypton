import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Api } from './api.service';
import { AuthService } from './auth.service';
import { AssetCode, Balance, WalletsResponse } from './models';

/** The signed-in user's balances. Pages call reload() after anything that moves money. */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);

  readonly data = signal<WalletsResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<unknown>(null);

  readonly balances = computed(() => this.data()?.balances ?? []);
  readonly total = computed(() => this.data()?.totalValueNgn ?? '0');

  constructor() {
    effect(() => {
      if (!this.auth.user()) {
        this.data.set(null);
      }
    });
  }

  balance(asset: AssetCode): Balance {
    return this.balances().find((b) => b.asset === asset) ?? { asset, available: '0', locked: '0', total: '0', valueNgn: '0' };
  }

  reload(): void {
    this.loading.set(true);
    this.api.wallets().subscribe({
      next: (data) => {
        this.data.set(data);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(error);
        this.loading.set(false);
      },
    });
  }

  ensureLoaded(): void {
    if (!this.data() && !this.loading()) {
      this.reload();
    }
  }
}
