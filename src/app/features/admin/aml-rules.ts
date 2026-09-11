import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/admin-api.service';
import { AmlRuleConfig } from '../../core/admin-models';
import { AuthService } from '../../core/auth.service';
import { amlRule } from '../../core/labels';
import { AmlAction, Problem } from '../../core/models';
import { toProblem } from '../../core/problem';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../ui/icon';

@Component({
  selector: 'cx-admin-aml-rules',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .rule {
      display: grid;
      grid-template-columns: minmax(14rem, 1.2fr) 8rem minmax(0, 2fr);
      gap: var(--space-4);
      align-items: start;
      padding: var(--space-4) var(--space-5);
    }

    .rule + .rule {
      border-top: 1px solid var(--rule);
    }

    .rule.is-off {
      opacity: 0.6;
    }

    .params {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--space-3);
    }

    .params .input {
      min-height: 2.25rem;
    }

    @media (max-width: 1000px) {
      .rule {
        grid-template-columns: minmax(0, 1fr);
      }

      .params {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
  template: `
    <div class="page">
      <header class="page-head">
        <div class="page-head__text">
          <h1 class="page-title">Monitoring rules</h1>
          <p class="lede">Flag records an alert. Review holds the withdrawal for staff. Block stops it immediately.</p>
        </div>
        @if (auth.isAdmin()) {
          <button type="button" class="btn btn--primary" [disabled]="!dirty() || saving()" [attr.aria-busy]="saving()" (click)="save()">Save rules</button>
        }
      </header>

      @if (!auth.isAdmin()) {
        <div class="notice"><cx-icon name="lock" [size]="18" /><span>Only admins can change rules. You can view them.</span></div>
      }
      @if (problem(); as p) {
        <div class="notice notice--bad" role="alert"><cx-icon name="alert" [size]="18" /><span>{{ p.title }}</span></div>
      }

      <section class="panel" aria-label="Rules">
        @for (rule of rules(); track rule.code; let i = $index) {
          <div class="rule" [class.is-off]="!rule.enabled">
            <div class="stack-sm">
              <label class="checkbox"><input type="checkbox" [checked]="rule.enabled" [disabled]="!auth.isAdmin()" (change)="update(i, { enabled: !rule.enabled })" /><strong>{{ name(rule.code) }}</strong></label>
              <span class="caption">{{ description(rule.code) }}</span>
            </div>
            <select class="select" aria-label="Action" [value]="rule.action" [disabled]="!auth.isAdmin()" (change)="update(i, { action: $any($event.target).value })">
              @for (action of actions; track action) {
                <option [value]="action" [selected]="action === rule.action">{{ action }}</option>
              }
            </select>
            <div class="params">
              @if (shape()[rule.code]?.threshold) {
                <label class="field"><span class="field__label">Threshold (₦)</span><input class="input" inputmode="decimal" [value]="rule.thresholdNgn" [disabled]="!auth.isAdmin()" (input)="update(i, { thresholdNgn: orNull($any($event.target).value) })" /></label>
              }
              @if (shape()[rule.code]?.count) {
                <label class="field"><span class="field__label">Count</span><input class="input" inputmode="numeric" [value]="rule.count" [disabled]="!auth.isAdmin()" (input)="update(i, { count: toInt($any($event.target).value) })" /></label>
              }
              @if (shape()[rule.code]?.window) {
                <label class="field"><span class="field__label">Window (minutes)</span><input class="input" inputmode="numeric" [value]="rule.windowMinutes" [disabled]="!auth.isAdmin()" (input)="update(i, { windowMinutes: toInt($any($event.target).value) })" /></label>
              }
              @if (shape()[rule.code]?.ratio) {
                <label class="field"><span class="field__label">Ratio (0 to 1)</span><input class="input" inputmode="decimal" [value]="rule.ratio" [disabled]="!auth.isAdmin()" (input)="update(i, { ratio: orNull($any($event.target).value) })" /></label>
              }
            </div>
          </div>
        } @empty {
          <div class="panel__body"><span class="skeleton" style="height: 14rem"></span></div>
        }
      </section>
    </div>
  `,
})
export class AdminAmlRules implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly actions: AmlAction[] = ['Flag', 'Review', 'Block'];
  protected readonly rules = signal<AmlRuleConfig[]>([]);
  /** Which parameters each rule uses, taken from the saved configuration. */
  protected readonly shape = signal<Partial<Record<string, { threshold: boolean; count: boolean; window: boolean; ratio: boolean }>>>({});
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly problem = signal<Problem | null>(null);

  ngOnInit(): void {
    this.api.amlRules().subscribe({
      next: (settings) => {
        this.rules.set(settings.rules);
        const shape: Record<string, { threshold: boolean; count: boolean; window: boolean; ratio: boolean }> = {};
        for (const rule of settings.rules) {
          shape[rule.code] = { threshold: rule.thresholdNgn !== null, count: rule.count !== null, window: rule.windowMinutes !== null, ratio: rule.ratio !== null };
        }

        this.shape.set(shape);
      },
      error: (e: unknown) => this.problem.set(toProblem(e)),
    });
  }

  update(index: number, patch: Partial<AmlRuleConfig>): void {
    this.rules.update((rules) => rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
    this.dirty.set(true);
  }

  save(): void {
    this.saving.set(true);
    this.problem.set(null);
    this.api.saveAmlRules({ rules: this.rules() }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.rules.set(saved.rules);
        this.dirty.set(false);
        this.toast.success('Rules saved');
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.problem.set(toProblem(e));
      },
    });
  }

  protected name(code: string): string {
    return amlRule(code).name;
  }

  protected description(code: string): string {
    return amlRule(code).description;
  }

  protected orNull(value: string): string | null {
    const text = value.replace(/,/g, '').trim();
    return text === '' ? null : text;
  }

  protected toInt(value: string): number | null {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
}
