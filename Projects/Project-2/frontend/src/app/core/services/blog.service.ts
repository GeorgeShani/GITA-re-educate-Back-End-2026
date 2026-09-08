import { httpResource } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  CommentDto,
  Paginated,
  PostCategoryDto,
  PostDto,
  PostQuery,
  SubmitCommentRequest,
  TagDto,
} from '@/app/core/api/dto';
import { API_BASE_URL, ApiClient } from '@/app/core/services/api-client';

/**
 * Read side of the blog. Same shape as CatalogService: list/detail reads
 * are httpResource so templates read `.value()`/`.isLoading()` directly and
 * cooperate with the SSR transfer cache; comment submission is a one-shot
 * Observable event.
 */
@Service()
export class BlogService {
  private readonly api = inject(ApiClient);
  private readonly baseUrl = inject(API_BASE_URL);

  postsResource(query: () => PostQuery) {
    return httpResource<Paginated<PostDto>>(() => ({
      url: `${this.baseUrl}/blog/posts`,
      params: toParams({ ...query() }),
    }));
  }

  postResource(slug: () => string | undefined) {
    return httpResource<PostDto>(() => {
      const value = slug();
      return value ? { url: `${this.baseUrl}/blog/posts/${value}` } : undefined;
    });
  }

  categoriesResource() {
    return httpResource<PostCategoryDto[]>(() => ({ url: `${this.baseUrl}/blog/categories` }));
  }

  tagsResource() {
    return httpResource<TagDto[]>(() => ({ url: `${this.baseUrl}/blog/tags` }));
  }

  commentsResource(postId: () => string | undefined) {
    return httpResource<CommentDto[]>(() => {
      const value = postId();
      return value ? { url: `${this.baseUrl}/blog/posts/${value}/comments` } : undefined;
    });
  }

  submitComment(postId: string, input: SubmitCommentRequest): Observable<CommentDto> {
    return this.api.post<CommentDto>(`/blog/posts/${postId}/comments`, input);
  }
}

/** Drops undefined keys — the API rejects unknown/empty params outright. */
function toParams(
  query: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean>;
}
