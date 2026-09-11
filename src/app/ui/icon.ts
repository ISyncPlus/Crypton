import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Hand-drawn 24px stroke icons. Paths only, so they inherit currentColor.
const ICONS = {
  overview: 'M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z',
  trade: 'M7 4 3 8l4 4 M3 8h14 M17 20l4-4-4-4 M21 16H7',
  wallet: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3 M3 7.5V18a2 2 0 0 0 2 2h15V9H5.5A2.5 2.5 0 0 1 3 7.5Z M16.5 14.5h.01',
  people: 'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M3 20a5.5 5.5 0 0 1 11 0 M15.5 5.3a3 3 0 0 1 0 5.4 M17.5 14.6A5.5 5.5 0 0 1 21 20',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0',
  shield: 'M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6L12 3Z m-3 9 2 2 4-4',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z M10 19a2 2 0 0 0 4 0',
  sliders: 'M3 7h10 M19 7h2 M3 17h4 M13 17h8 M18.5 7a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z M12.5 17a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 16l-4-4 4-4 M6 12h10',
  copy: 'M9 9h10v11H9z M5 15V4h10',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12 M18 6 6 18',
  'chevron-right': 'm9 6 6 6-6 6',
  'chevron-left': 'm15 6-6 6 6 6',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-up': 'm6 15 6-6 6 6',
  'arrow-up': 'M12 19V5 M6 11l6-6 6 6',
  'arrow-down': 'M12 5v14 M6 13l6 6 6-6',
  'arrow-left': 'M19 12H5 M11 6l-6 6 6 6',
  'arrow-right': 'M5 12h14 M13 6l6 6-6 6',
  plus: 'M12 5v14 M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  bank: 'M3 9.5 12 4l9 5.5 M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 20h18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2',
  alert: 'M12 4 2.8 19.5h18.4L12 4Z M12 10v4 M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5 M12 8h.01',
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z M14 3v5h5',
  upload: 'M12 15V4 M7 9l5-5 5 5 M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  download: 'M12 4v11 M7 10l5 5 5-5 M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
  monitor: 'M3 5h18v11H3z M8 20h8 M12 16v4',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  key: 'M14.5 14a5 5 0 1 0-4.6-3.1L3 17.8V21h3.2l1.3-1.3v-2h2l1.4-1.4A5 5 0 0 0 14.5 14Z M16 8h.01',
  refresh: 'M20 11a8 8 0 0 0-14.5-4.6L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.5 4.6L20 16 M20 20v-4h-4',
  eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  scale: 'M12 4v16 M8 20h8 M5 8h14 M5 8l-3 6a3 3 0 0 0 6 0L5 8Z M19 8l-3 6a3 3 0 0 0 6 0l-3-6Z',
  chart: 'M4 20V4 M4 20h16 M8 16v-5 M12 16V8 M16 16v-3',
  list: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01',
  ledger: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z M5 17a3 3 0 0 1 3-3h11 M9 8h6',
  coins: 'M9 10c3.3 0 6-1.3 6-3s-2.7-3-6-3-6 1.3-6 3 2.7 3 6 3Z M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7 M15 11.2c3.1.2 6 1.5 6 2.8 0 1.7-2.7 3-6 3 M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-3',
  filter: 'M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 18h2v2h-2z M14 18h2 M18 14h2',
  receipt: 'M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z M9 8h6 M9 12h6 M9 16h3',
  id: 'M3 6h18v12H3z M8.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M5.5 16a3 3 0 0 1 6 0 M14 10h4 M14 13h4',
  mail: 'M3 6h18v12H3z M3 7l9 6 9-6',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M5.6 5.6l12.8 12.8',
  pause: 'M8 5v14 M16 5v14',
  play: 'M7 4.5v15L19 12 7 4.5Z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4',
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  'thumbs-up': 'M7 10v10H4V10h3Z M7 10l4-7a2 2 0 0 1 2.8 2.2L13 9h5.5a2 2 0 0 1 2 2.4l-1.6 7A2 2 0 0 1 17 20H7',
  'thumbs-down': 'M17 14V4h3v10h-3Z M17 14l-4 7a2 2 0 0 1-2.8-2.2L11 15H5.5a2 2 0 0 1-2-2.4l1.6-7A2 2 0 0 1 7 4h10',
  message: 'M4 5h16v11H9l-5 4V5Z',
  server: 'M4 4h16v6H4z M4 14h16v6H4z M8 7h.01 M8 17h.01',
  more: 'M6.25 12a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z M13.25 12a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z M20.25 12a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z',
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'cx-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cx-icon' },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
  `,
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="size()"
      [attr.height]="size()"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly stroke = input(1.75);
  protected readonly path = computed(() => ICONS[this.name()]);
}
