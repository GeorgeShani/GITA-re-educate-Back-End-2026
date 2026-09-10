import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type {
  AdminCommentQuery,
  CommentDto,
  CommentStatus,
  PostCategoryDto,
  PostDto,
  TagDto,
  UpsertPostCategoryRequest,
  UpsertPostRequest,
  UpsertTagRequest,
} from '@/app/core/api/dto';
import { AdminBlogService } from '@/app/core/services/admin-blog.service';
import { ToastService } from '@/app/core/services/toast.service';
import { toFilterValue, toUnionValue } from '@/app/core/util/string-union';
import { AdminConfirmService } from '@/app/features/admin/ui/admin-confirm.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { ActionButton } from '@/app/shared/ui/action-button';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { RichTextEditor } from '@/app/shared/ui/rich-text-editor';
import { TabGroup, type TabItem } from '@/app/shared/ui/tab-group';
import { TextField } from '@/app/shared/ui/text-field';

type BlogTab = 'posts' | 'categories' | 'tags' | 'comments';

const BLOG_TABS = ['posts', 'categories', 'tags', 'comments'] as const satisfies readonly BlogTab[];

const TABS: TabItem[] = [
  { id: 'posts', label: 'Posts' },
  { id: 'categories', label: 'Categories' },
  { id: 'tags', label: 'Tags' },
  { id: 'comments', label: 'Comments' },
];

const TAKE = 20;

const STATUS_MODE_OPTIONS: SelectOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published now' },
  { value: 'scheduled', label: 'Scheduled' },
];

const COMMENT_STATUSES = ['pending', 'approved', 'rejected'] as const satisfies readonly CommentStatus[];

const COMMENT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

interface PostFormModel {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  categoryId: string;
  tagIds: string[];
  statusMode: 'draft' | 'published' | 'scheduled';
  scheduledAt: string;
  seoTitle: string;
  seoDescription: string;
}

const POST_STATUS_MODES = [
  'draft',
  'published',
  'scheduled',
] as const satisfies readonly PostFormModel['statusMode'][];

const EMPTY_POST_FORM: PostFormModel = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  coverImageUrl: '',
  categoryId: '',
  tagIds: [],
  statusMode: 'draft',
  scheduledAt: '',
  seoTitle: '',
  seoDescription: '',
};

interface CategoryFormModel {
  name: string;
  slug: string;
}

const EMPTY_CATEGORY_FORM: CategoryFormModel = { name: '', slug: '' };

function postStatusInfo(post: PostDto): { label: string; color: string } {
  if (!post.publishedAt) return { label: 'Draft', color: 'var(--color-neutral-03)' };
  return new Date(post.publishedAt).getTime() > Date.now()
    ? { label: 'Scheduled', color: 'var(--color-info)' }
    : { label: 'Published', color: 'var(--color-success)' };
}

function commentStatusColor(status: CommentStatus): string {
  if (status === 'approved') return 'var(--color-success)';
  if (status === 'rejected') return 'var(--color-error)';
  return 'var(--color-neutral-03)';
}

/**
 * One page, four tabs — matches admin-shell.ts's single "Blog" nav entry.
 * Posts/Categories/Tags/Comments each got their own admin controller
 * server-side, but there's no reason to split them across four routes
 * a staff member has to navigate between separately.
 */
