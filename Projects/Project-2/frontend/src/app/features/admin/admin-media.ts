import { NgOptimizedImage } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { MediaDto } from '@/app/core/api/dto';
import { AdminMediaService } from '@/app/core/services/admin-media.service';
import { ToastService } from '@/app/core/services/toast.service';
import { AdminConfirmService } from '@/app/features/admin/ui/admin-confirm.service';
import { EmptyState } from '@/app/features/admin/ui/empty-state';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { PaginationNav } from '@/app/shared/ui/pagination-nav';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';

const TAKE = 24;

@Component({
  selector: 'admin-media-page',
  imports: [NgOptimizedImage, EmptyState, PageToolbar, PaginationNav, SkeletonBlock],
  template: `
    <page-toolbar title="Media library" [subtitle]="total() + ' assets'">
      <label class="upload">
        {{ uploading() ? 'Uploading…' : 'Upload' }}
        <input type="file" accept="image/*" [disabled]="uploading()" (change)="onFileSelected($event)" />
      </label>
    </page-toolbar>

    @if (loading()) {
      <div class="grid">
        @for (n of skeletons; track n) {
          <skeleton-block height="140px" width="100%" radius="var(--radius-md)" />
        }
      </div>
    } @else if (items().length === 0) {
      <empty-state message="No uploads yet." icon="upload" />
    } @else {
      <div class="grid">
        @for (item of items(); track item.id) {
          <div class="tile">
            <img [ngSrc]="item.url" [alt]="item.publicId" width="140" height="140" />
            <span class="context">{{ item.ownerContext ?? 'unassigned' }}</span>
            <button type="button" (click)="remove(item)">Delete</button>
          </div>
        }
      </div>

      @if (pageCount() > 1) {
        <pagination-nav [page]="page()" [total]="pageCount()" (pageChange)="page.set($event); load()" />
      }
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    .upload {
      @include type.caption-1-semi;
      position: relative;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-neutral-07);
      color: var(--color-white);
      cursor: pointer;

      input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--space-4);
    }

    .tile {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);

      img {
        border-radius: var(--radius-md);
        object-fit: cover;
        aspect-ratio: 1;
      }
    }

    .context {
      @include type.caption-2;
      color: var(--color-neutral-04);
      text-transform: capitalize;
    }

    .tile button {
      @include type.caption-2-semi;
      align-self: flex-start;
      color: var(--color-error);
      text-decoration: underline;
    }

    pagination-nav {
      display: block;
      margin-top: var(--space-6);
    }
  `,
})
export default class AdminMedia implements OnInit {
  private readonly mediaService = inject(AdminMediaService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(AdminConfirmService);

  protected readonly items = signal<MediaDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly uploading = signal(false);
  protected readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.mediaService.list(this.page(), TAKE).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.mediaService.upload(file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.toast.show('Uploaded', 'success');
        this.load();
      },
      error: () => this.uploading.set(false),
    });
  }

  protected remove(item: MediaDto): void {
    this.confirmService
      .confirm({
        title: 'Delete this asset?',
        message: 'If it is still attached to a product, remove it from that product first.',
        confirmLabel: 'Delete',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.mediaService.delete(item.id).subscribe({
          next: () => {
            this.toast.show('Asset deleted', 'success');
            this.load();
          },
        });
      });
  }
}
