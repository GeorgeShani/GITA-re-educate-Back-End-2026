import { Component, OnInit, inject, signal } from '@angular/core';

import type { PageDto } from '@/app/core/api/dto';
import { AdminPagesService, type UpsertPageRequest } from '@/app/core/services/admin-pages.service';
import { ToastService } from '@/app/core/services/toast.service';
import { AdminConfirmService } from '@/app/features/admin/ui/admin-confirm.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { ActionButton } from '@/app/shared/ui/action-button';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { TextField } from '@/app/shared/ui/text-field';
import { TextareaField } from '@/app/shared/ui/textarea-field';

interface PageFormModel {
  title: string;
  slug: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
}

const EMPTY_FORM: PageFormModel = { title: '', slug: '', body: '', seoTitle: '', seoDescription: '' };

@Component({
  selector: 'admin-pages-page',
  imports: [ActionButton, DataTable, DrawerForm, EmptyState, PageToolbar, SkeletonBlock, TextField, TextareaField],
  template: `
    <page-toolbar title="Pages" [subtitle]="pages().length + ' total'">
      <action-button size="s" (click)="startCreate()">New page</action-button>
    </page-toolbar>

    @if (loading()) {
      <skeleton-block height="240px" width="100%" />
    } @else if (pages().length === 0) {
      <empty-state message="No static pages yet." icon="pencil" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (p of pages(); track p.id) {
            <tr>
              <td>{{ p.title }}</td>
              <td>/{{ p.slug }}</td>
              <td class="actions">
                <button type="button" (click)="startEdit(p)">Edit</button>
                <button type="button" class="danger" (click)="remove(p)">Delete</button>
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      [title]="editingId() ? 'Edit page' : 'New page'"
      [open]="formOpen()"
      [saving]="saving()"
      (openChange)="formOpen.set($event)"
      (cancel)="formOpen.set(false)"
      (save)="save()"
    >
      <text-field label="Title" [value]="form().title" (valueChange)="patch({ title: $event })" />
      <text-field label="Slug" [value]="form().slug" (valueChange)="patch({ slug: $event })" hint="Public URL is /<slug>" />
      <textarea-field label="Body (HTML)" [value]="form().body" (valueChange)="patch({ body: $event })" />
      <text-field label="SEO title (optional)" [value]="form().seoTitle" (valueChange)="patch({ seoTitle: $event })" />
      <text-field label="SEO description (optional)" [value]="form().seoDescription" (valueChange)="patch({ seoDescription: $event })" />
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
export default class AdminPages implements OnInit {
  private readonly pagesService = inject(AdminPagesService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(AdminConfirmService);

  protected readonly pages = signal<PageDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly form = signal<PageFormModel>({ ...EMPTY_FORM });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.pagesService.list().subscribe({
      next: (list) => {
        this.pages.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected patch(partial: Partial<PageFormModel>): void {
    this.form.update((current) => ({ ...current, ...partial }));
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.formOpen.set(true);
  }

  protected startEdit(page: PageDto): void {
    this.editingId.set(page.id);
    this.form.set({
      title: page.title,
      slug: page.slug,
      body: page.body,
      seoTitle: page.seoTitle ?? '',
      seoDescription: page.seoDescription ?? '',
    });
    this.formOpen.set(true);
  }

  protected save(): void {
    const value = this.form();
    if (!value.title.trim() || !value.slug.trim() || !value.body.trim()) {
      this.toast.show('Title, slug and body are required', 'error');
      return;
    }

    const input: UpsertPageRequest = {
      title: value.title.trim(),
      slug: value.slug.trim(),
      body: value.body,
      seoTitle: value.seoTitle.trim() || undefined,
      seoDescription: value.seoDescription.trim() || undefined,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request = editingId ? this.pagesService.update(editingId, input) : this.pagesService.create(input);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.show(editingId ? 'Page updated' : 'Page created', 'success');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(page: PageDto): void {
    this.confirmService
      .confirm({ title: 'Delete this page?', message: `"${page.title}" will be permanently removed.`, confirmLabel: 'Delete' })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.pagesService.delete(page.id).subscribe(() => {
          this.toast.show('Page deleted', 'success');
          this.load();
        });
      });
  }
}