@Component({
  selector: 'admin-blog-page',
  imports: [
    ActionButton,
    CheckboxField,
    DataTable,
    DatePipe,
    DrawerForm,
    EmptyState,
    FilterBar,
    PageToolbar,
    SelectField,
    SkeletonBlock,
    RichTextEditor,
    StatusBadge,
    TabGroup,
    TextField,
  ],
  template: `
    <page-toolbar title="Blog" [subtitle]="tabSubtitle()">
      @switch (activeTab()) {
        @case ('posts') {
          <action-button size="s" (click)="startCreatePost()">New post</action-button>
        }
        @case ('categories') {
          <action-button size="s" (click)="startCreateCategory()">New category</action-button>
        }
        @case ('tags') {
          <action-button size="s" (click)="startCreateTag()">New tag</action-button>
        }
      }
    </page-toolbar>

    <tab-group [tabs]="tabs" [selected]="activeTab()" ariaLabel="Blog admin" (selectedChange)="selectTab($event)" />

    <div class="panel" role="tabpanel">
      @switch (activeTab()) {
        @case ('posts') {
          @if (postsLoading()) {
            <skeleton-block height="320px" width="100%" />
          } @else if (posts().length === 0) {
            <empty-state message="No posts yet." icon="pencil" />
          } @else {
            <data-table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (p of posts(); track p.id) {
                  <tr>
                    <td>{{ p.title }}</td>
                    <td>{{ categoryName(p.categoryId) }}</td>
                    <td>
                      <status-badge variant="custom" [background]="postStatus(p).color" color="var(--color-neutral-07)">
                        {{ postStatus(p).label }}
                      </status-badge>
                    </td>
                    <td>{{ p.updatedAt | date: 'mediumDate' }}</td>
                    <td class="actions">
                      <button type="button" (click)="quickTogglePublish(p)">{{ quickPublishLabel(p) }}</button>
                      <button type="button" (click)="startEditPost(p)">Edit</button>
                      <button type="button" class="danger" (click)="deletePost(p)">Delete</button>
                    </td>
                  </tr>
                }
              </tbody>
            </data-table>
          }
        }
        @case ('categories') {
          @if (categoriesLoading()) {
            <skeleton-block height="240px" width="100%" />
          } @else if (categories().length === 0) {
            <empty-state message="No categories yet." icon="sliders-horizontal" />
          } @else {
            <data-table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of categories(); track c.id) {
                  <tr>
                    <td>{{ c.name }}</td>
                    <td>{{ c.slug }}</td>
                    <td class="actions">
                      <button type="button" (click)="startEditCategory(c)">Edit</button>
                      <button type="button" class="danger" (click)="deleteCategory(c)">Delete</button>
                    </td>
                  </tr>
                }
              </tbody>
            </data-table>
          }
        }
        @case ('tags') {
          @if (tagsLoading()) {
            <skeleton-block height="200px" width="100%" />
          } @else if (tags().length === 0) {
            <empty-state message="No tags yet." icon="sparkles" />
          } @else {
            <data-table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (t of tags(); track t.id) {
                  <tr>
                    <td>{{ t.name }}</td>
                    <td class="actions">
                      <button type="button" class="danger" (click)="deleteTag(t)">Delete</button>
                    </td>
                  </tr>
                }
              </tbody>
            </data-table>
          }
        }
        @case ('comments') {
          <filter-bar>
            <select-field label="Status" [options]="commentStatusOptions" [value]="commentStatusFilter()" (valueChange)="onCommentStatusChange($event)" />
          </filter-bar>

          @if (commentsLoading()) {
            <skeleton-block height="320px" width="100%" />
          } @else if (comments().length === 0) {
            <empty-state message="Nothing in this queue." icon="mail" />
          } @else {
            <data-table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Author</th>
                  <th>Comment</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of comments(); track c.id) {
                  <tr>
                    <td>{{ postTitle(c.postId) }}</td>
                    <td>{{ c.authorName }}</td>
                    <td class="body">{{ c.body }}</td>
                    <td>{{ c.createdAt | date: 'mediumDate' }}</td>
                    <td>
                      <status-badge variant="custom" [background]="commentStatusColor(c.status)" color="var(--color-neutral-07)">
                        {{ c.status }}
                      </status-badge>
                    </td>
                    <td class="actions">
                      @if (c.status === 'pending') {
                        <button type="button" (click)="approveComment(c)">Approve</button>
                        <button type="button" class="danger" (click)="rejectComment(c)">Reject</button>
                      }
                      <button type="button" (click)="startReply(c)">Reply</button>
                    </td>
                  </tr>
                }
              </tbody>
            </data-table>
          }
        }
      }
    </div>

    <drawer-form
      [title]="editingPostId() ? 'Edit post' : 'New post'"
      [open]="postFormOpen()"
      [saving]="postSaving()"
      (openChange)="postFormOpen.set($event)"
      (cancel)="postFormOpen.set(false)"
      (save)="savePost()"
    >
      <text-field label="Title" [value]="postForm().title" (valueChange)="patchPost({ title: $event })" />
      <text-field label="Slug" [value]="postForm().slug" (valueChange)="patchPost({ slug: $event })" />
      <text-field label="Excerpt (optional)" [value]="postForm().excerpt" (valueChange)="patchPost({ excerpt: $event })" />
      <rich-text-editor label="Body" [value]="postForm().body" (valueChange)="patchPost({ body: $event })" />
      <text-field label="Cover image URL (optional)" [value]="postForm().coverImageUrl" (valueChange)="patchPost({ coverImageUrl: $event })" />
      <select-field label="Category" [options]="categoryOptions()" [value]="postForm().categoryId" (valueChange)="patchPost({ categoryId: $event })" />

      <div class="tags-field">
        <span class="tags-label">Tags</span>
        <div class="tags-list">
          @for (t of tags(); track t.id) {
            <checkbox-field [label]="t.name" [checked]="isTagSelected(t.id)" (checkedChange)="toggleTag(t.id, $event)" />
          }
        </div>
      </div>

      <select-field label="Status" [options]="statusModeOptions" [value]="postForm().statusMode" (valueChange)="onStatusModeChange($event)" />
      @if (postForm().statusMode === 'scheduled') {
        <text-field label="Scheduled for" [value]="postForm().scheduledAt" (valueChange)="patchPost({ scheduledAt: $event })" hint="YYYY-MM-DD or full ISO" />
      }
      <text-field label="SEO title (optional)" [value]="postForm().seoTitle" (valueChange)="patchPost({ seoTitle: $event })" />
      <text-field label="SEO description (optional)" [value]="postForm().seoDescription" (valueChange)="patchPost({ seoDescription: $event })" />
    </drawer-form>

    <drawer-form
      [title]="editingCategoryId() ? 'Edit category' : 'New category'"
      [open]="categoryFormOpen()"
      [saving]="categorySaving()"
      (openChange)="categoryFormOpen.set($event)"
      (cancel)="categoryFormOpen.set(false)"
      (save)="saveCategory()"
    >
      <text-field label="Name" [value]="categoryForm().name" (valueChange)="patchCategory({ name: $event })" />
      <text-field label="Slug" [value]="categoryForm().slug" (valueChange)="patchCategory({ slug: $event })" />
    </drawer-form>

    <drawer-form
      title="New tag"
      [open]="tagFormOpen()"
      [saving]="tagSaving()"
      saveLabel="Create"
      (openChange)="tagFormOpen.set($event)"
      (cancel)="tagFormOpen.set(false)"
      (save)="saveTag()"
    >
      <text-field label="Name" [value]="tagName()" (valueChange)="tagName.set($event)" />
    </drawer-form>

    <drawer-form
      title="Reply to comment"
      [open]="replyFormOpen()"
      [saving]="commentActing()"
      saveLabel="Post reply"
      (openChange)="replyFormOpen.set($event)"
      (cancel)="replyFormOpen.set(false)"
      (save)="reply()"
    >
      <text-field label="Reply" [value]="replyText()" (valueChange)="replyText.set($event)" />
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;

    .panel {
      padding-top: var(--space-6);
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

    .body {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tags-field {
      display: block;
    }

    .tags-label {
      @include type.caption-1-semi;
      display: block;
      margin-bottom: var(--space-2);
    }

    .tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-4);
    }
  `,
})
export default class AdminBlog implements OnInit {
  private readonly blogService = inject(AdminBlogService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(AdminConfirmService);

  protected readonly tabs = TABS;
  protected readonly statusModeOptions = STATUS_MODE_OPTIONS;
  protected readonly commentStatusOptions = COMMENT_STATUS_OPTIONS;
  protected readonly postStatus = postStatusInfo;
  protected readonly commentStatusColor = commentStatusColor;

  protected readonly activeTab = signal<BlogTab>('posts');
  private commentsLoaded = false;

  // -- posts --
  protected readonly posts = signal<PostDto[]>([]);
  protected readonly postsLoading = signal(true);
  protected readonly postFormOpen = signal(false);
  protected readonly postSaving = signal(false);
  protected readonly editingPostId = signal<string | null>(null);
  protected readonly postForm = signal<PostFormModel>({ ...EMPTY_POST_FORM });

  // -- categories --
  protected readonly categories = signal<PostCategoryDto[]>([]);
  protected readonly categoriesLoading = signal(true);
  protected readonly categoryFormOpen = signal(false);
  protected readonly categorySaving = signal(false);
  protected readonly editingCategoryId = signal<string | null>(null);
  protected readonly categoryForm = signal<CategoryFormModel>({ ...EMPTY_CATEGORY_FORM });

  protected readonly categoryOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'None' },
    ...this.categories().map((c) => ({ value: c.id, label: c.name })),
  ]);

  // -- tags --
  protected readonly tags = signal<TagDto[]>([]);
  protected readonly tagsLoading = signal(true);
  protected readonly tagFormOpen = signal(false);
  protected readonly tagSaving = signal(false);
  protected readonly tagName = signal('');

  // -- comments --
  protected readonly comments = signal<CommentDto[]>([]);
  protected readonly commentsTotal = signal(0);
  protected readonly commentsLoading = signal(true);
  protected readonly commentStatusFilter = signal<CommentStatus>('pending');
  protected readonly commentActing = signal(false);
  protected readonly replyFormOpen = signal(false);
  protected readonly replyText = signal('');
  private replyTarget: CommentDto | null = null;
  private readonly postTitles = signal<Record<string, string>>({});

  protected readonly tabSubtitle = computed(() => {
    switch (this.activeTab()) {
      case 'posts':
        return this.posts().length + ' posts';
      case 'categories':
        return this.categories().length + ' categories';
      case 'tags':
        return this.tags().length + ' tags';
      case 'comments':
        return this.commentsTotal() + ' comments';
    }
  });

  ngOnInit(): void {
    this.loadCategories();
    this.loadTags();
    this.loadPosts();
  }

  protected selectTab(id: string): void {
    this.activeTab.set(toUnionValue(id, BLOG_TABS) ?? this.activeTab());
    if (id === 'comments' && !this.commentsLoaded) {
      this.commentsLoaded = true;
      this.loadComments();
    }
  }

  // -- posts --

  private loadPosts(): void {
    this.postsLoading.set(true);
    this.blogService.listPosts({ page: 1, take: 100 }).subscribe({
      next: (result) => {
        this.posts.set(result.items);
        this.postsLoading.set(false);
      },
      error: () => this.postsLoading.set(false),
    });
  }

  protected categoryName(categoryId: string | undefined): string {
    if (!categoryId) return '—';
    return this.categories().find((c) => c.id === categoryId)?.name ?? '—';
  }

  protected quickPublishLabel(post: PostDto): string {
    const isLive = !!post.publishedAt && new Date(post.publishedAt).getTime() <= Date.now();
    return isLive ? 'Unpublish' : 'Publish now';
  }

  protected quickTogglePublish(post: PostDto): void {
    const isLive = !!post.publishedAt && new Date(post.publishedAt).getTime() <= Date.now();
    this.blogService.updatePost(post.id, { publishedAt: isLive ? null : new Date().toISOString() }).subscribe(() => {
      this.toast.show(isLive ? 'Post unpublished' : 'Post published', 'success');
      this.loadPosts();
    });
  }

  protected patchPost(partial: Partial<PostFormModel>): void {
    this.postForm.update((current) => ({ ...current, ...partial }));
  }

  protected onStatusModeChange(value: string): void {
    this.patchPost({ statusMode: toUnionValue(value, POST_STATUS_MODES) ?? this.postForm().statusMode });
  }

  protected isTagSelected(id: string): boolean {
    return this.postForm().tagIds.includes(id);
  }

  protected toggleTag(id: string, checked: boolean): void {
    this.postForm.update((current) => ({
      ...current,
      tagIds: checked ? [...current.tagIds, id] : current.tagIds.filter((t) => t !== id),
    }));
  }

  protected startCreatePost(): void {
    this.editingPostId.set(null);
    this.postForm.set({ ...EMPTY_POST_FORM });
    this.postFormOpen.set(true);
  }

  protected startEditPost(post: PostDto): void {
    this.editingPostId.set(post.id);
    const isScheduled = !!post.publishedAt && new Date(post.publishedAt).getTime() > Date.now();
    this.postForm.set({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt ?? '',
      body: post.body,
      coverImageUrl: post.coverImageUrl ?? '',
      categoryId: post.categoryId ?? '',
      tagIds: [...post.tagIds],
      statusMode: !post.publishedAt ? 'draft' : isScheduled ? 'scheduled' : 'published',
      scheduledAt: isScheduled && post.publishedAt ? post.publishedAt : '',
      seoTitle: post.seoTitle ?? '',
      seoDescription: post.seoDescription ?? '',
    });
    this.postFormOpen.set(true);
  }

  protected savePost(): void {
    const value = this.postForm();
    if (!value.title.trim() || !value.slug.trim() || !value.body.trim()) {
      this.toast.show('Title, slug and body are required', 'error');
      return;
    }

    let publishedAt: string | null | undefined;
    if (value.statusMode === 'draft') {
      publishedAt = this.editingPostId() ? null : undefined;
    } else if (value.statusMode === 'published') {
      publishedAt = new Date().toISOString();
    } else {
      publishedAt = value.scheduledAt ? new Date(value.scheduledAt).toISOString() : undefined;
    }

    const input: UpsertPostRequest = {
      title: value.title.trim(),
      slug: value.slug.trim(),
      excerpt: value.excerpt.trim() || undefined,
      body: value.body,
      coverImageUrl: value.coverImageUrl.trim() || undefined,
      categoryId: value.categoryId || undefined,
      tagIds: value.tagIds,
      publishedAt,
      seoTitle: value.seoTitle.trim() || undefined,
      seoDescription: value.seoDescription.trim() || undefined,
    };

    this.postSaving.set(true);
    const editingId = this.editingPostId();
    const request = editingId ? this.blogService.updatePost(editingId, input) : this.blogService.createPost(input);
    request.subscribe({
      next: () => {
        this.postSaving.set(false);
        this.postFormOpen.set(false);
        this.toast.show(editingId ? 'Post updated' : 'Post created', 'success');
        this.loadPosts();
      },
      error: () => this.postSaving.set(false),
    });
  }

  protected deletePost(post: PostDto): void {
    this.confirmService
      .confirm({ title: 'Delete this post?', message: `"${post.title}" will be permanently removed.`, confirmLabel: 'Delete' })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.blogService.deletePost(post.id).subscribe(() => {
          this.toast.show('Post deleted', 'success');
          this.loadPosts();
        });
      });
  }

  // -- categories --

  private loadCategories(): void {
    this.categoriesLoading.set(true);
    this.blogService.listCategories().subscribe({
      next: (list) => {
        this.categories.set(list);
        this.categoriesLoading.set(false);
      },
      error: () => this.categoriesLoading.set(false),
    });
  }

  protected patchCategory(partial: Partial<CategoryFormModel>): void {
    this.categoryForm.update((current) => ({ ...current, ...partial }));
  }

  protected startCreateCategory(): void {
    this.editingCategoryId.set(null);
    this.categoryForm.set({ ...EMPTY_CATEGORY_FORM });
    this.categoryFormOpen.set(true);
  }

  protected startEditCategory(category: PostCategoryDto): void {
    this.editingCategoryId.set(category.id);
    this.categoryForm.set({ name: category.name, slug: category.slug });
    this.categoryFormOpen.set(true);
  }

  protected saveCategory(): void {
    const value = this.categoryForm();
    if (!value.name.trim() || !value.slug.trim()) {
      this.toast.show('Name and slug are required', 'error');
      return;
    }

    const input: UpsertPostCategoryRequest = { name: value.name.trim(), slug: value.slug.trim() };
    this.categorySaving.set(true);
    const editingId = this.editingCategoryId();
    const request = editingId ? this.blogService.updateCategory(editingId, input) : this.blogService.createCategory(input);
    request.subscribe({
      next: () => {
        this.categorySaving.set(false);
        this.categoryFormOpen.set(false);
        this.toast.show(editingId ? 'Category updated' : 'Category created', 'success');
        this.loadCategories();
      },
      error: () => this.categorySaving.set(false),
    });
  }

  protected deleteCategory(category: PostCategoryDto): void {
    this.confirmService
      .confirm({ title: 'Delete this category?', message: `"${category.name}" will be removed from every post using it.`, confirmLabel: 'Delete' })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.blogService.deleteCategory(category.id).subscribe(() => {
          this.toast.show('Category deleted', 'success');
          this.loadCategories();
        });
      });
  }

  // -- tags --

  private loadTags(): void {
    this.tagsLoading.set(true);
    this.blogService.listTags().subscribe({
      next: (list) => {
        this.tags.set(list);
        this.tagsLoading.set(false);
      },
      error: () => this.tagsLoading.set(false),
    });
  }

  protected startCreateTag(): void {
    this.tagName.set('');
    this.tagFormOpen.set(true);
  }

  protected saveTag(): void {
    const name = this.tagName().trim();
    if (!name) {
      this.toast.show('A name is required', 'error');
      return;
    }

    const input: UpsertTagRequest = { name };
    this.tagSaving.set(true);
    this.blogService.createTag(input).subscribe({
      next: () => {
        this.tagSaving.set(false);
        this.tagFormOpen.set(false);
        this.toast.show('Tag created', 'success');
        this.loadTags();
      },
      error: () => this.tagSaving.set(false),
    });
  }

  protected deleteTag(tag: TagDto): void {
    this.confirmService
      .confirm({ title: 'Delete this tag?', message: `"${tag.name}" will be removed from every post using it.`, confirmLabel: 'Delete' })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.blogService.deleteTag(tag.id).subscribe(() => {
          this.toast.show('Tag deleted', 'success');
          this.loadTags();
        });
      });
  }

  // -- comments --

  private loadComments(): void {
    this.commentsLoading.set(true);
    const query: AdminCommentQuery = {
      status: this.commentStatusFilter(),
      page: 1,
      take: TAKE,
    };
    this.blogService.listComments(query).subscribe({
      next: (result) => {
        this.comments.set(result.items);
        this.commentsTotal.set(result.total);
        this.commentsLoading.set(false);
        this.resolvePostTitles(result.items);
      },
      error: () => this.commentsLoading.set(false),
    });
  }

  private resolvePostTitles(comments: CommentDto[]): void {
    const cache = this.postTitles();
    const missing = [...new Set(comments.map((c) => c.postId))].filter((id) => !(id in cache));
    for (const id of missing) {
      this.blogService.getPost(id).subscribe({
        next: (post) => this.postTitles.update((current) => ({ ...current, [id]: post.title })),
        error: () => this.postTitles.update((current) => ({ ...current, [id]: id })),
      });
    }
  }

  protected postTitle(postId: string): string {
    return this.postTitles()[postId] ?? postId;
  }

  protected onCommentStatusChange(value: string): void {
    this.commentStatusFilter.set(toUnionValue(value, COMMENT_STATUSES) ?? this.commentStatusFilter());
    this.loadComments();
  }

  protected approveComment(comment: CommentDto): void {
    this.blogService.approveComment(comment.id).subscribe(() => {
      this.toast.show('Comment approved', 'success');
      this.loadComments();
    });
  }

  protected rejectComment(comment: CommentDto): void {
    this.blogService.rejectComment(comment.id).subscribe(() => {
      this.toast.show('Comment rejected', 'success');
      this.loadComments();
    });
  }

  protected startReply(comment: CommentDto): void {
    this.replyTarget = comment;
    this.replyText.set('');
    this.replyFormOpen.set(true);
  }

  protected reply(): void {
    if (!this.replyTarget || !this.replyText().trim()) return;
    this.commentActing.set(true);
    this.blogService.replyToComment(this.replyTarget.id, this.replyText().trim()).subscribe({
      next: () => {
        this.commentActing.set(false);
        this.replyFormOpen.set(false);
        this.toast.show('Reply posted', 'success');
        this.loadComments();
      },
      error: () => this.commentActing.set(false),
    });
  }
}
