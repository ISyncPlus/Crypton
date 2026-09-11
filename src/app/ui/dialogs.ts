import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Icon } from './icon';

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}

export interface PromptOptions extends ConfirmOptions {
  label: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  initial?: string;
}

export interface TwoFactorOptions {
  title?: string;
  body?: string;
  confirmLabel?: string;
}

@Component({
  selector: 'cx-confirm-dialog',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog" role="alertdialog" aria-labelledby="confirm-title">
      <div class="dialog__head">
        <h2 class="dialog__title" id="confirm-title">{{ data.title }}</h2>
        <button type="button" class="btn btn--quiet btn--icon btn--sm" (click)="ref.close(false)" aria-label="Close">
          <cx-icon name="x" [size]="16" />
        </button>
      </div>
      @if (data.body) {
        <div class="dialog__body">
          <p class="secondary">{{ data.body }}</p>
        </div>
      }
      <div class="dialog__foot">
        <button type="button" class="btn" (click)="ref.close(false)">{{ data.cancelLabel ?? 'Cancel' }}</button>
        <button type="button" class="btn" [class.btn--danger]="data.tone === 'danger'" [class.btn--primary]="data.tone !== 'danger'" (click)="ref.close(true)">
          {{ data.confirmLabel }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
}

@Component({
  selector: 'cx-prompt-dialog',
  imports: [Icon, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog" (ngSubmit)="submit()" aria-labelledby="prompt-title">
      <div class="dialog__head">
        <h2 class="dialog__title" id="prompt-title">{{ data.title }}</h2>
        <button type="button" class="btn btn--quiet btn--icon btn--sm" (click)="ref.close(null)" aria-label="Close">
          <cx-icon name="x" [size]="16" />
        </button>
      </div>
      <div class="dialog__body">
        @if (data.body) {
          <p class="secondary">{{ data.body }}</p>
        }
        <label class="field">
          <span class="field__label">{{ data.label }}</span>
          @if (data.multiline) {
            <textarea class="textarea" [formControl]="value" [attr.maxlength]="data.maxLength ?? 1000" [placeholder]="data.placeholder ?? ''" [attr.aria-invalid]="showError()"></textarea>
          } @else {
            <input class="input" [formControl]="value" [attr.maxlength]="data.maxLength ?? 1000" [placeholder]="data.placeholder ?? ''" [attr.aria-invalid]="showError()" />
          }
          @if (showError()) {
            <span class="field__error">This is required.</span>
          } @else if (data.hint) {
            <span class="field__hint">{{ data.hint }}</span>
          }
        </label>
      </div>
      <div class="dialog__foot">
        <button type="button" class="btn" (click)="ref.close(null)">{{ data.cancelLabel ?? 'Cancel' }}</button>
        <button type="submit" class="btn" [class.btn--danger]="data.tone === 'danger'" [class.btn--primary]="data.tone !== 'danger'">{{ data.confirmLabel }}</button>
      </div>
    </form>
  `,
})
export class PromptDialog {
  protected readonly data = inject<PromptOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string | null>>(DialogRef);
  protected readonly value = new FormControl(this.data.initial ?? '', { nonNullable: true, validators: this.data.required === false ? [] : [Validators.required] });
  protected readonly showError = signal(false);

  submit(): void {
    const text = this.value.value.trim();
    if (this.data.required !== false && !text) {
      this.showError.set(true);
      return;
    }

    this.ref.close(text);
  }
}

@Component({
  selector: 'cx-two-factor-dialog',
  imports: [Icon, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog" (ngSubmit)="submit()" aria-labelledby="tfa-title">
      <div class="dialog__head">
        <h2 class="dialog__title" id="tfa-title">{{ data.title ?? 'Confirm with your authenticator' }}</h2>
        <button type="button" class="btn btn--quiet btn--icon btn--sm" (click)="ref.close(null)" aria-label="Close">
          <cx-icon name="x" [size]="16" />
        </button>
      </div>
      <div class="dialog__body">
        <p class="secondary">{{ data.body ?? 'Enter the 6-digit code from your authenticator app.' }}</p>
        <label class="field">
          <span class="sr-only">Authentication code</span>
          <input
            class="input input--code"
            [formControl]="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="000000"
            [attr.aria-invalid]="invalid()"
            (input)="onInput()"
          />
          @if (invalid()) {
            <span class="field__error">Enter all 6 digits.</span>
          }
        </label>
      </div>
      <div class="dialog__foot">
        <button type="button" class="btn" (click)="ref.close(null)">Cancel</button>
        <button type="submit" class="btn btn--primary">{{ data.confirmLabel ?? 'Confirm' }}</button>
      </div>
    </form>
  `,
})
export class TwoFactorDialog {
  protected readonly data = inject<TwoFactorOptions>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string | null>>(DialogRef);
  protected readonly code = new FormControl('', { nonNullable: true });
  protected readonly invalid = signal(false);

  onInput(): void {
    const digits = this.code.value.replace(/\D/g, '').slice(0, 6);
    if (digits !== this.code.value) {
      this.code.setValue(digits);
    }

    this.invalid.set(false);
    if (digits.length === 6) {
      this.submit();
    }
  }

  submit(): void {
    const digits = this.code.value.replace(/\D/g, '');
    if (digits.length !== 6) {
      this.invalid.set(true);
      return;
    }

    this.ref.close(digits);
  }
}

@Injectable({ providedIn: 'root' })
export class Dialogs {
  private readonly dialog = inject(Dialog);

  open<R, D, C>(component: ComponentType<C>, data: D, width = '30rem'): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      data,
      width,
      maxWidth: 'calc(100vw - 2rem)',
      backdropClass: 'cx-backdrop',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    return firstValueFrom(this.open<boolean, ConfirmOptions, ConfirmDialog>(ConfirmDialog, options, '27rem').closed).then((result) => result === true);
  }

  prompt(options: PromptOptions): Promise<string | null> {
    return firstValueFrom(this.open<string | null, PromptOptions, PromptDialog>(PromptDialog, options, '30rem').closed).then((result) => result ?? null);
  }

  twoFactorCode(options: TwoFactorOptions = {}): Promise<string | null> {
    return firstValueFrom(this.open<string | null, TwoFactorOptions, TwoFactorDialog>(TwoFactorDialog, options, '24rem').closed).then(
      (result) => result ?? null,
    );
  }
}
