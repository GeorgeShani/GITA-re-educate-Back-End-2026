import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { AdminCategoryDto, UpsertCategoryRequest } from '@/app/core/api/dto';
import { AdminCategoriesService } from '@/app/core/services/admin-categories.service';
import { ToastService } from '@/app/core/services/toast.service';
import { AdminConfirmService } from '@/app/features/admin/ui/admin-confirm.service';
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

interface CategoryFormModel {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  position: number;
  imageUrl: string;
  isActive: boolean;
}

const EMPTY_FORM: CategoryFormModel = {
  name: '',
  slug: '',
  description: '',
  parentId: '',
  position: 0,
  imageUrl: '',
  isActive: true,
};

@Component({
  selector: 'admin-categories-page',
  imports: [
    ActionButton,
    CheckboxField,
    DataTable,
    DrawerForm,
    EmptyState,
    PageToolbar,
    SelectField,
    SkeletonBlock,
    StatusBadge,
    TextField,
  ],
  template: `
    <page-toolbar title="Categories" [subtitle]="categories().length + ' total'">
      <action-button size="s" (click)="startCreate()">New category</action-button>
    </page-toolbar>

    @if (loading()) {
      <skeleton-block height="240px" width="100%" />
    } @else if (categories().length === 0) {
      <empty-state message="No categories yet." icon="sliders-horizontal" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Parent</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of categories(); track c.id) {
            <tr>
              <td>{{ indent(c) }}{{ c.name }}</td>
              <td>{{ c.slug }}</td>
              <td>{{ parentName(c.parentId) }}</td>
              <td>
                <status-badge
                  variant="custom"
                  [background]="c.isActive ? 'var(--color-success)' : 'var(--color-neutral-03)'"
                  color="var(--color-neutral-07)"
                >
                  {{ c.isActive ? 'Active' : 'Inactive' }}
                </status-badge>
              </td>
              <td class="actions">
                <button type="button" (click)="startEdit(c)">Edit</button>
                <button type="button" class="danger" (click)="remove(c)">Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      [title]="editingId() ? 'Edit category' : 'New category'"
      [open]="formOpen()"
      [saving]="saving()"
      (openChange)="formOpen.set($event)"
      (cancel)="formOpen.set(false)"
      (save)="save()"
    >
      <text-field label="Name" [value]="form().name" (valueChange)="patch({ name: $event })" />
      <text-field label="Slug" [value]="form().slug" (valueChange)="patch({ slug: $event })" />
      <text-field
        label="Description"
        [value]="form().description"
        (valueChange)="patch({ description: $event })"
      />
      <select-field
        label="Parent category"
        [options]="parentOptions()"
        [value]="form().parentId"
        (valueChange)="patch({ parentId: $event })"
      />
      <text-field
        label="Position"
        type="number"
        [value]="form().position.toString()"
        (valueChange)="patch({ position: toNumber($event) })"
      />
      <text-field label="Image URL" [value]="form().imageUrl" (valueChange)="patch({ imageUrl: $event })" />
      <checkbox-field
        label="Active"
        [checked]="form().isActive"
        (checkedChange)="patch({ isActive: $event })"
      />
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;

    td.actions {
      display: flex;
      gap: var(--space-3);
      white-space: nowrap;
    }

    td.actions button {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
    }

    td.actions .danger {
      color: var(--color-error);
    }
  `,
})
export default class AdminCategories implements OnInit {
  private readonly categoriesService = inject(AdminCategoriesService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(AdminConfirmService);

  protected readonly categories = signal<AdminCategoryDto[]>([]);
  protected readonly loading = signal(true);

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly form = signal<CategoryFormModel>({ ...EMPTY_FORM });

  protected readonly parentOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'None (top level)' },
    ...this.categories()
      .filter((c) => c.id !== this.editingId())
      .map((c) => ({ value: c.id, label: c.name })),
  ]);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.categoriesService.list().subscribe({
      next: (list) => {
        this.categories.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected indent(category: AdminCategoryDto): string {
    // path is a slash-joined string of ancestor ids (category.schema.ts) — its
    // segment count is exactly the nesting depth, so this needs no separate tree walk.
    const depth = category.path.split('/').filter(Boolean).length;
    return '—'.repeat(depth) + (depth > 0 ? ' ' : '');
  }

  protected parentName(parentId: string | null): string {
    if (!parentId) return '—';
    return this.categories().find((c) => c.id === parentId)?.name ?? '—';
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.formOpen.set(true);
  }

  protected startEdit(category: AdminCategoryDto): void {
    this.editingId.set(category.id);
    this.form.set({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      parentId: category.parentId ?? '',
      position: category.position,
      imageUrl: category.imageUrl ?? '',
      isActive: category.isActive,
    });
    this.formOpen.set(true);
  }

  protected patch(partial: Partial<CategoryFormModel>): void {
    this.form.update((current) => ({ ...current, ...partial }));
  }

  protected toNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  protected save(): void {
    const value = this.form();
    if (!value.name.trim() || !value.slug.trim()) {
      this.toast.show('Name and slug are required', 'error');
      return;
    }

    const input: UpsertCategoryRequest = {
      name: value.name.trim(),
      slug: value.slug.trim(),
      description: value.description.trim() || undefined,
      parentId: value.parentId || null,
      position: value.position,
      imageUrl: value.imageUrl.trim() || undefined,
      isActive: value.isActive,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request = editingId
      ? this.categoriesService.update(editingId, input)
      : this.categoriesService.create(input);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.show(editingId ? 'Category updated' : 'Category created', 'success');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(category: AdminCategoryDto): void {
    this.confirmService
      .confirm({
        title: 'Delete this category?',
        message: `"${category.name}" will be removed. This is blocked while it has subcategories or assigned products.`,
        confirmLabel: 'Delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.categoriesService.delete(category.id).subscribe({
          next: () => {
            this.toast.show('Category deleted', 'success');
            this.load();
          },
        });
      });
  }
}
