import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { Icon, IconName } from './icon';

const ICON: Record<string, IconName> = { success: 'check', error: 'alert', warning: 'alert', info: 'info' };

@Component({
  selector: 'cx-toaster',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      position: fixed;
      right: var(--space-5);
      bottom: var(--space-5);
      z-index: 2000;
      display: grid;
      gap: var(--space-2);
      width: min(24rem, calc(100vw - 2rem));
      pointer-events: none;
    }

    .toast {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      border: 1px solid rgb(255 255 255 / 10%);
      border-radius: var(--radius);
      background: #1c2566;
      color: #ffffff;
      box-shadow: var(--shadow-pop);
      pointer-events: auto;
      animation: toast-in var(--dur) var(--ease);
    }

    .toast > cx-icon {
      margin-top: 0.15rem;
    }

    .toast[data-kind='success'] > cx-icon {
      color: #3ccb9c;
    }

    .toast[data-kind='error'] > cx-icon {
      color: #ff8a7e;
    }

    .toast[data-kind='warning'] > cx-icon {
      color: #f5a524;
    }

    .title {
      font-weight: 600;
    }

    .body {
      margin-top: 0.15rem;
      font-size: var(--text-sm);
      opacity: 0.8;
    }

    .close {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: inherit;
      opacity: 0.7;
      cursor: pointer;
    }

    .close:hover {
      opacity: 1;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
    }

    @media (max-width: 600px) {
      :host {
        right: 1rem;
        bottom: 1rem;
      }
    }
  `,
  template: `
    <div aria-live="polite" class="sr-only">
      @for (toast of toasts.toasts(); track toast.id) {
        {{ toast.title }}
      }
    </div>
    @for (toast of toasts.toasts(); track toast.id) {
      <div class="toast" [attr.data-kind]="toast.kind" (mouseenter)="toasts.hold(toast.id)" (mouseleave)="toasts.release(toast.id)">
        <cx-icon [name]="icon(toast.kind)" [size]="18" />
        <div>
          <div class="title">{{ toast.title }}</div>
          @if (toast.body) {
            <div class="body">{{ toast.body }}</div>
          }
        </div>
        <button type="button" class="close" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">
          <cx-icon name="x" [size]="16" />
        </button>
      </div>
    }
  `,
})
export class Toaster {
  protected readonly toasts = inject(ToastService);
  protected icon(kind: string): IconName {
    return ICON[kind] ?? 'info';
  }
}
