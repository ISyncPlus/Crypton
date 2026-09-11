import { Injectable, signal } from '@angular/core';

/** One shared one-second tick for countdowns and relative times. */
@Injectable({ providedIn: 'root' })
export class ClockService {
  readonly now = signal(Date.now());

  constructor() {
    setInterval(() => this.now.set(Date.now()), 1000);
  }
}
