import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as QRCode from 'qrcode';

@Component({
  selector: 'cx-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      width: var(--qr-size, 11rem);
      aspect-ratio: 1;
      max-width: 100%;
      padding: 0.6rem;
      border-radius: var(--radius-sm);
      background: #fff;
    }

    .qr :where(svg) {
      width: 100%;
      height: 100%;
    }
  `,
  template: `<div class="qr" [innerHTML]="svg()" role="img" [attr.aria-label]="label()"></div>`,
})
export class QrCode {
  private readonly sanitizer = inject(DomSanitizer);
  readonly value = input.required<string>();
  readonly label = input('QR code');
  protected readonly svg = signal<SafeHtml>('');

  constructor() {
    effect(() => {
      const value = this.value();
      QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#161a3aff', light: '#ffffffff' } })
        .then((markup) => this.svg.set(this.sanitizer.bypassSecurityTrustHtml(markup)))
        .catch(() => this.svg.set(''));
    });
  }
}
