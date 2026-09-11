import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { ClockService } from '../core/clock.service';

export function remainingMs(deadline: string | null | undefined, now: number): number {
  return deadline ? Math.max(0, Date.parse(deadline) - now) : 0;
}

export function formatDuration(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(hours ? 2 : 1, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

@Component({
  selector: 'cx-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'timer', '[attr.aria-label]': 'label()' },
  template: `<span class="figure">{{ text() }}</span>`,
})
export class Countdown {
  private readonly clock = inject(ClockService);
  readonly deadline = input.required<string | null>();
  readonly expired = output<void>();

  private readonly ms = computed(() => remainingMs(this.deadline(), this.clock.serverNow()));
  protected readonly text = computed(() => formatDuration(this.ms()));
  protected readonly label = computed(() => `${this.text()} remaining`);
  private fired: string | null = null;

  constructor() {
    effect(() => {
      const deadline = this.deadline();
      if (deadline && this.ms() === 0 && this.fired !== deadline) {
        this.fired = deadline;
        this.expired.emit();
      }
    });
  }
}
