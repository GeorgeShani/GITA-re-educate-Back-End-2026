import { NgOptimizedImage } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type {
  AdminCategoryDto,
  ProductDto,
  ProductImageInput,
  ProductVariantInput,
  UpsertProductRequest,
} from '@/app/core/api/dto';
import { AdminCategoriesService } from '@/app/core/services/admin-categories.service';
import { AdminMediaService } from '@/app/core/services/admin-media.service';
import { AdminProductsService } from '@/app/core/services/admin-products.service';
import { ToastService } from '@/app/core/services/toast.service';
import { firstSelectedFile } from '@/app/core/util/dom-event';
import { AdminConfirmService } from '@/app/features/admin/ui/admin-confirm.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/features/admin/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { ActionButton } from '@/app/shared/ui/action-button';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { PaginationNav } from '@/app/shared/ui/pagination-nav';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

const TAKE = 20;

/** One editable variant row — attributes stay a single "key:value, key:value" text field rather than a full sub-editor, given the attribute set is genuinely open-ended (product.schema.ts's own comment). */
interface VariantRow {
  sku: string;
  attributesText: string;
  priceDollars: string;
  isActive: boolean;
}

interface ProductFormModel {
  name: string;
  slug: string;
  brand: string;
  description: string;
  categoryId: string;
  basePriceDollars: string;
  compareAtPriceDollars: string;
  tagsText: string;
  images: ProductImageInput[];
  variants: VariantRow[];
  isFeatured: boolean;
  publish: boolean;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY_FORM: ProductFormModel = {
  name: '',
  slug: '',
  brand: '',
  description: '',
  categoryId: '',
  basePriceDollars: '',
  compareAtPriceDollars: '',
  tagsText: '',
  images: [],
  variants: [],
  isFeatured: false,
  publish: false,
  seoTitle: '',
  seoDescription: '',
};

@Component({
  selector: 'admin-products-page',
  imports: [
    NgOptimizedImage,
    ActionButton,
    CheckboxField,
    DataTable,
    DrawerForm,
    EmptyState,
    FilterBar,
    MoneyPipe,
    PageToolbar,
    PaginationNav,
    SelectField,
    SkeletonBlock,
    StatusBadge,
    TextField,
  ],
  template: `
    <page-toolbar title="Products" [subtitle]="total() + ' total'">
      <action-button size="s" (click)="startCreate()">New product</action-button>
    </page-toolbar>

    <filter-bar>
      <select-field
        label="Category"
        [options]="categoryFilterOptions()"
        [value]="categoryFilter()"
        (valueChange)="onCategoryFilterChange($event)"
      />
      <select-field
        label="Status"
        [options]="statusOptions"
        [value]="statusFilter()"
        (valueChange)="onStatusFilterChange($event)"
      />
    </filter-bar>

    @if (loading()) {
      <skeleton-block height="320px" width="100%" />
    } @else if (products().length === 0) {
      <empty-state message="No products match those filters." icon="store" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Brand</th>
            <th>Price</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (p of products(); track p.id) {
            <tr>
              <td class="thumb">
                @if (p.images[0]?.url) {
                  <img [ngSrc]="p.images[0].url" alt="" width="40" height="40" />
                }
              </td>
              <td>{{ p.name }}</td>
              <td>{{ p.brand || '—' }}</td>
              <td data-numeric>{{ p.basePriceMinor | money }}</td>
              <td>
                <status-badge
                  variant="custom"
                  [background]="p.publishedAt ? 'var(--color-success)' : 'var(--color-neutral-03)'"
                  color="var(--color-neutral-07)"
                >
                  {{ p.publishedAt ? 'Published' : 'Draft' }}
                </status-badge>
              </td>
              <td class="actions">
                <button type="button" (click)="startEdit(p)">Edit</button>
                <button type="button" class="danger" (click)="remove(p)">Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </data-table>

      @if (pageCount() > 1) {
        <pagination-nav [page]="page()" [total]="pageCount()" (pageChange)="page.set($event); load()" />
      }
    }

    <drawer-form
      [title]="editingId() ? 'Edit product' : 'New product'"
      [open]="formOpen()"
      [saving]="saving()"
      saveLabel="Save product"
      (openChange)="formOpen.set($event)"
      (cancel)="formOpen.set(false)"
      (save)="save()"
    >
      <text-field label="Name" [value]="form().name" (valueChange)="patch({ name: $event })" />
      <text-field label="Slug" [value]="form().slug" (valueChange)="patch({ slug: $event })" />
      <text-field label="Brand" [value]="form().brand" (valueChange)="patch({ brand: $event })" />
      <text-field
        label="Description"
        [value]="form().description"
        (valueChange)="patch({ description: $event })"
      />
      <select-field
        label="Category"
        [options]="categoryOptions()"
        [value]="form().categoryId"
        (valueChange)="patch({ categoryId: $event })"
      />
      <text-field
        label="Base price (USD)"
        type="number"
        [value]="form().basePriceDollars"
        (valueChange)="patch({ basePriceDollars: $event })"
      />
      <text-field
        label="Compare-at price (USD, optional)"
        type="number"
        [value]="form().compareAtPriceDollars"
        (valueChange)="patch({ compareAtPriceDollars: $event })"
      />
      <text-field
        label="Tags (comma separated)"
        [value]="form().tagsText"
        (valueChange)="patch({ tagsText: $event })"
      />

      <div class="section">
        <div class="section-head">
          <h3>Images</h3>
          <label class="upload">
            {{ uploading() ? 'Uploading…' : 'Upload' }}
            <input type="file" accept="image/*" [disabled]="uploading()" (change)="onFileSelected($event)" />
          </label>
        </div>
        @if (form().images.length === 0) {
          <p class="hint">No images yet.</p>
        } @else {
          <ul class="image-list" role="list">
            @for (image of form().images; track image.publicId; let i = $index) {
              <li>
                <img [ngSrc]="image.url" [alt]="image.alt" width="48" height="48" />
                <span>{{ image.alt }}</span>
                <button type="button" (click)="removeImage(i)">Remove</button>
              </li>
            }
          </ul>
        }
      </div>

      <div class="section">
        <div class="section-head">
          <h3>Variants</h3>
          <button type="button" (click)="addVariant()">Add variant</button>
        </div>
        @if (form().variants.length === 0) {
          <p class="hint">No variants — the base price applies to every purchase.</p>
        } @else {
          @for (variant of form().variants; track $index; let i = $index) {
            <div class="variant-row">
              <text-field label="SKU" [value]="variant.sku" (valueChange)="patchVariant(i, { sku: $event })" />
              <text-field
                label="Attributes (key:value, key:value)"
                [value]="variant.attributesText"
                (valueChange)="patchVariant(i, { attributesText: $event })"
              />
              <text-field
                label="Price override (USD, optional)"
                type="number"
                [value]="variant.priceDollars"
                (valueChange)="patchVariant(i, { priceDollars: $event })"
              />
              <checkbox-field
                label="Active"
                [checked]="variant.isActive"
                (checkedChange)="patchVariant(i, { isActive: $event })"
              />
              <button type="button" class="danger" (click)="removeVariant(i)">Remove variant</button>
            </div>
          }
        }
      </div>

      <checkbox-field
        label="Featured"
        [checked]="form().isFeatured"
        (checkedChange)="patch({ isFeatured: $event })"
      />
      <checkbox-field
        label="Published"
        [checked]="form().publish"
        (checkedChange)="patch({ publish: $event })"
      />

      <div class="section">
        <h3>SEO</h3>
        <text-field label="SEO title" [value]="form().seoTitle" (valueChange)="patch({ seoTitle: $event })" />
        <text-field
          label="SEO description"
          [value]="form().seoDescription"
          (valueChange)="patch({ seoDescription: $event })"
        />
      </div>
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;

    td.thumb img {
      border-radius: var(--radius-sm);
      object-fit: cover;
    }

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

    pagination-nav {
      display: block;
      margin-top: var(--space-6);
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
      margin: 0 0 var(--space-3);
      color: var(--color-neutral-07);
    }

    .section-head h3 {
      margin: 0;
    }

    .hint {
      @include type.caption-2;
      margin: 0;
      color: var(--color-neutral-04);
    }

    .upload {
      @include type.caption-1-semi;
      position: relative;
      color: var(--color-neutral-07);
      text-decoration: underline;
      cursor: pointer;

      input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
    }

    .image-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .image-list li {
      display: flex;
      align-items: center;
      gap: var(--space-3);

      img {
        border-radius: var(--radius-sm);
        object-fit: cover;
      }

      span {
        @include type.caption-1;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      button {
        @include type.caption-2-semi;
        color: var(--color-error);
        text-decoration: underline;
      }
    }

    .variant-row {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      margin-bottom: var(--space-3);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);

      button.danger {
        @include type.caption-2-semi;
        align-self: flex-start;
        color: var(--color-error);
        text-decoration: underline;
      }
    }
  `,
})
export default class AdminProducts implements OnInit {
  private readonly productsService = inject(AdminProductsService);
  private readonly categoriesService = inject(AdminCategoriesService);
  private readonly mediaService = inject(AdminMediaService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(AdminConfirmService);

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All' },
    { value: 'true', label: 'Published' },
    { value: 'false', label: 'Draft' },
  ];

