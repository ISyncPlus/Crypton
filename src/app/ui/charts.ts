import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

export interface SeriesPoint {
  t: number;
  v: number;
}

export interface BarDatum {
  label: string;
  value: number;
  title?: string;
}

/** Rounds a value up to a readable axis step (1, 2, 2.5, 5 x 10^n). */
export function niceStep(value: number): number {
  if (!(value > 0)) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * 10 ** exponent;
}

/** Clean tick values covering [min, max] with about `count` intervals. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1];
  }

  if (min === max) {
    const bump = Math.abs(min) * 0.01 || 1;
    min -= bump;
    max += bump;
  }

  const step = niceStep((max - min) / count);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) {
    ticks.push(Number(v.toPrecision(12)));
  }

  return ticks;
}

function useWidth(fallback: number) {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);
  const width = signal(fallback);
  const destroyRef = inject(DestroyRef);
  afterNextRender(() => {
    const element = host.nativeElement;
    width.set(Math.max(160, Math.round(element.clientWidth || fallback)));
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0 && next !== width()) {
        width.set(Math.max(160, next));
      }
    });
    observer.observe(element);
    destroyRef.onDestroy(() => observer.disconnect());
  });
  return width;
}

const chartStyles = `
  :host {
    position: relative;
    display: block;
    width: 100%;
    color: var(--ink-3);
  }

  .frame {
    position: relative;
    transition: opacity var(--dur) var(--ease);
  }

  .frame.is-loading {
    opacity: 0.45;
  }

  svg {
    display: block;
    overflow: visible;
    touch-action: pan-y;
  }

  svg:focus-visible {
    border-radius: var(--radius-sm);
  }

  .grid {
    stroke: var(--rule);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }

  .axis {
    fill: var(--ink-3);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .tip {
    position: absolute;
    top: 0;
    z-index: 1;
    display: grid;
    gap: 0.1rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--rule);
    border-radius: var(--radius-sm);
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    color: var(--ink-2);
    font-size: var(--text-xs);
    line-height: 1.35;
    white-space: nowrap;
    pointer-events: none;
    transform: translateX(-50%);
  }

  .tip strong {
    color: var(--ink);
    font-size: var(--text-sm);
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }

  .empty-chart {
    display: grid;
    place-items: center;
    min-height: 8rem;
    height: 100%;
    color: var(--ink-3);
    font-size: var(--text-sm);
  }

  details {
    margin-top: var(--space-2);
    font-size: var(--text-sm);
  }

  summary {
    width: max-content;
    color: var(--ink-3);
    cursor: pointer;
  }

  summary:hover {
    color: var(--ink);
  }

  .table-scroll {
    max-height: 14rem;
    margin-top: var(--space-2);
    overflow: auto;
    border: 1px solid var(--rule);
    border-radius: var(--radius-sm);
  }

  .table-scroll table {
    width: 100%;
    border-collapse: collapse;
  }

  .table-scroll th,
  .table-scroll td {
    padding: 0.35rem 0.75rem;
    border-bottom: 1px solid var(--rule);
    text-align: left;
    color: var(--ink-2);
  }

  .table-scroll th {
    position: sticky;
    top: 0;
    background: var(--surface-2);
    font-weight: 550;
  }

  .table-scroll td:last-child,
  .table-scroll th:last-child {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
`;

/** Single-series time line: right-hand value axis, snapping crosshair, keyboard read-out, table twin. */
@Component({
  selector: 'cx-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    chartStyles,
    `
      .line {
        fill: none;
        stroke: var(--series-1);
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
      }

      .area {
        fill: var(--series-1);
        opacity: 0.1;
      }

      .crosshair {
        stroke: var(--ink-3);
        stroke-width: 1;
      }

      .dot {
        fill: var(--series-1);
        stroke: var(--surface);
        stroke-width: 2;
      }
    `,
  ],
  template: `
    @if (points().length < 2) {
      <div class="empty-chart" [style.height.px]="height()">{{ emptyText() }}</div>
    } @else {
      <div class="frame" [class.is-loading]="loading()">
        <svg
          [attr.width]="width()"
          [attr.height]="height()"
          [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
          role="img"
          tabindex="0"
          [attr.aria-label]="ariaLabel()"
          (pointermove)="move($event)"
          (pointerleave)="hoverIndex.set(null)"
          (keydown)="key($event)"
          (blur)="hoverIndex.set(null)"
        >
          @for (tick of yTicks(); track tick.value) {
            <line class="grid" x1="0" [attr.x2]="plotRight()" [attr.y1]="tick.y" [attr.y2]="tick.y" />
            <text class="axis" [attr.x]="plotRight() + 8" [attr.y]="tick.y + 4">{{ tick.label }}</text>
          }
          @for (tick of xTicks(); track $index) {
            <text class="axis" [attr.x]="tick.x" [attr.y]="height() - 4" [attr.text-anchor]="tick.anchor">{{ tick.label }}</text>
          }
          <path class="area" [attr.d]="areaPath()" />
          <path class="line" [attr.d]="linePath()" />
          @if (hover(); as h) {
            <line class="crosshair" [attr.x1]="h.x" [attr.x2]="h.x" [attr.y1]="top" [attr.y2]="plotBottom()" />
            <circle class="dot" [attr.cx]="h.x" [attr.cy]="h.y" r="5" />
          } @else if (last(); as l) {
            <circle class="dot" [attr.cx]="l.x" [attr.cy]="l.y" r="5" />
          }
        </svg>
        @if (hover(); as h) {
          <div class="tip" [style.left.px]="clampTip(h.x)">
            <strong>{{ format()(h.v) }}</strong>
            <span>{{ fullTime(h.t) }}</span>
          </div>
        }
      </div>
      @if (table()) {
        <details>
          <summary>View as table</summary>
          <div class="table-scroll">
            <table>
              <thead>
                <tr><th scope="col">Time</th><th scope="col">{{ label() }}</th></tr>
              </thead>
              <tbody>
                @for (point of points(); track point.t) {
                  <tr><td>{{ fullTime(point.t) }}</td><td>{{ format()(point.v) }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </details>
      }
    }
  `,
})
export class LineChart {
  readonly points = input.required<SeriesPoint[]>();
  readonly height = input(220);
  readonly format = input<(value: number) => string>((value) => value.toLocaleString());
  readonly axisFormat = input<((value: number) => string) | null>(null);
  readonly label = input('Price');
  readonly emptyText = input('Not enough history yet.');
  readonly spanHours = input(24);
  readonly loading = input(false);
  readonly table = input(true);

