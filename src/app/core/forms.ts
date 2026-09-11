import { Directive } from '@angular/core';
import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { decimalPlaces, gt, lt } from './decimal';
import { Problem } from './models';

/** Normalises a typed amount ("1,250.50" -> "1250.50"). Returns null when it is not a plain positive number. */
export function parseAmount(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).replace(/[,\s_]/g, '');
  if (!/^\d+(\.\d+)?$/.test(text) && !/^\d+\.$/.test(text) && !/^\.\d+$/.test(text)) {
    return null;
  }

  let normalised = text.endsWith('.') ? text.slice(0, -1) : text;
  if (normalised.startsWith('.')) {
    normalised = '0' + normalised;
  }

  return normalised.replace(/^0+(?=\d)/, '');
}

export interface AmountRules {
  decimals: () => number;
  min?: () => string | null | undefined;
  max?: () => string | null | undefined;
}

/** Pure amount check shared by validators and signal-driven forms. Empty input is not an error. */
export function checkAmount(raw: unknown, decimals: number, min?: string | null, max?: string | null): ValidationErrors | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return null;
  }

  const amount = parseAmount(raw);
  if (amount === null) {
    return { amount: true };
  }

  if (!gt(amount, '0')) {
    return { positive: true };
  }

  if (decimalPlaces(amount) > decimals) {
    return { decimals };
  }

  if (min && lt(amount, min)) {
    return { min };
  }

  if (max && gt(amount, max)) {
    return { max };
  }

  return null;
}

export function amountValidator(rules: AmountRules): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => checkAmount(control.value, rules.decimals(), rules.min?.(), rules.max?.());
}

/** Message for the first error in a ValidationErrors map. */
export function errorsMessage(errors: ValidationErrors | null, format: (key: string, value: unknown) => string | null = defaultMessage): string | null {
  if (!errors) {
    return null;
  }

  const [key, value] = Object.entries(errors)[0];
  return format(key, value);
}

/** Lets only digits, separators and a decimal point be typed into amount fields. */
@Directive({
  selector: 'input[cxAmount]',
  host: { inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', '(beforeinput)': 'guard($event)' },
})
export class AmountInput {
  guard(event: InputEvent): void {
    if (event.data && /[^\d.,]/.test(event.data)) {
      event.preventDefault();
    }
  }
}

/** The first user-facing error for a control, once the user has interacted with it. */
export function controlError(control: AbstractControl | null | undefined, format: (key: string, value: unknown) => string | null = defaultMessage): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) {
    return null;
  }

  const [key, value] = Object.entries(control.errors)[0];
  return format(key, value);
}

export function defaultMessage(key: string, value: unknown): string | null {
  switch (key) {
    case 'required':
      return 'This is required.';
    case 'email':
      return 'Enter a valid email address.';
    case 'minlength':
      return `Use at least ${(value as { requiredLength: number }).requiredLength} characters.`;
    case 'maxlength':
      return `Use at most ${(value as { requiredLength: number }).requiredLength} characters.`;
    case 'amount':
      return 'Enter an amount like 1250 or 0.05.';
    case 'positive':
      return 'Enter an amount greater than zero.';
    case 'decimals':
      return value === 0 ? 'Use whole numbers only.' : `Use at most ${value} decimal places.`;
    case 'min':
      return `The minimum is ${value}.`;
    case 'max':
      return `The maximum is ${value}.`;
    case 'pattern':
      return 'Check the format.';
    case 'password':
      return PASSWORD_HINT;
    case 'server':
      return String(value);
    default:
      return 'Check this field.';
  }
}

/** Shows API validation errors next to the matching form fields. Returns true when any field matched. */
export function applyProblem(form: FormGroup, problem: Problem): boolean {
  if (!problem.errors) {
    return false;
  }

  let matched = false;
  for (const [key, messages] of Object.entries(problem.errors)) {
    const name = key.replace(/^\$\.?/, '').replace(/^request\./i, '');
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    const control = form.get(camel);
    if (control && messages.length) {
      control.setErrors({ server: messages[0] });
      control.markAsTouched();
      matched = true;
    }
  }

  return matched;
}

/** Password rules enforced by the API: 10+ characters with upper, lower case and a digit. */
export const passwordValidator: ValidatorFn = (control) => {
  const value = String(control.value ?? '');
  if (!value) {
    return null;
  }

  if (value.length < 10 || !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return { password: true };
  }

  return null;
};

export const PASSWORD_HINT = 'At least 10 characters, with upper and lower case letters and a number.';
