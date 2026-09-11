import { Injectable, signal } from '@angular/core';
import { toProblem } from './problem';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

const DURATION: Record<ToastKind, number> = { success: 4000, info: 5000, warning: 7000, error: 8000 };

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  readonly toasts = signal<Toast[]>([]);

  success(title: string, body?: string): void {
    this.show('success', title, body);
  }

  info(title: string, body?: string): void {
    this.show('info', title, body);
  }

  warning(title: string, body?: string): void {
    this.show('warning', title, body);
  }

  /** Shows an API or client error in plain words. */
  error(error: unknown, fallbackTitle?: string): void {
    if (typeof error === 'string') {
      this.show('error', error);
      return;
    }

    const problem = toProblem(error);
    this.show('error', problem.title || fallbackTitle || 'Something went wrong.');
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  hold(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
  }

  release(id: number): void {
    const toast = this.toasts().find((item) => item.id === id);
    if (toast) {
      this.schedule(toast.id, 2500);
    }
  }

  private show(kind: ToastKind, title: string, body?: string): void {
    const id = this.nextId++;
    // Identical messages replace each other instead of stacking.
    const duplicate = this.toasts().find((toast) => toast.kind === kind && toast.title === title && toast.body === body);
    if (duplicate) {
      this.dismiss(duplicate.id);
    }

    this.toasts.update((list) => [...list.slice(-3), { id, kind, title, body }]);
    this.schedule(id, DURATION[kind]);
  }

  private schedule(id: number, ms: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), ms),
    );
  }
}