  protected readonly width = useWidth(640);
  protected readonly hoverIndex = signal<number | null>(null);
  protected readonly top = 10;
  private readonly axisWidth = 72;
  private readonly bottomGutter = 24;

  protected readonly plotRight = computed(() => this.width() - this.axisWidth);
  protected readonly plotBottom = computed(() => this.height() - this.bottomGutter);

  private readonly ticks = computed(() => {
    const values = this.points().map((p) => p.v);
    return niceTicks(Math.min(...values), Math.max(...values), 3);
  });

  private readonly domain = computed(() => {
    const pts = this.points();
    const ticks = this.ticks();
    return { t0: pts[0]?.t ?? 0, t1: pts[pts.length - 1]?.t ?? 1, min: ticks[0], max: ticks[ticks.length - 1] };
  });

  private readonly coords = computed(() => {
    const { t0, t1, min, max } = this.domain();
    const right = this.plotRight();
    const bottom = this.plotBottom();
    const spanT = Math.max(1, t1 - t0);
    const spanV = Math.max(Number.EPSILON, max - min);
    return this.points().map((p) => ({
      x: ((p.t - t0) / spanT) * right,
      y: this.top + (1 - (p.v - min) / spanV) * (bottom - this.top),
      t: p.t,
      v: p.v,
    }));
  });

