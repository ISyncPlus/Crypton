import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { AdminKycDocument, AdminKycSubmission } from '../../core/admin-models';
import { formatBytes, saveBlob } from '../../core/files';
import { formatDate, formatDateTime } from '../../core/format';
import { Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { Dialogs } from '../../ui/dialogs';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';

interface Preview {
  doc: AdminKycDocument;
  url: string | null;
  safeUrl: SafeUrl | null;
  error: string | null;
}

const DOC_LABELS: Record<string, string> = { IdFront: 'Front of ID', IdBack: 'Back of ID', Selfie: 'Selfie with ID', ProofOfAddress: 'Proof of address' };

@Component({
  selector: 'cx-admin-kyc-detail',
  imports: [RouterLink, Icon, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .docs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
    }

    .doc {
      display: grid;
      gap: var(--space-2);
    }

    .doc__frame {
      display: grid;
      place-items: center;
      aspect-ratio: 4 / 3;
      max-width: 100%;
      overflow: hidden;
      border: 1px solid var(--rule);
      border-radius: var(--radius-sm);
      background: var(--sunken);
    }

    .doc__frame img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .provider {
      max-height: 14rem;
      overflow: auto;
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    @media (max-width: 700px) {
      .docs {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  template: `
    <div class="page">
      <a class="back-link" routerLink="/admin/kyc"><cx-icon name="arrow-left" [size]="16" />Verification queue</a>

      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      }

      @if (submission(); as s) {
        <header class="page-head">
          <div class="page-head__text">
            <h1 class="page-title">{{ s.firstName }} {{ s.lastName }}</h1>
            <div class="row">
              <cx-status kind="kyc" [status]="s.status" />
              <span class="caption">Tier {{ s.targetTier }} via {{ s.provider }}, submitted {{ when(s.createdAt) }}</span>
            </div>
          </div>
          @if (s.status === 'Pending') {
            <div class="row">
              <button type="button" class="btn btn--primary" [attr.aria-busy]="busy() === 'approve'" [disabled]="!!busy()" (click)="approve(s)">Approve</button>
              <button type="button" class="btn btn--danger" [attr.aria-busy]="busy() === 'reject'" [disabled]="!!busy()" (click)="reject(s)">Reject</button>
            </div>
          }
        </header>

        <div class="split">
          <div class="stack-lg">
            @if (s.targetTier === 1) {
              <section class="panel" aria-labelledby="identity-title">
                <div class="panel__header"><h2 class="panel__title" id="identity-title">Identity details</h2></div>
                <div class="panel__body">
                  <div class="kv">
                    <div class="kv__row"><span class="kv__key">Name</span><span class="kv__value">{{ s.firstName }} {{ s.lastName }}</span></div>
                    <div class="kv__row"><span class="kv__key">Date of birth</span><span class="kv__value">{{ s.dateOfBirth ? date(s.dateOfBirth) : '–' }}</span></div>
                    <div class="kv__row"><span class="kv__key">Phone</span><span class="kv__value">{{ s.phoneNumber ?? '–' }}</span></div>
                    <div class="kv__row"><span class="kv__key">Address</span><span class="kv__value">{{ s.address ?? '–' }}</span></div>
                    <div class="kv__row">
                      <span class="kv__key">{{ s.idType ?? 'ID' }} number</span>
                      <span class="kv__value">
                        <span class="mono">{{ revealed() ?? s.idNumberMasked ?? '–' }}</span>
                        @if (!revealed() && s.idNumberMasked) {
                          <button type="button" class="link" style="margin-left: 0.5rem" [disabled]="!!busy()" (click)="reveal(s)">Reveal</button>
                        }
                      </span>
                    </div>
                  </div>
                  <p class="caption" style="margin-top: var(--space-3)">Revealing the full ID number is recorded in the audit log.</p>
                </div>
              </section>
            } @else {
              <section class="panel" aria-labelledby="docs-title">
                <div class="panel__header"><h2 class="panel__title" id="docs-title">Documents</h2><span class="caption">{{ s.documentKind?.replace('_', ' ') }}</span></div>
                <div class="panel__body docs">
                  @for (p of previews(); track p.doc.id) {
                    <figure class="doc" style="margin: 0">
                      <div class="doc__frame">
                        @if (p.error) {
                          <span class="caption">{{ p.error }}</span>
                        } @else if (p.doc.contentType === 'application/pdf') {
                          <cx-icon name="file" [size]="36" />
                        } @else if (p.safeUrl) {
                          <img [src]="p.safeUrl" [alt]="label(p.doc.type)" />
                        } @else {
                          <span class="skeleton" style="width: 60%; height: 1rem"></span>
                        }
                      </div>
                      <figcaption class="row-between">
                        <span class="caption">{{ label(p.doc.type) }}, {{ size(p.doc.sizeBytes) }}</span>
                        <button type="button" class="link" (click)="download(p)">Download</button>
                      </figcaption>
                    </figure>
                  } @empty {
                    <p class="caption">No documents attached.</p>
                  }
                </div>
              </section>
            }

            @if (s.providerResult) {
              <section class="panel" aria-labelledby="provider-title">
                <div class="panel__header"><h2 class="panel__title" id="provider-title">Provider result</h2></div>
                <div class="panel__body"><div class="provider">{{ s.providerResult }}</div></div>
              </section>
            }
          </div>

          <aside class="panel" aria-labelledby="applicant-title">
            <div class="panel__header"><h2 class="panel__title" id="applicant-title">Applicant</h2></div>
            <div class="panel__body stack">
              <div class="kv">
                <div class="kv__row"><span class="kv__key">Email</span><span class="kv__value">{{ s.userEmail }}</span></div>
                <div class="kv__row"><span class="kv__key">Reviewed</span><span class="kv__value">{{ s.reviewedAt ? when(s.reviewedAt) : 'Not yet' }}</span></div>
                @if (s.rejectionReason) {
                  <div class="kv__row"><span class="kv__key">Rejection reason</span><span class="kv__value">{{ s.rejectionReason }}</span></div>
                }
              </div>
              <a class="btn btn--sm" style="justify-self: start" [routerLink]="['/admin/users', s.userId]">Open user</a>
            </div>
          </aside>
        </div>
      } @else if (!problem()) {
        <span class="skeleton" style="height: 18rem"></span>
      }
    </div>
  `,
})
export class AdminKycDetail {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly dialogs = inject(Dialogs);
  private readonly sanitizer = inject(DomSanitizer);

  readonly id = input.required<string>();

  protected readonly submission = signal<AdminKycSubmission | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly busy = signal<'approve' | 'reject' | 'reveal' | null>(null);
  protected readonly revealed = signal<string | null>(null);
  protected readonly previews = signal<Preview[]>([]);
  private readonly urls: string[] = [];

  protected readonly hasPending = computed(() => this.submission()?.status === 'Pending');

  constructor() {
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
    inject(DestroyRef).onDestroy(() => this.urls.forEach((url) => URL.revokeObjectURL(url)));
  }

  load(): void {
    this.revealed.set(null);
    this.api.kycSubmission(this.id()).subscribe({
      next: (s) => {
        this.submission.set(s);
        this.problem.set(null);
        this.loadPreviews(s);
      },
      error: (e: unknown) => this.problem.set(toProblem(e)),
    });
  }

  async approve(s: AdminKycSubmission): Promise<void> {
    const note = await this.dialogs.prompt({
      title: `Approve tier ${s.targetTier} for ${s.firstName} ${s.lastName}?`,
      body: s.targetTier === 1 ? 'Check the name and date of birth against the ID record before approving.' : 'Check that the selfie matches the ID and the address document is recent.',
      label: 'Note (optional)',
      required: false,
      multiline: true,
      confirmLabel: 'Approve',
    });
    if (note === null) {
      return;
    }

    this.busy.set('approve');
    this.api.approveKyc(s.id, note || undefined).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.submission.set(updated);
        this.toast.success('Verification approved');
      },
      error: (e: unknown) => {
        this.busy.set(null);
        this.toast.error(e);
      },
    });
  }

  async reject(s: AdminKycSubmission): Promise<void> {
    const reason = await this.dialogs.prompt({
      title: 'Reject this submission?',
      body: 'The applicant sees this reason and can submit again.',
      label: 'Reason',
      placeholder: 'e.g. The selfie is blurry. Retake it in good light with your ID readable.',
      multiline: true,
      confirmLabel: 'Reject',
      tone: 'danger',
    });
    if (!reason) {
      return;
    }

    this.busy.set('reject');
    this.api.rejectKyc(s.id, reason).subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.submission.set(updated);
        this.toast.success('Submission rejected');
      },
      error: (e: unknown) => {
        this.busy.set(null);
        this.toast.error(e);
      },
    });
  }

  reveal(s: AdminKycSubmission): void {
    this.busy.set('reveal');
    this.api.revealId(s.id).subscribe({
      next: ({ idNumber }) => {
        this.busy.set(null);
        this.revealed.set(idNumber);
      },
      error: (e: unknown) => {
        this.busy.set(null);
        this.toast.error(e);
      },
    });
  }

  download(preview: Preview): void {
    this.api.kycDocument(preview.doc.id).subscribe({
      next: (blob) => saveBlob(blob, `${preview.doc.type}${preview.doc.contentType === 'application/pdf' ? '.pdf' : preview.doc.contentType === 'image/png' ? '.png' : '.jpg'}`),
      error: (e: unknown) => this.toast.error(e),
    });
  }

  protected label(type: string): string {
    return DOC_LABELS[type] ?? type;
  }

  protected size(bytes: number): string {
    return formatBytes(bytes);
  }

  protected when(iso: string): string {
    return formatDateTime(iso);
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  private loadPreviews(s: AdminKycSubmission): void {
    this.previews.set(s.documents.map((doc) => ({ doc, url: null, safeUrl: null, error: null })));
    for (const doc of s.documents) {
      if (doc.contentType === 'application/pdf') {
        continue;
      }

      this.api.kycDocument(doc.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.urls.push(url);
          const safeUrl = this.sanitizer.bypassSecurityTrustUrl(url);
          this.previews.update((list) => list.map((p) => (p.doc.id === doc.id ? { ...p, url, safeUrl } : p)));
        },
        error: () => this.previews.update((list) => list.map((p) => (p.doc.id === doc.id ? { ...p, error: 'Could not load preview' } : p))),
      });
    }
  }
}
