import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  AdminCommentQuery,
  AdminPostQuery,
  CommentDto,
  Paginated,
  PostCategoryDto,
  PostDto,
  TagDto,
  UpsertPostCategoryRequest,
  UpsertPostRequest,
  UpsertTagRequest,
} from '@/app/core/api/dto';
import { toHttpParams } from '@/app/core/api/http-params';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminBlogService {
  private readonly api = inject(ApiClient);

  listPosts(query: AdminPostQuery): Observable<Paginated<PostDto>> {
    return this.api.get<Paginated<PostDto>>('/admin/blog/posts', toHttpParams({ ...query }));
  }

  getPost(id: string): Observable<PostDto> {
    return this.api.get<PostDto>(`/admin/blog/posts/${id}`);
  }

  createPost(input: UpsertPostRequest): Observable<PostDto> {
    return this.api.post<PostDto>('/admin/blog/posts', input);
  }

  updatePost(id: string, input: Partial<UpsertPostRequest>): Observable<PostDto> {
    return this.api.patch<PostDto>(`/admin/blog/posts/${id}`, input);
  }

  deletePost(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/blog/posts/${id}`);
  }

  listCategories(): Observable<PostCategoryDto[]> {
    return this.api.get<PostCategoryDto[]>('/admin/blog/categories');
  }

  createCategory(input: UpsertPostCategoryRequest): Observable<PostCategoryDto> {
    return this.api.post<PostCategoryDto>('/admin/blog/categories', input);
  }

  updateCategory(id: string, input: Partial<UpsertPostCategoryRequest>): Observable<PostCategoryDto> {
    return this.api.patch<PostCategoryDto>(`/admin/blog/categories/${id}`, input);
  }

  deleteCategory(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/blog/categories/${id}`);
  }

  listTags(): Observable<TagDto[]> {
    return this.api.get<TagDto[]>('/admin/blog/tags');
  }

  createTag(input: UpsertTagRequest): Observable<TagDto> {
    return this.api.post<TagDto>('/admin/blog/tags', input);
  }

  deleteTag(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/blog/tags/${id}`);
  }

  listComments(query: AdminCommentQuery): Observable<Paginated<CommentDto>> {
    return this.api.get<Paginated<CommentDto>>('/admin/blog/comments', toHttpParams({ ...query }));
  }

  approveComment(id: string): Observable<CommentDto> {
    return this.api.post<CommentDto>(`/admin/blog/comments/${id}/approve`, {});
  }

  rejectComment(id: string): Observable<CommentDto> {
    return this.api.post<CommentDto>(`/admin/blog/comments/${id}/reject`, {});
  }

  replyToComment(id: string, body: string): Observable<CommentDto> {
    return this.api.post<CommentDto>(`/admin/blog/comments/${id}/reply`, { body });
  }
}
