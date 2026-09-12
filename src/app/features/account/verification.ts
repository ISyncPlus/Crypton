import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { formatBytes, validateUpload } from '../../core/files';
import { formatDate, formatNgn } from '../../core/format';
import { DOCUMENT_KINDS, NIGERIAN_STATES } from '../../core/labels';
import { KycIdType, KycStatus, KycSubmission, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../ui/icon';
import { Status } from '../../ui/status';

type DocField = 'idFront' | 'idBack' | 'selfie' | 'proofOfAddress';

@Component({
  selector: 'cx-verification',
  imports: [Icon, Status],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .tiers {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .tier {
      display: grid;
      align-content: start;
      gap: var(--space-3);
      padding: var(--space-5);
    }

    .tier + .tier {
      border-left: 1px solid var(--rule);
    }

    .tier.is-current {
      background: var(--surface-2);
      box-shadow: inset 0 3px 0 var(--primary);
    }

    .tier h3 {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      font-size: var(--text-lg);
    }

    .limits {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: var(--text-sm);
    }

    .limits li {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .limits span:first-child {
      color: var(--ink-3);
    }

    .form {
      display: grid;
      gap: var(--space-4);
    }

    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
    }

    .file {
      display: grid;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border: 1px dashed var(--rule-strong);
      border-radius: var(--radius-sm);
    }

    .file input {
      font-size: var(--text-sm);
    }

    .submission {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-5);
    }

    .submission + .submission {
      border-top: 1px solid var(--rule);
    }

    .submission small {
      display: block;
      color: var(--ink-3);
    }

    @media (max-width: 860px) {
      .tiers,
      .pair {
        grid-template-columns: minmax(0, 1fr);
      }

      .tier + .tier {
        border-top: 1px solid var(--rule);
        border-left: 0;
      }
    }
  `,
  template: `
    @if (loadProblem(); as p) {
      <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
    } @else if (kyc(); as k) {
      <div class="stack-lg">
        <section class="panel" aria-labelledby="tiers-title">
          <div class="panel__header">
            <h2 class="panel__title" id="tiers-title">Verification levels</h2>
            <span class="caption">Daily limits in naira</span>
          </div>
          <div class="tiers">
            @for (tier of k.tiers; track tier.tier) {
              <div class="tier" [class.is-current]="tier.tier === k.currentTier">
                <h3>
                  {{ tier.name }}
                  @if (tier.tier === k.currentTier) {
                    <span class="status status--ok">Your level</span>
                  } @else if (tier.tier < k.currentTier) {
                    <cx-icon name="check" [size]="16" />
                  }
                </h3>
                <ul class="limits">
                  <li><span>Trading</span><span class="figure">{{ limit(tier.dailyTradeNgn) }}</span></li>
                  <li><span>Crypto withdrawals</span><span class="figure">{{ limit(tier.dailyCryptoWithdrawalNgn) }}</span></li>
                  <li><span>Naira deposits</span><span class="figure">{{ tier.fiatEnabled ? limit(tier.dailyFiatDepositNgn) : 'Not available' }}</span></li>
                  <li><span>Naira withdrawals</span><span class="figure">{{ tier.fiatEnabled ? limit(tier.dailyFiatWithdrawalNgn) : 'Not available' }}</span></li>
                  <li><span>P2P trading</span><span>{{ tier.p2PEnabled ? 'Yes' : 'No' }}</span></li>
                </ul>
                <p class="caption">{{ requirement(tier.tier) }}</p>
              </div>
            }
          </div>
        </section>

        @if (pending(); as p) {
          <div class="notice" role="status">
            <cx-icon name="clock" [size]="18" />
            <span>Your {{ p.targetTier === 1 ? 'identity details are' : 'documents are' }} being reviewed, usually within one business day. We'll notify you by email.</span>
          </div>
        }

        @if (k.canSubmitTier1) {
          <section class="panel" aria-labelledby="tier1-title">
            <div class="panel__header"><h2 class="panel__title" id="tier1-title">Verify your identity</h2></div>
            <div class="panel__body form">
              <p class="secondary">Enter your details exactly as they appear on your NIN or BVN record. Your ID number is encrypted and only used for verification.</p>
              <div class="pair">
                <label class="field">
                  <span class="field__label">First name</span>
                  <input class="input" autocomplete="given-name" maxlength="100" [value]="t1.firstName()" (input)="t1.firstName.set($any($event.target).value)" />
                </label>
                <label class="field">
                  <span class="field__label">Last name</span>
                  <input class="input" autocomplete="family-name" maxlength="100" [value]="t1.lastName()" (input)="t1.lastName.set($any($event.target).value)" />
                </label>
              </div>
              <div class="pair">
                <label class="field">
                  <span class="field__label">Date of birth</span>
                  <input class="input" type="date" autocomplete="bday" [max]="maxDob" [value]="t1.dob()" (input)="t1.dob.set($any($event.target).value)" />
                </label>
                <label class="field">
                  <span class="field__label">Phone number</span>
                  <input class="input" type="tel" autocomplete="tel" placeholder="0803 123 4567" maxlength="20" [value]="t1.phone()" (input)="t1.phone.set($any($event.target).value)" />
                </label>
              </div>
              <label class="field">
                <span class="field__label">Home address</span>
                <input class="input" autocomplete="address-line1" maxlength="200" [value]="t1.address()" (input)="t1.address.set($any($event.target).value)" />
              </label>
              <div class="pair">
                <label class="field">
                  <span class="field__label">City</span>
                  <input class="input" autocomplete="address-level2" maxlength="80" [value]="t1.city()" (input)="t1.city.set($any($event.target).value)" />
                </label>
                <div class="field">
                  <label class="field__label" for="kyc-state">State</label>
                  <select id="kyc-state" class="select" [value]="t1.state()" (change)="t1.state.set($any($event.target).value)">
                    <option value="">Choose a state</option>
                    @for (state of states; track state) {
                      <option [value]="state" [selected]="state === t1.state()">{{ state }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="pair">
                <div class="field">
                  <span class="field__label">ID type</span>
                  <div class="segmented segmented--block" role="group" aria-label="ID type">
                    <button type="button" [attr.aria-pressed]="t1.idType() === 'NIN'" (click)="t1.idType.set('NIN')">NIN</button>
                    <button type="button" [attr.aria-pressed]="t1.idType() === 'BVN'" (click)="t1.idType.set('BVN')">BVN</button>
                  </div>
                </div>
                <label class="field">
                  <span class="field__label">{{ t1.idType() }} number</span>
                  <input class="input" inputmode="numeric" autocomplete="off" maxlength="11" placeholder="11 digits" [value]="t1.idNumber()" (input)="onIdNumber($event)" />
                </label>
              </div>
              @if (t1Error(); as e) {
                <span class="field__error">{{ e }}</span>
              }
              @if (problem(); as p) {
                <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
              }
              <button type="button" class="btn btn--primary" style="justify-self: start" [disabled]="!!t1Error() || busy()" [attr.aria-busy]="busy()" (click)="submitTier1()">Submit for verification</button>
            </div>
          </section>
        }

        @if (k.canSubmitTier2) {
          <section class="panel" aria-labelledby="tier2-title">
            <div class="panel__header"><h2 class="panel__title" id="tier2-title">Upgrade to advanced verification</h2></div>
            <div class="panel__body form">
              <p class="secondary">Upload a government ID, a selfie of you holding it, and a recent proof of address such as a utility bill or bank statement from the last three months.</p>
              <div class="field" style="max-width: 24rem">
                <label class="field__label" for="kyc-document">ID document</label>
                <select id="kyc-document" class="select" [value]="docKind()" (change)="docKind.set($any($event.target).value)">
                  <option value="">Choose a document</option>
                  @for (kind of documentKinds; track kind.value) {
                    <option [value]="kind.value" [selected]="kind.value === docKind()">{{ kind.label }}</option>
                  }
                </select>
              </div>
              <div class="pair">
                @for (slot of slots; track slot.field) {
                  <label class="file">
                    <span class="field__label">{{ slot.label }}<span class="field__aside">{{ slot.required ? 'Required' : 'Optional' }}</span></span>
                    <input type="file" [accept]="slot.accept" (change)="pick(slot.field, $event)" />
                    @if (fileErrors()[slot.field]; as e) {
                      <span class="field__error">{{ e }}</span>
                    } @else if (files()[slot.field]; as f) {
                      <span class="field__hint">{{ f.name }}, {{ size(f.size) }}</span>
                    } @else {
                      <span class="field__hint">{{ slot.hint }}</span>
                    }
                  </label>
                }
              </div>
              @if (problem(); as p) {
                <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
              }
              <button type="button" class="btn btn--primary" style="justify-self: start" [disabled]="!canSubmitTier2() || busy()" [attr.aria-busy]="busy()" (click)="submitTier2()">Upload documents</button>
            </div>
          </section>
        }

        @if (k.submissions.length) {
          <section class="panel" aria-labelledby="history-title">
            <div class="panel__header"><h2 class="panel__title" id="history-title">Your submissions</h2></div>
            @for (s of k.submissions; track s.id) {
              <div class="submission">
                <span>
                  <strong>{{ s.targetTier === 1 ? 'Identity verification' : 'Advanced verification' }}</strong>
                  <small>Submitted {{ date(s.createdAt) }}{{ s.reviewedAt ? ', reviewed ' + date(s.reviewedAt) : '' }}</small>
                  @if (s.rejectionReason) {
                    <small>{{ s.rejectionReason }}</small>
                  }
                </span>
                <cx-status kind="kyc" [status]="s.status" />
              </div>
            }
          </section>
        }
      </div>
    } @else {
      <span class="skeleton" style="height: 16rem"></span>
    }
  `,
})
export class Verification implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly states = NIGERIAN_STATES;
  protected readonly documentKinds = DOCUMENT_KINDS;
  protected readonly maxDob = new Date(Date.now() - 18 * 365.25 * 86_400_000).toISOString().slice(0, 10);
  protected readonly slots: { field: DocField; label: string; hint: string; required: boolean; accept: string }[] = [
    { field: 'idFront', label: 'Front of ID', hint: 'JPG, PNG or PDF up to 5 MB', required: true, accept: 'image/jpeg,image/png,application/pdf' },
    { field: 'idBack', label: 'Back of ID', hint: 'If your ID has a back side', required: false, accept: 'image/jpeg,image/png,application/pdf' },
    { field: 'selfie', label: 'Selfie holding your ID', hint: 'JPG or PNG, face and ID clearly visible', required: true, accept: 'image/jpeg,image/png' },
    { field: 'proofOfAddress', label: 'Proof of address', hint: 'Utility bill or bank statement, last 3 months', required: true, accept: 'image/jpeg,image/png,application/pdf' },
  ];

  protected readonly kyc = signal<KycStatus | null>(null);
  protected readonly loadProblem = signal<Problem | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly busy = signal(false);

  protected readonly t1 = {
    firstName: signal(''),
    lastName: signal(''),
    dob: signal(''),
    phone: signal(''),
    address: signal(''),
    city: signal(''),
    state: signal(''),
    idType: signal<KycIdType>('NIN'),
    idNumber: signal(''),
  };

  protected readonly docKind = signal('');
  protected readonly files = signal<Partial<Record<DocField, File>>>({});
  protected readonly fileErrors = signal<Partial<Record<DocField, string>>>({});

  protected readonly pending = computed<KycSubmission | null>(() => this.kyc()?.submissions.find((s) => s.status === 'Pending') ?? null);

  protected readonly t1Error = computed(() => {
    const t = this.t1;
    if (!t.firstName().trim() || !t.lastName().trim() || !t.dob() || !t.phone().trim() || !t.address().trim() || !t.city().trim() || !t.state()) {
      return null;
    }

    if (t.dob() > this.maxDob) {
      return 'You must be at least 18 years old.';
    }

    if (!isNigerianMobile(t.phone())) {
      return 'Enter a Nigerian mobile number, for example 0803 123 4567.';
    }

    if (!/^\d{11}$/.test(t.idNumber())) {
      return `${t.idType()} numbers are 11 digits.`;
    }

    return null;
  });

  private readonly t1Complete = computed(() => {
    const t = this.t1;
    return !!(t.firstName().trim() && t.lastName().trim() && t.dob() && t.phone().trim() && t.address().trim() && t.city().trim() && t.state() && t.idNumber());
  });

  protected readonly canSubmitTier2 = computed(() => {
    const files = this.files();
    const errors = this.fileErrors();
    return !!this.docKind() && !!files.idFront && !!files.selfie && !!files.proofOfAddress && Object.values(errors).every((e) => !e);
  });

  ngOnInit(): void {
    const user = this.auth.user();
    if (user) {
      this.t1.firstName.set(user.firstName);
      this.t1.lastName.set(user.lastName);
    }

    this.load();
  }

  load(): void {
    this.api.kycStatus().subscribe({ next: (k) => this.kyc.set(k), error: (e: unknown) => this.loadProblem.set(toProblem(e)) });
  }

  onIdNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 11);
    if (input.value !== digits) {
      input.value = digits;
    }

    this.t1.idNumber.set(digits);
  }

  pick(field: DocField, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    let error = validateUpload(file);
    if (!error && file && field === 'selfie' && file.type === 'application/pdf') {
      error = 'The selfie must be a JPG or PNG photo.';
    }

    this.files.update((current) => {
      const next = { ...current };
      if (file) {
        next[field] = file;
      } else {
        delete next[field];
      }

      return next;
    });
    this.fileErrors.update((current) => ({ ...current, [field]: error ?? undefined }));
  }

  submitTier1(): void {
    if (!this.t1Complete()) {
      this.problem.set({ status: 400, code: 'validation_error', title: 'Fill in every field to continue.' });
      return;
    }

    if (this.t1Error()) {
      return;
    }

    const t = this.t1;
    this.busy.set(true);
    this.problem.set(null);
    this.api
      .submitTier1({
        firstName: t.firstName().trim(),
        lastName: t.lastName().trim(),
        dateOfBirth: t.dob(),
        phoneNumber: t.phone().trim(),
        addressLine: t.address().trim(),
        city: t.city().trim(),
        state: t.state(),
        idType: t.idType(),
        idNumber: t.idNumber(),
      })
      .subscribe({
        next: (submission) => {
          this.busy.set(false);
          t.idNumber.set('');
          if (submission.status === 'Approved') {
            this.toast.success('You are verified', 'Naira deposits, withdrawals and P2P are unlocked.');
          } else if (submission.status === 'Rejected') {
            this.toast.warning('Verification unsuccessful', submission.rejectionReason ?? undefined);
          } else {
            this.toast.info('Details submitted', 'We will notify you when the review is done.');
          }

          this.refresh();
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.problem.set(toProblem(error));
        },
      });
  }

  submitTier2(): void {
    if (!this.canSubmitTier2()) {
      return;
    }

    const form = new FormData();
    form.append('documentKind', this.docKind());
    for (const [field, file] of Object.entries(this.files())) {
      if (file) {
        form.append(field, file, file.name);
      }
    }

    this.busy.set(true);
    this.problem.set(null);
    this.api.submitTier2(form).subscribe({
      next: () => {
        this.busy.set(false);
        this.files.set({});
        this.docKind.set('');
        this.toast.success('Documents uploaded', 'We will notify you when the review is done.');
        this.refresh();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.problem.set(toProblem(error));
      },
    });
  }

  protected limit(value: string): string {
    return Number(value) === 0 ? 'Not available' : formatNgn(value, 0);
  }

  protected requirement(tier: number): string {
    return tier === 0 ? 'Email confirmed.' : tier === 1 ? 'Name, date of birth, address and NIN or BVN.' : 'Government ID, selfie and proof of address.';
  }

  protected date(iso: string): string {
    return formatDate(iso);
  }

  protected size(bytes: number): string {
    return formatBytes(bytes);
  }

  private refresh(): void {
    this.load();
    this.api.me().subscribe({ next: (me) => this.auth.setUser(me.user), error: () => undefined });
  }
}

/** Mirrors the API: +234 / 0 prefixes are optional; the local number is 10 digits starting 7, 8 or 9. */
function isNigerianMobile(input: string): boolean {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length === 13) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  return digits.length === 10 && '789'.includes(digits[0]);
}
