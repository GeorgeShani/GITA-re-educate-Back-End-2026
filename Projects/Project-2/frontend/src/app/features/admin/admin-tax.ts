import { Component, OnInit, inject, signal } from '@angular/core';

import type { TaxRateDto, UpsertTaxRateRequest } from '@/app/core/api/dto';
import { AdminTaxService } from '@/app/core/services/admin-tax.service';
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

interface TaxFormModel {
  countryCode: string;
  region: string;
  ratePercent: string;
  isActive: boolean;
}

const EMPTY_FORM: TaxFormModel = { countryCode: '', region: '', ratePercent: '', isActive: true };

@Component({
  selector: 'admin-tax-page',
  imports: [ActionButton, CheckboxField, DataTable, DrawerForm, EmptyState, PageToolbar, SkeletonBlock, StatusBadge, TextField],
  template: `
    <page-toolbar title="Tax rates" [subtitle]="rates().length + ' total'">
      <action-button size="s" (click)="startCreate()">New rate</action-button>
    </page-toolbar>

    @if (loading()) {
      <skeleton-block height="240px" width="100%" />
    } @else if (rates().length === 0) {
      <empty-state message="No tax rates yet." icon="banknote" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Country</th>
            <th>Region</th>
            <th>Rate</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (r of rates(); track r.id) {
            <tr>
              <td>{{ r.countryCode }}</td>
              <td>{{ r.region || '—' }}</td>
              <td data-numeric>{{ (r.rateBasisPoints / 100).toFixed(2) }}%</td>
              <td>
                <status-badge variant="custom" [background]="r.isActive ? 'var(--color-success)' : 'var(--color-neutral-03)'" color="var(--color-neutral-07)">
                  {{ r.isActive ? 'Active' : 'Inactive' }}
                </status-badge>
              </td>
              <td><button type="button" (click)="startEdit(r)">Edit</button></td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      [title]="editingId() ? 'Edit tax rate' : 'New tax rate'"
      [open]="formOpen()"
      [saving]="saving()"
      (openChange)="formOpen.set($event)"
      (cancel)="formOpen.set(false)"
      (save)="save()"
    >
      <text-field label="Country code (ISO alpha-2)" [value]="form().countryCode" (valueChange)="patch({ countryCode: $event })" />
      <text-field label="Region (optional, state/province)" [value]="form().region" (valueChange)="patch({ region: $event })" />
      <text-field label="Rate (%)" type="number" [value]="form().ratePercent" (valueChange)="patch({ ratePercent: $event })" />
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
  `,
})
export default class AdminTax implements OnInit {
  private readonly taxService = inject(AdminTaxService);
  private readonly toast = inject(ToastService);

  protected readonly rates = signal<TaxRateDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly form = signal<TaxFormModel>({ ...EMPTY_FORM });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.taxService.list().subscribe({
      next: (rates) => {
        this.rates.set(rates);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected patch(partial: Partial<TaxFormModel>): void {
    this.form.update((current) => ({ ...current, ...partial }));
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.formOpen.set(true);
  }

  protected startEdit(rate: TaxRateDto): void {
    this.editingId.set(rate.id);
    this.form.set({
      countryCode: rate.countryCode,
      region: rate.region ?? '',
      ratePercent: (rate.rateBasisPoints / 100).toString(),
      isActive: rate.isActive,
    });
    this.formOpen.set(true);
  }

  protected save(): void {
    const value = this.form();
    const percent = Number.parseFloat(value.ratePercent);
    if (!value.countryCode.trim() || value.countryCode.trim().length !== 2 || !Number.isFinite(percent)) {
      this.toast.show('A 2-letter country code and a rate are required', 'error');
      return;
    }

    const input: UpsertTaxRateRequest = {
      countryCode: value.countryCode.trim().toUpperCase(),
      region: value.region.trim() || undefined,
      rateBasisPoints: Math.round(percent * 100),
      isActive: value.isActive,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request = editingId ? this.taxService.update(editingId, input) : this.taxService.create(input);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.show(editingId ? 'Tax rate updated' : 'Tax rate created', 'success');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
