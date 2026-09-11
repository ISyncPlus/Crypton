import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from './api.service';
import { Asset, AssetCode, ChainNetwork, Price } from './models';

const PRICE_POLL_MS = 30_000;

/** Asset catalogue and live naira prices, shared by the whole app. */
@Injectable({ providedIn: 'root' })
export class MarketService {
  private readonly api = inject(Api);
  private timer: ReturnType<typeof setInterval> | null = null;
  private assetsLoaded = false;

  readonly assets = signal<Asset[]>([]);
  readonly networks = signal<ChainNetwork[]>([]);
  readonly prices = signal<Price[]>([]);
  readonly pricesError = signal(false);
  readonly lastUpdated = signal<string | null>(null);

  readonly cryptoAssets = computed(() => this.assets().filter((asset) => !asset.isFiat));
  readonly priceMap = computed(() => {
    const map = new Map<AssetCode, Price>();
    for (const price of this.prices()) {
      map.set(price.asset, price);
    }

    return map;
  });

  start(): void {
    if (this.timer) {
      return;
    }

    this.loadAssets();
    this.loadPrices();
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.loadPrices();
      }
    }, PRICE_POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.loadPrices();
      }
    });
  }

  asset(code: AssetCode): Asset | undefined {
    return this.assets().find((asset) => asset.code === code);
  }

  network(name: string | null | undefined): ChainNetwork | undefined {
    return this.networks().find((n) => n.network === name);
  }

  /** Block explorer link for a transaction, or null when the network has no public explorer (simulation). */
  txUrl(network: string | null | undefined, txHash: string | null | undefined): string | null {
    const template = this.network(network)?.txUrlTemplate;
    return template && txHash ? template.replace('{txid}', encodeURIComponent(txHash)) : null;
  }

  addressUrl(network: string | null | undefined, address: string | null | undefined): string | null {
    const template = this.network(network)?.addressUrlTemplate;
    return template && address ? template.replace('{address}', encodeURIComponent(address)) : null;
  }

  price(code: AssetCode): Price | undefined {
    return this.priceMap().get(code);
  }

  loadAssets(force = false): void {
    if (this.assetsLoaded && !force) {
      return;
    }

    this.api.assets().subscribe({
      next: (assets) => {
        this.assetsLoaded = true;
        this.assets.set(assets);
      },
      error: () => (this.assetsLoaded = false),
    });
    this.api.networks().subscribe({ next: (networks) => this.networks.set(networks), error: () => undefined });
  }

  loadPrices(): void {
    this.api.prices().subscribe({
      next: (prices) => {
        this.prices.set(prices);
        this.pricesError.set(false);
        this.lastUpdated.set(new Date().toISOString());
      },
      error: () => this.pricesError.set(true),
    });
  }
}