  protected readonly linePath = computed(() =>
    this.coords()
      .map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' '),
  );

  protected readonly areaPath = computed(() => {
    const coords = this.coords();
    const bottom = this.plotBottom();
    return coords.length ? `${this.linePath()} L${coords[coords.length - 1].x.toFixed(1)} ${bottom} L${coords[0].x.toFixed(1)} ${bottom} Z` : '';
  });

  protected readonly yTicks = computed(() => {
    const { min, max } = this.domain();
    const bottom = this.plotBottom();
    const fmt = this.axisFormat() ?? this.format();
    const span = Math.max(Number.EPSILON, max - min);
    return this.ticks().map((value) => ({ value, y: this.top + (1 - (value - min) / span) * (bottom - this.top), label: fmt(value) }));
  });

  protected readonly xTicks = computed(() => {
    const { t0, t1 } = this.domain();
    const right = this.plotRight();
    return [
      { x: 0, label: this.shortTime(t0), anchor: 'start' },
      { x: right / 2, label: this.shortTime((t0 + t1) / 2), anchor: 'middle' },
      { x: right, label: this.shortTime(t1), anchor: 'end' },
    ];
  });

  protected readonly hover = computed(() => {
    const index = this.hoverIndex();
    return index === null ? null : (this.coords()[index] ?? null);
  });

  protected readonly last = computed(() => {
    const coords = this.coords();
    return coords[coords.length - 1] ?? null;
  });

  protected readonly ariaLabel = computed(() => {
    const pts = this.points();
    const values = pts.map((p) => p.v);
    const fmt = this.format();
    return `${this.label()} over ${this.spanHours()} hours: opened ${fmt(pts[0].v)}, now ${fmt(pts[pts.length - 1].v)}, low ${fmt(Math.min(...values))}, high ${fmt(Math.max(...values))}. Use arrow keys to read points.`;
  });

  move(event: PointerEvent): void {
    const svg = event.currentTarget as SVGElement;
    const x = event.clientX - svg.getBoundingClientRect().left;
    const coords = this.coords();
    let best = 0;
    for (let i = 1; i < coords.length; i++) {
      if (Math.abs(coords[i].x - x) < Math.abs(coords[best].x - x)) {
        best = i;
      }
    }

    this.hoverIndex.set(best);
  }

  key(event: KeyboardEvent): void {
    const count = this.coords().length;
    const current = this.hoverIndex() ?? count - 1;
    const next = event.key === 'ArrowLeft' ? current - 1 : event.key === 'ArrowRight' ? current + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
    if (next !== null) {
      event.preventDefault();
      this.hoverIndex.set(Math.max(0, Math.min(count - 1, next)));
    }
  }

  clampTip(x: number): number {
    return Math.max(56, Math.min(this.width() - 56, x));
  }

  shortTime(t: number): string {
    const date = new Date(t);
    return this.spanHours() > 36
      ? date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
      : date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  }

  fullTime(t: number): string {
    return new Date(t).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}

