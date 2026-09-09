import { Component, OnInit, inject, signal } from '@angular/core';

import type { AdjustStockRequest, AdminInventoryItemDto } from '@/app/core/api/dto';
import { AdminInventoryService } from '@/app/core/services/admin-inventory.service';
import { AdminProductLookupService } from '@/app/core/services/admin-product-lookup.service';
import { ToastService } from '@/app/core/services/toast.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { TextField } from '@/app/shared/ui/text-field';

const REASON_OPTIONS: SelectOption[] = [
  { value: 'recount', label: 'Recount' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'restock', label: 'Restock' },
  { value: 'correction', label: 'Correction' },
];

@Component({
  selector: 'admin-inventory-page',
  imports: [
    CheckboxField,
    DataTable,
    DrawerForm,
    EmptyState,
    FilterBar,
    PageToolbar,
    SelectField,
    SkeletonBlock,
    TextField,
  ],
  template: `
    <page-toolbar title="Inventory" [subtitle]="items().length + ' variants'"></page-toolbar>

    <filter-bar>
      <checkbox-field label="Low stock only" [checked]="lowStockOnly()" (checkedChange)="onFilterChange($event)" />
    </filter-bar>

    @if (loading()) {
      <skeleton-block height="320px" width="100%" />
    } @else if (items().length === 0) {
      <empty-state message="Nothing here." icon="truck" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>On hand</th>
            <th>Reserved</th>
            <th>Threshold</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (item of items(); track item.id) {
            <tr [class.low]="item.quantityOnHand <= item.lowStockThreshold">
              <td>{{ productName(item.productId) }}</td>
              <td>{{ item.variantSku }}</td>
              <td data-numeric>{{ item.quantityOnHand }}</td>
              <td data-numeric>{{ item.quantityReserved }}</td>
              <td data-numeric>{{ item.lowStockThreshold }}</td>
              <td>
                <button type="button" (click)="startAdjust(item)">Adjust</button>
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      title="Adjust stock"
      [open]="formOpen()"
      [saving]="saving()"
      saveLabel="Apply"
      (openChange)="formOpen.set($event)"
      (cancel)="formOpen.set(false)"
      (save)="save()"
    >
      @if (target(); as t) {
        <p class="context">{{ productName(t.productId) }} — {{ t.variantSku }} ({{ t.quantityOnHand }} on hand)</p>
      }
      <text-field
        label="Delta (+ to add, − to deduct)"
        type="number"
        [value]="delta()"
        (valueChange)="delta.set($event)"
      />
      <select-field label="Reason" [options]="reasonOptions" [value]="reasonCode()" (valueChange)="reasonCode.set($event)" />
      <text-field label="Note (optional)" [value]="note()" (valueChange)="note.set($event)" />
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;

    tr.low td:nth-child(3) {
      color: var(--color-error);
      font-weight: 600;
    }

    td button {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
    }

    .context {
      @include type.caption-1;
      margin: 0;
      color: var(--color-neutral-05);
    }
  `,
})
export default class AdminInventory implements OnInit {
  private readonly inventoryService = inject(AdminInventoryService);
  private readonly productLookup = inject(AdminProductLookupService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<AdminInventoryItemDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly lowStockOnly = signal(false);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly target = signal<AdminInventoryItemDto | null>(null);
  protected readonly delta = signal('');
  protected readonly note = signal('');
  protected readonly reasonCode = signal('correction');
  protected readonly reasonOptions = REASON_OPTIONS;

  ngOnInit(): void {
    this.productLookup.ensureLoaded().subscribe();
    this.load();
  }

  protected onFilterChange(checked: boolean): void {
    this.lowStockOnly.set(checked);
    this.load();
  }

  protected productName(productId: string): string {
    return this.productLookup.get(productId)?.name ?? productId;
  }

  private load(): void {
    this.loading.set(true);
    const request = this.lowStockOnly() ? this.inventoryService.listLowStock() : this.inventoryService.listAll();
    request.subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected startAdjust(item: AdminInventoryItemDto): void {
    this.target.set(item);
    this.delta.set('');
    this.note.set('');
    this.reasonCode.set('correction');
    this.formOpen.set(true);
  }

  protected save(): void {
    const item = this.target();
    const delta = Number.parseInt(this.delta(), 10);
    if (!item || !Number.isFinite(delta) || delta === 0) {
      this.toast.show('Enter a non-zero whole number', 'error');
      return;
    }

    const input: AdjustStockRequest = {
      delta,
      reasonCode: this.reasonCode(),
      note: this.note().trim() || undefined,
    };

    this.saving.set(true);
    this.inventoryService.adjust(item.id, input).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.show('Stock adjusted', 'success');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
