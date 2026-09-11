import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Usage meter: the fill carries severity, the track is a lighter step of the same hue. */
@Component({
  selector: 'cx-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'meter', '[attr.data-level]': 'level()', '[attr.aria-valuenow]': 'percent()', 'aria-valuemin': '0', 'aria-valuemax': '100', '[attr.aria-label]': 'label()' },
  styles: `
    :host {
      display: block;
      height: 6px;
      border-radius: var(--radius-pill);
      background: color-mix(in srgb, var(--tone) 18%, var(--surface));
      overflow: hidden;
      --tone: var(--series-1);
    }

    :host([data-level='warn']) {
      --tone: var(--warn);
    }

    :host([data-level='bad']) {
      --tone: var(--down);
    }

    .fill {
      height: 100%;
      border-radius: var(--radius-pill);
      background: var(--tone);
      transition: width var(--dur) var(--ease);
    }
  `,
  template: `<div class="fill" [style.width.%]="percent()"></div>`,
})
export class Meter {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  readonly label = input('Usage');

  protected readonly percent = computed(() => {
    const max = this.max();
    return max > 0 ? Math.max(0, Math.min(100, Math.round((this.value() / max) * 100))) : 0;
  });

  protected readonly level = computed(() => (this.percent() >= 90 ? 'bad' : this.percent() >= 70 ? 'warn' : 'ok'));
}
