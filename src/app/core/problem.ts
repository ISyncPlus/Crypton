import { HttpErrorResponse } from '@angular/common/http';
import { Problem } from './models';

export function toProblem(error: unknown): Problem {
  if (error instanceof HttpErrorResponse) {
    const body = (typeof error.error === 'object' && error.error) || {};
    const errors = body.errors as Record<string, string[]> | undefined;
    const firstFieldError = errors ? Object.values(errors).flat()[0] : undefined;
    if (error.status === 0) {
      return { status: 0, code: 'network_error', title: 'Can’t reach Crypton. Check your connection and try again.' };
    }

    if (error.status === 429) {
      return { status: 429, code: 'rate_limited', title: 'Too many requests. Please wait a moment.' };
    }

    return {
      status: error.status,
      code: (body.code as string) ?? (error.status === 401 ? 'unauthorized' : error.status === 403 ? 'forbidden' : 'error'),
      title: firstFieldError ?? (body.title as string) ?? defaultTitle(error.status),
      details: body.details as Record<string, unknown> | undefined,
      errors,
    };
  }

  if (error instanceof Error) {
    return { status: 0, code: 'client_error', title: error.message };
  }

  return { status: 0, code: 'unknown', title: 'Something went wrong.' };
}

function defaultTitle(status: number): string {
  switch (status) {
    case 401:
      return 'Please sign in again.';
    case 403:
      return 'You don’t have access to this.';
    case 404:
      return 'Not found.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