  protected readonly products = signal<ProductDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly uploading = signal(false);
  protected readonly categoryFilter = signal('');
  protected readonly statusFilter = signal('');

  protected readonly categories = signal<AdminCategoryDto[]>([]);
  protected readonly categoryFilterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All categories' },
    ...this.categories().map((c) => ({ value: c.id, label: c.name })),
  ]);
  protected readonly categoryOptions = computed<SelectOption[]>(() =>
    this.categories().map((c) => ({ value: c.id, label: c.name })),
  );

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly form = signal<ProductFormModel>({ ...EMPTY_FORM });

  ngOnInit(): void {
    this.categoriesService.list().subscribe((list) => this.categories.set(list));
    this.load();
  }

  protected onCategoryFilterChange(value: string): void {
    this.categoryFilter.set(value);
    this.page.set(1);
    this.load();
  }

  protected onStatusFilterChange(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.productsService
      .list({
        category: this.categoryFilter() || undefined,
        isPublished: this.statusFilter() === '' ? undefined : this.statusFilter() === 'true',
        page: this.page(),
        take: TAKE,
      })
      .subscribe({
        next: (result) => {
          this.products.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.formOpen.set(true);
  }

  protected startEdit(product: ProductDto): void {
    this.editingId.set(product.id);
    this.form.set({
      name: product.name,
      slug: product.slug,
      brand: product.brand ?? '',
      description: product.description,
      categoryId: product.categoryId,
      basePriceDollars: (product.basePriceMinor / 100).toString(),
      compareAtPriceDollars: product.compareAtPriceMinor ? (product.compareAtPriceMinor / 100).toString() : '',
      tagsText: product.tags.join(', '),
      images: product.images.map((img) => ({
        publicId: img.publicId,
        url: img.url,
        width: img.width,
        height: img.height,
        alt: img.alt,
        position: img.position,
      })),
      variants: product.variants.map((v) => ({
        sku: v.sku,
        attributesText: Object.entries(v.attributes)
          .map(([k, val]) => `${k}:${val}`)
          .join(', '),
        priceDollars: v.priceMinor ? (v.priceMinor / 100).toString() : '',
        isActive: v.isActive,
      })),
      isFeatured: product.isFeatured,
      publish: product.publishedAt !== null,
      seoTitle: product.seoTitle ?? '',
      seoDescription: product.seoDescription ?? '',
    });
    this.formOpen.set(true);
  }

  protected patch(partial: Partial<ProductFormModel>): void {
    this.form.update((current) => ({ ...current, ...partial }));
  }

  protected patchVariant(index: number, partial: Partial<VariantRow>): void {
    this.form.update((current) => ({
      ...current,
      variants: current.variants.map((v, i) => (i === index ? { ...v, ...partial } : v)),
    }));
  }

  protected addVariant(): void {
    this.form.update((current) => ({
      ...current,
      variants: [...current.variants, { sku: '', attributesText: '', priceDollars: '', isActive: true }],
    }));
  }

  protected removeVariant(index: number): void {
    this.form.update((current) => ({
      ...current,
      variants: current.variants.filter((_, i) => i !== index),
    }));
  }

  protected removeImage(index: number): void {
    this.form.update((current) => ({
      ...current,
      images: current.images.filter((_, i) => i !== index),
    }));
  }

  protected onFileSelected(event: Event): void {
    const file = firstSelectedFile(event);
    if (!file) return;
    this.uploading.set(true);
    this.mediaService.upload(file).subscribe({
      next: (media) => {
        this.uploading.set(false);
        this.form.update((current) => ({
          ...current,
          images: [
            ...current.images,
            {
              publicId: media.publicId,
              url: media.url,
              width: media.width,
              height: media.height,
              alt: this.form().name || 'Product image',
              position: current.images.length,
            },
          ],
        }));
      },
      error: () => this.uploading.set(false),
    });
  }

  protected save(): void {
    const value = this.form();
    if (!value.name.trim() || !value.slug.trim() || !value.categoryId || !value.basePriceDollars) {
      this.toast.show('Name, slug, category, and base price are required', 'error');
      return;
    }

    const variants: ProductVariantInput[] = value.variants
      .filter((v) => v.sku.trim())
      .map((v) => ({
        sku: v.sku.trim(),
        attributes: parseAttributes(v.attributesText),
        priceMinor: v.priceDollars ? toMinor(v.priceDollars) : undefined,
        isActive: v.isActive,
      }));

    const input: UpsertProductRequest = {
      name: value.name.trim(),
      slug: value.slug.trim(),
      brand: value.brand.trim() || undefined,
      description: value.description.trim(),
      categoryId: value.categoryId,
      basePriceMinor: toMinor(value.basePriceDollars),
      compareAtPriceMinor: value.compareAtPriceDollars ? toMinor(value.compareAtPriceDollars) : undefined,
      tags: value.tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      images: value.images,
      variants,
      isFeatured: value.isFeatured,
      publish: value.publish,
      seoTitle: value.seoTitle.trim() || undefined,
      seoDescription: value.seoDescription.trim() || undefined,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request = editingId
      ? this.productsService.update(editingId, input)
      : this.productsService.create(input);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.show(editingId ? 'Product updated' : 'Product created', 'success');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(product: ProductDto): void {
    this.confirmService
      .confirm({
        title: 'Delete this product?',
        message: `"${product.name}" must be unpublished first. This can't be undone.`,
        confirmLabel: 'Delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.productsService.delete(product.id).subscribe({
          next: () => {
            this.toast.show('Product deleted', 'success');
            this.load();
          },
        });
      });
  }
}

function toMinor(dollars: string): number {
  const parsed = Number.parseFloat(dollars);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function parseAttributes(text: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const pair of text.split(',')) {
    const [key, val] = pair.split(':').map((s) => s.trim());
    if (key && val) attributes[key] = val;
  }
  return attributes;
}
