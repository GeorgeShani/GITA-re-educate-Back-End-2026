import { Component, OnInit, inject, signal } from '@angular/core';

import type { AdminShippingZoneDto, ShippingRateInput, UpsertShippingZoneRequest } from '@/app/core/api/dto';
import { AdminShippingService } from '@/app/core/services/admin-shipping.service';
import { ToastService } from '@/app/core/services/toast.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { ActionButton } from '@/app/shared/ui/action-button';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

interface RateRow {
  method: string;
  priceDollars: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
}

interface ZoneFormModel {
  name: string;
  countryCodesText: string;
  rates: RateRow[];
  isActive: boolean;
}

const EMPTY_FORM: ZoneFormModel = { name: '', countryCodesText: '', rates: [], isActive: true };

@Component({
  selector: 'admin-shipping-page',
  imports: [ActionButton, CheckboxField, DataTable, DrawerForm, EmptyState, PageToolbar, SkeletonBlock, StatusBadge, TextField],
  template: `
    <page-toolbar title="Shipping zones" [subtitle]="zones().length + ' total'">
      <action-button size="s" (click)="startCreate()">New zone</action-button>
    </page-toolbar>

    @if (loading()) {
      <skeleton-block height="240px" width="100%" />
    } @else if (zones().length === 0) {
      <empty-state message="No shipping zones yet." icon="truck" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Countries</th>
            <th>Rates</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (z of zones(); track z.id) {
            <tr>
              <td>{{ z.name }}</td>
              <td>{{ z.countryCodes.join(', ') }}</td>
              <td>{{ z.rates.length }}</td>
              <td>
                <status-badge variant="custom" [background]="z.isActive ? 'var(--color-success)' : 'var(--color-neutral-03)'" color="var(--color-neutral-07)">
                  {{ z.isActive ? 'Active' : 'Inactive' }}
                </status-badge>
              </td>
              <td><button type="button" (click)="startEdit(z)">Edit</button></td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      [title]="editingId() ? 'Edit zone' : 'New zone'"
      [open]="formOpen()"
      [saving]="saving()"
      (openChange)="formOpen.set($event)"
      (cancel)="formOpen.set(false)"
      (save)="save()"
    >
      <text-field label="Name" [value]="form().name" (valueChange)="patch({ name: $event })" />
      <text-field
        label="Country codes (comma separated, ISO alpha-2)"
        [value]="form().countryCodesText"
        (valueChange)="patch({ countryCodesText: $event })"
      />

      <div class="section">
        <div class="section-head">
          <h3>Rates</h3>
          <button type="button" (click)="addRate()">Add rate</button>
        </div>
        @for (rate of form().rates; track $index; let i = $index) {
          <div class="rate-row">
            <text-field label="Method" [value]="rate.method" (valueChange)="patchRate(i, { method: $event })" />
            <text-field label="Price (USD)" type="number" [value]="rate.priceDollars" (valueChange)="patchRate(i, { priceDollars: $event })" />
            <text-field label="Est. days min" type="number" [value]="rate.estimatedDaysMin" (valueChange)="patchRate(i, { estimatedDaysMin: $event })" />
            <text-field label="Est. days max" type="number" [value]="rate.estimatedDaysMax" (valueChange)="patchRate(i, { estimatedDaysMax: $event })" />
            <button type="button" class="danger" (click)="removeRate(i)">Remove rate</button>
          </div>
        }
      </div>

      <checkbox-field label="Active" [checked]="form().isActive" (checkedChange)="patch({ isActive: $event })" />
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;

    td button {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
    }

    .section {
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-neutral-03);
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3);
    }

    h3 {
      @include type.caption-1-semi;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .section-head button {
      @include type.caption-2-semi;
      color: var(--color-neutral-07);
      text-decoration: underline;
    }

    .rate-row {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      margin-bottom: var(--space-3);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);

      .danger {
        @include type.caption-2-semi;
        align-self: flex-start;
        color: var(--color-error);
        text-decoration: underline;
      }
    }
  `,
})
export default class AdminShipping implements OnInit {
  private readonly shippingService = inject(AdminShippingService);
  private readonly toast = inject(ToastService);

  protected readonly zones = signal<AdminShippingZoneDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly form = signal<ZoneFormModel>({ ...EMPTY_FORM });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.shippingService.list().subscribe({
      next: (zones) => {
        this.zones.set(zones);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected patch(partial: Partial<ZoneFormModel>): void {
    this.form.update((current) => ({ ...current, ...partial }));
  }

  protected patchRate(index: number, partial: Partial<RateRow>): void {
    this.form.update((current) => ({
      ...current,
      rates: current.rates.map((r, i) => (i === index ? { ...r, ...partial } : r)),
    }));
  }

  protected addRate(): void {
    this.form.update((current) => ({
      ...current,
      rates: [...current.rates, { method: '', priceDollars: '', estimatedDaysMin: '', estimatedDaysMax: '' }],
    }));
  }

  protected removeRate(index: number): void {
    this.form.update((current) => ({ ...current, rates: current.rates.filter((_, i) => i !== index) }));
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.formOpen.set(true);
  }

  protected startEdit(zone: AdminShippingZoneDto): void {
    this.editingId.set(zone.id);
    this.form.set({
      name: zone.name,
      countryCodesText: zone.countryCodes.join(', '),
      rates: zone.rates.map((r) => ({
        method: r.method,
        priceDollars: (r.priceMinor / 100).toString(),
        estimatedDaysMin: r.estimatedDaysMin?.toString() ?? '',
        estimatedDaysMax: r.estimatedDaysMax?.toString() ?? '',
      })),
      isActive: zone.isActive,
    });
    this.formOpen.set(true);
  }

  protected save(): void {
    const value = this.form();
    const countryCodes = value.countryCodesText
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (!value.name.trim() || countryCodes.length === 0) {
      this.toast.show('Name and at least one country code are required', 'error');
      return;
    }

    const rates: ShippingRateInput[] = value.rates
      .filter((r) => r.method.trim())
      .map((r) => ({
        method: r.method.trim(),
        priceMinor: Math.round(Number.parseFloat(r.priceDollars || '0') * 100),
        estimatedDaysMin: r.estimatedDaysMin ? Number.parseInt(r.estimatedDaysMin, 10) : undefined,
        estimatedDaysMax: r.estimatedDaysMax ? Number.parseInt(r.estimatedDaysMax, 10) : undefined,
      }));

    const input: UpsertShippingZoneRequest = {
      name: value.name.trim(),
      countryCodes,
      rates,
      isActive: value.isActive,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request = editingId ? this.shippingService.update(editingId, input) : this.shippingService.create(input);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.show(editingId ? 'Zone updated' : 'Zone created', 'success');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
