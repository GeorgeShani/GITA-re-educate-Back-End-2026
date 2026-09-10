import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import type { CouponDto, CouponType, UpsertCouponRequest } from '@/app/core/api/dto';
import { AdminCouponsService } from '@/app/core/services/admin-coupons.service';
import { ToastService } from '@/app/core/services/toast.service';
import { toUnionValue } from '@/app/core/util/string-union';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { ActionButton } from '@/app/shared/ui/action-button';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

const COUPON_TYPES = ['percentage', 'fixed', 'free_shipping'] as const satisfies readonly CouponType[];

const TYPE_OPTIONS: SelectOption[] = [
  { value: 'percentage', label: 'Percentage off' },
  { value: 'fixed', label: 'Fixed amount off' },
  { value: 'free_shipping', label: 'Free shipping' },
];

interface CouponFormModel {
  code: string;
  type: CouponType;
  value: string;
  minSpendDollars: string;
  perUserLimit: string;
  globalLimit: string;
  allowStacking: boolean;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  isFeatured: boolean;
}

const EMPTY_FORM: CouponFormModel = {
  code: '',
  type: 'percentage',
  value: '',
  minSpendDollars: '',
  perUserLimit: '',
  globalLimit: '',
  allowStacking: false,
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: '',
  isActive: true,
  isFeatured: false,
};

