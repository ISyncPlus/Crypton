import { Injectable, computed, signal } from '@angular/core';

/**
 * One shared one-second tick for countdowns. Deadlines come from the server, so countdowns use
 * server time (device clock plus the offset measured from API Date headers) to stay correct on
 * devices whose clocks are wrong.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  readonly now = signal(Date.now());
  private readonly offset = signal(0);
  readonly serverNow = computed(() => this.now() + this.offset());

  constructor() {
    setInterval(() => this.now.set(Date.now()), 1000);
  }

  /** Records the server's clock from an HTTP Date header (1 second resolution). */
  observeServerDate(header: string | null, requestStartedAt: number): void {
    if (!header) {
      return;
    }

    const server = Date.parse(header);
    if (Number.isNaN(server)) {
      return;
    }

    const midpoint = requestStartedAt + (Date.now() - requestStartedAt) / 2;
    const measured = server + 500 - midpoint;
    // Ignore sub-second noise; only correct clocks that are meaningfully off.
    this.offset.set(Math.abs(measured) < 1500 ? 0 : Math.round(measured));
  }

  serverTime(): number {
    return Date.now() + this.offset();
  }
}
