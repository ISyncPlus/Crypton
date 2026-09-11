import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Crypton mark: a coin ring struck through twice, like the naira sign. */
@Component({
  selector: 'cx-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      color: inherit;
    }

    .word {
      font-size: 1.2rem;
      font-stretch: 125%;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1;
    }

    .tag {
      margin-left: 0.15rem;
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-sm);
      background: var(--signal);
      color: #1b1300;
      font-size: 0.6875rem;
      font-weight: 650;
      line-height: 1.3;
    }
  `,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" style="fill: var(--signal)" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#1b1300" stroke-width="3" />
      <path d="M5.5 13.25h21M5.5 18.75h21" stroke="#1b1300" stroke-width="2.2" stroke-linecap="round" />
    </svg>
    @if (wordmark()) {
      <span class="word">Crypton</span>
    }
    @if (tag()) {
      <span class="tag">{{ tag() }}</span>
    }
  `,
})
export class Logo {
  readonly size = input(28);
  readonly wordmark = input(true);
  readonly tag = input<string | null>(null);
}
