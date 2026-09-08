import { Service, inject } from '@angular/core';
import { type Observable, from, switchMap } from 'rxjs';

import type { MediaDto, Paginated, UploadSignatureDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';
import { uploadToCloudinary } from '@/app/core/services/media.service';

/**
 * The admin path onto the same signed-upload flow media.service.ts uses
 * for avatars/reviews — 'product' isn't in MEDIA_OWNER_CONTEXTS
 * (media-owner-context.ts), so a product-image signature can only ever
 * come from here, role-gated, not the public /media/upload-signature.
 */
@Service()
export class AdminMediaService {
  private readonly api = inject(ApiClient);

  list(page = 1, take = 30): Observable<Paginated<MediaDto>> {
    return this.api.get<Paginated<MediaDto>>('/admin/media', { page, take });
  }

  getUploadSignature(): Observable<UploadSignatureDto> {
    return this.api.get<UploadSignatureDto>('/admin/media/upload-signature');
  }

  /** Signs, uploads to Cloudinary, and registers the asset as a product image — the full round trip. */
  upload(file: File): Observable<MediaDto> {
    return this.getUploadSignature().pipe(
      switchMap((signed) => from(uploadToCloudinary(file, signed))),
      switchMap((publicId) => this.api.post<MediaDto>('/admin/media', { publicId })),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/media/${id}`);
  }
}