@Component({
  selector: 'admin-coupons-page',
  imports: [DatePipe, ActionButton, CheckboxField, DataTable, DrawerForm, EmptyState, PageToolbar, SelectField, SkeletonBlock, StatusBadge, TextField],
  template: `
    <page-toolbar title="Coupons" [subtitle]="coupons().length + ' total'">
      <action-button size="s" (click)="startCreate()">New coupon</action-button>
    </page-toolbar>

    @if (loading()) {
      <skeleton-block height="280px" width="100%" />
    } @else if (coupons().length === 0) {
      <empty-state message="No coupons yet." icon="ticket-percent" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Value</th>
            <th>Window</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of coupons(); track c.id) {
            <tr>
              <td>{{ c.code }}</td>
              <td>{{ c.type }}</td>
              <td data-numeric>{{ c.type === 'percentage' ? c.value + '%' : c.type === 'fixed' ? '$' + (c.value / 100).toFixed(2) : '—' }}</td>
              <td>{{ c.startsAt | date: 'mediumDate' }} – {{ c.endsAt ? (c.endsAt | date: 'mediumDate') : 'no end' }}</td>
              <td>
                <status-badge variant="custom" [background]="c.isActive ? 'var(--color-success)' : 'var(--color-neutral-03)'" color="var(--color-neutral-07)">
                  {{ c.isActive ? 'Active' : 'Inactive' }}
                </status-badge>
                @if (c.isFeatured) {
                  <status-badge variant="custom" background="var(--color-info)" color="var(--color-white)">
                    Featured
                  </status-badge>
                }
              </td>
              <td><button type="button" (click)="startEdit(c)">Edit</button></td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      [title]="editingId() ? 'Edit coupon' : 'New coupon'"
      [open]="formOpen()"
      [saving]="saving()"
      (openChange)="formOpen.set($event)"
      (cancel)="formOpen.set(false)"
      (save)="save()"
    >
      <text-field label="Code" [value]="form().code" (valueChange)="patch({ code: $event })" [disabled]="!!editingId()" />
      <select-field label="Type" [options]="typeOptions" [value]="form().type" (valueChange)="onTypeChange($event)" />
      <text-field
        [label]="form().type === 'percentage' ? 'Value (0-100)' : form().type === 'fixed' ? 'Value (USD)' : 'Value (ignored)'"
        type="number"
        [value]="form().value"
        (valueChange)="patch({ value: $event })"
      />
      <text-field label="Minimum spend (USD, optional)" type="number" [value]="form().minSpendDollars" (valueChange)="patch({ minSpendDollars: $event })" />
      <text-field label="Per-user limit (optional)" type="number" [value]="form().perUserLimit" (valueChange)="patch({ perUserLimit: $event })" />
      <text-field label="Global limit (optional)" type="number" [value]="form().globalLimit" (valueChange)="patch({ globalLimit: $event })" />
      <text-field label="Starts at" type="text" [value]="form().startsAt" (valueChange)="patch({ startsAt: $event })" hint="YYYY-MM-DD" />
      <text-field label="Ends at (optional)" type="text" [value]="form().endsAt" (valueChange)="patch({ endsAt: $event })" hint="YYYY-MM-DD" />
      <checkbox-field label="Allow stacking with other coupons" [checked]="form().allowStacking" (checkedChange)="patch({ allowStacking: $event })" />
      <checkbox-field label="Active" [checked]="form().isActive" (checkedChange)="patch({ isActive: $event })" />
      <checkbox-field
        label="Featured — drives the storefront sale banner"
        [checked]="form().isFeatured"
        (checkedChange)="patch({ isFeatured: $event })"
      />
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;

    td button {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
    }
  `,
})
export default class AdminCoupons implements OnInit {
  private readonly couponsService = inject(AdminCouponsService);
  private readonly toast = inject(ToastService);

  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly coupons = signal<CouponDto[]>([]);
  protected readonly loading = signal(true);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly form = signal<CouponFormModel>({ ...EMPTY_FORM });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.couponsService.list(undefined, 1, 100).subscribe({
      next: (result) => {
        this.coupons.set(result.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected patch(partial: Partial<CouponFormModel>): void {
    this.form.update((current) => ({ ...current, ...partial }));
  }

  /** `select-field` emits a bare `string`; narrowed against the same values `typeOptions` actually offers. */
  protected onTypeChange(value: string): void {
    this.patch({ type: toUnionValue(value, COUPON_TYPES) ?? this.form().type });
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.formOpen.set(true);
  }

  protected startEdit(coupon: CouponDto): void {
    this.editingId.set(coupon.id);
    this.form.set({
      code: coupon.code,
      type: coupon.type,
      value: coupon.type === 'fixed' ? (coupon.value / 100).toString() : coupon.value.toString(),
      minSpendDollars: coupon.minSpendMinor ? (coupon.minSpendMinor / 100).toString() : '',
      perUserLimit: coupon.perUserLimit?.toString() ?? '',
      globalLimit: coupon.globalLimit?.toString() ?? '',
      allowStacking: coupon.allowStacking,
      startsAt: coupon.startsAt.slice(0, 10),
      endsAt: coupon.endsAt?.slice(0, 10) ?? '',
      isActive: coupon.isActive,
      isFeatured: coupon.isFeatured,
    });
    this.formOpen.set(true);
  }

  protected save(): void {
    const value = this.form();
    if (!value.code.trim() || !value.value || !value.startsAt) {
      this.toast.show('Code, value, and start date are required', 'error');
      return;
    }

    const numericValue =
      value.type === 'fixed' ? Math.round(Number.parseFloat(value.value) * 100) : Number.parseInt(value.value, 10);

    const input: UpsertCouponRequest = {
      code: value.code.trim(),
      type: value.type,
      value: Number.isFinite(numericValue) ? numericValue : 0,
      minSpendMinor: value.minSpendDollars ? Math.round(Number.parseFloat(value.minSpendDollars) * 100) : undefined,
      perUserLimit: value.perUserLimit ? Number.parseInt(value.perUserLimit, 10) : undefined,
      globalLimit: value.globalLimit ? Number.parseInt(value.globalLimit, 10) : undefined,
      allowStacking: value.allowStacking,
      startsAt: new Date(value.startsAt).toISOString(),
      endsAt: value.endsAt ? new Date(value.endsAt).toISOString() : undefined,
      isActive: value.isActive,
      isFeatured: value.isFeatured,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request = editingId ? this.couponsService.update(editingId, input) : this.couponsService.create(input);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.show(editingId ? 'Coupon updated' : 'Coupon created', 'success');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
