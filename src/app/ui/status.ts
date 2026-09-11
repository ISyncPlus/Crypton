import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatusKind, statusInfo } from '../core/labels';

@Component({
  selector: 'cx-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()">{{ info().label }}</span>`,
})
export class Status {
  readonly kind = input.required<StatusKind>();
  readonly status = input.required<string>();
  protected readonly info = computed(() => statusInfo(this.kind(), this.status()));
  protected readonly classes = computed(() => {
    const info = this.info();
    return ['status', info.tone === 'neutral' ? '' : `status--${info.tone}`, info.live ? 'status--live' : ''].filter(Boolean).join(' ');
  });
}