/** Zero-based single-series columns: capped width, rounded data end, per-mark hover and keyboard read-out, table twin. */
@Component({
  selector: 'cx-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    chartStyles,
    `
      .bar {
        fill: var(--series-1);
      }

      .bar.is-active {
        fill: color-mix(in srgb, var(--series-1) 72%, #ffffff);
      }

      .hit {
        fill: transparent;
      }
    `,
  ],
  template: `
    @if (!hasData()) {
      <div class="empty-chart" [style.height.px]="height()">{{ emptyText() }}</div>
    } @else {
      <div class="frame" [class.is-loading]="loading()">
        <svg
          [attr.width]="width()"
          [attr.height]="height()"
          [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
          role="img"
          tabindex="0"
          [attr.aria-label]="ariaLabel()"
          (pointerleave)="activeIndex.set(null)"
          (keydown)="key($event)"
          (blur)="activeIndex.set(null)"
        >
          @for (tick of yTicks(); track tick.value) {
            <line class="grid" x1="0" [attr.x2]="plotRight()" [attr.y1]="tick.y" [attr.y2]="tick.y" />
            <text class="axis" [attr.x]="plotRight() + 8" [attr.y]="tick.y + 4">{{ tick.label }}</text>
          }
          @for (bar of bars(); track $index) {
            <path class="bar" [class.is-active]="activeIndex() === $index" [attr.d]="bar.path" />
            <rect class="hit" [attr.x]="bar.slotX" [attr.y]="top" [attr.width]="bar.slotW" [attr.height]="plotBottom() - top" (pointerenter)="activeIndex.set($index)" />
            @if (bar.showLabel) {
              <text class="axis" [attr.x]="bar.cx" [attr.y]="height() - 4" text-anchor="middle">{{ bar.label }}</text>
            }
          }
        </svg>
        @if (active(); as a) {
          <div class="tip" [style.left.px]="clampTip(a.cx)">
            <strong>{{ format()(a.value) }}</strong>
            <span>{{ a.title ?? a.label }}</span>
          </div>
        }
      </div>
      @if (table()) {
        <details>
          <summary>View as table</summary>
          <div class="table-scroll">
            <table>
              <thead>
                <tr><th scope="col">Day</th><th scope="col">{{ label() }}</th></tr>
              </thead>
              <tbody>
                @for (datum of data(); track $index) {
                  <tr><td>{{ datum.title ?? datum.label }}</td><td>{{ format()(datum.value) }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </details>
      }
    }
  `,
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly height = input(200);
  readonly format = input<(value: number) => string>((value) => value.toLocaleString());
  readonly axisFormat = input<((value: number) => string) | null>(null);
  readonly label = input('Value');
  readonly emptyText = input('No activity in this period.');
  readonly loading = input(false);
  readonly table = input(true);

  protected readonly width = useWidth(640);
  protected readonly activeIndex = signal<number | null>(null);
  protected readonly top = 10;

  protected readonly plotRight = computed(() => this.width() - 60);
  protected readonly plotBottom = computed(() => this.height() - 24);
  protected readonly hasData = computed(() => this.data().some((d) => d.value > 0));
  private readonly ticks = computed(() => niceTicks(0, Math.max(0, ...this.data().map((d) => d.value)), 2));
  private readonly max = computed(() => {
    const ticks = this.ticks();
    return ticks[ticks.length - 1] || 1;
  });

  protected readonly yTicks = computed(() => {
    const max = this.max();
    const fmt = this.axisFormat() ?? this.format();
    const bottom = this.plotBottom();
    return this.ticks().map((value) => ({ value, y: bottom - (value / max) * (bottom - this.top), label: fmt(value) }));
  });

  protected readonly bars = computed(() => {
    const data = this.data();
    const right = this.plotRight();
    const bottom = this.plotBottom();
    const slot = right / Math.max(1, data.length);
    const barWidth = Math.max(2, Math.min(24, slot - 2, slot * 0.7));
    const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(right / 64))));
    const max = this.max();
    return data.map((d, i) => {
      const h = (Math.max(0, d.value) / max) * (bottom - this.top);
      const x = i * slot + (slot - barWidth) / 2;
      const r = Math.min(4, barWidth / 2, h);
      const y = bottom - h;
      // Rounded data end, square at the baseline.
      const path =
        h <= 0
          ? ''
          : `M${x} ${bottom}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + barWidth - r}Q${x + barWidth} ${y} ${x + barWidth} ${y + r}V${bottom}Z`;
      return { ...d, path, cx: x + barWidth / 2, slotX: i * slot, slotW: slot, showLabel: i % every === 0 };
    });
  });

  protected readonly active = computed(() => {
    const index = this.activeIndex();
    return index === null ? null : (this.bars()[index] ?? null);
  });

  protected readonly ariaLabel = computed(() => {
    const data = this.data();
    const fmt = this.format();
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const peak = data.reduce((best, d) => (d.value > best.value ? d : best), data[0] ?? { label: '', value: 0 });
    return `${this.label()}: ${data.length} days, total ${fmt(total)}, highest ${fmt(peak.value)} on ${peak.title ?? peak.label}. Use arrow keys to read each day.`;
  });

  key(event: KeyboardEvent): void {
    const count = this.data().length;
    const current = this.activeIndex() ?? -1;
    const next = event.key === 'ArrowLeft' ? current - 1 : event.key === 'ArrowRight' ? current + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
    if (next !== null) {
      event.preventDefault();
      this.activeIndex.set(Math.max(0, Math.min(count - 1, next)));
    }
  }

  clampTip(x: number): number {
    return Math.max(56, Math.min(this.width() - 56, x));
  }
}

/** Tiny trend line in the de-emphasis ink with the latest point marked. */
@Component({
  selector: 'cx-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
    }

    .trend {
      fill: none;
      stroke: var(--ink-3);
      stroke-width: 1.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }

    .end {
      fill: var(--series-1);
    }

    .flat {
      stroke: var(--rule-strong);
      stroke-width: 1;
    }
  `,
  template: `
    <svg [attr.width]="width()" [attr.height]="height()" [attr.viewBox]="'-3 -3 ' + (width() + 6) + ' ' + (height() + 6)" aria-hidden="true">
      @if (geometry(); as g) {
        <path class="trend" [attr.d]="g.path" />
        <circle class="end" [attr.cx]="g.endX" [attr.cy]="g.endY" r="2.5" />
      } @else {
        <line class="flat" x1="0" [attr.x2]="width()" [attr.y1]="height() / 2" [attr.y2]="height() / 2" />
      }
    </svg>
  `,
})
export class Sparkline {
  readonly values = input.required<number[]>();
  readonly width = input(96);
  readonly height = input(28);

  protected readonly geometry = computed(() => {
    const values = this.values();
    if (values.length < 2) {
      return null;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const w = this.width();
    const h = this.height();
    const points = values.map((v, i) => ({ x: (i / (values.length - 1)) * w, y: (1 - (v - min) / span) * h }));
    return {
      path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '),
      endX: points[points.length - 1].x,
      endY: points[points.length - 1].y,
    };
  });
}
