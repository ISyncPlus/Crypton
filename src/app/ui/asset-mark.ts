import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AssetCode } from '../core/models';

const MARKS: Record<AssetCode, { glyph: string; tone: string }> = {
  BTC: { glyph: '₿', tone: 'btc' },
  ETH: { glyph: 'Ξ', tone: 'eth' },
  USDT: { glyph: '₮', tone: 'usdt' },
  NGN: { glyph: '₦', tone: 'ngn' },
};

/** Typographic asset marks (currency signs, not brand logos). */
@Component({
  selector: 'cx-asset-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'mark().tone', '[style.--size]': "size() + 'px'", 'aria-hidden': 'true' },
  styles: `
    :host {
      display: inline-grid;
      flex: none;
      place-items: center;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      font-size: calc(var(--size) * 0.5);
      font-weight: 650;
      line-height: 1;
    }

    :host([data-tone='btc']) {
      background: var(--signal-soft);
      color: var(--signal-text);
    }

    :host([data-tone='eth']) {
      background: var(--info-soft);
      color: var(--info);
    }

    :host([data-tone='usdt']) {
      background: var(--up-soft);
      color: var(--up);
    }

    :host([data-tone='ngn']) {
      background: var(--dye);
      color: var(--dye-ink);
    }
  `,
  template: `{{ mark().glyph }}`,
})
export class AssetMark {
  readonly asset = input.required<AssetCode>();
  readonly size = input(32);
  protected readonly mark = computed(() => MARKS[this.asset()] ?? { glyph: '?', tone: 'ngn' });
}
