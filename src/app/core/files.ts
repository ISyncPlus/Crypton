import { HttpResponse } from '@angular/common/http';

/** Saves a blob returned by an authenticated request (reports, documents). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function fileNameFrom(response: HttpResponse<Blob>, fallback: string): string {
  const header = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : fallback;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ACCEPTED_UPLOADS = 'image/jpeg,image/png,application/pdf';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function validateUpload(file: File | null | undefined): string | null {
  if (!file) {
    return null;
  }

  if (!ACCEPTED_UPLOADS.split(',').includes(file.type)) {
    return 'Use a JPG, PNG or PDF file.';
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return 'Files can be up to 5 MB.';
  }

  return null;
}
