import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'cx-copy',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn btn--quiet btn--sm" [class.btn--icon]="!label()" (click)="copy()" [attr.aria-label]="label() ? null : 'Copy ' + what()">
      <cx-icon [name]="copied() ? 'check' : 'copy'" [size]="16" />
      @if (label()) {
        <span>{{ copied() ? 'Copied' : label() }}</span>
      }
    </button>
    <span class="sr-only" aria-live="polite">{{ copied() ? what() + ' copied' : '' }}</span>
  `,
})
export class CopyButton {
  readonly value = input.required<string>();
  readonly label = input<string | null>(null);
  readonly what = input('value');
  protected readonly copied = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  async copy(): Promise<void> {
    const text = this.value();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }

    this.copied.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.copied.set(false), 1600);
  }
}
