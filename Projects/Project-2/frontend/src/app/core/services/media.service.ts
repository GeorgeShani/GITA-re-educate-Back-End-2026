import { Service, inject } from '@angular/core';
import { type Observable, from, switchMap } from 'rxjs';

import type { MediaDto, UploadSignatureDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

type OwnerContext = 'avatar' | 'review';

/**
 * Direct-to-Cloudinary upload: GET a signed payload from our own API,
 * POST the file straight to Cloudinary with it (the API never sees or
 * proxies the file itself), then register the resulting publicId with
 * our API so it's tracked in the media collection.
 * Source: https://cloudinary.com/documentation/upload_images#authenticated_requests
 * — folder (and upload_preset, if configured) must be forwarded verbatim
 * because they were part of what the backend's signature covers.
 */
@Service()
export class MediaService {
  private readonly api = inject(ApiClient);

  getUploadSignature(ownerContext: OwnerContext): Observable<UploadSignatureDto> {
    return this.api.get<UploadSignatureDto>('/media/upload-signature', { ownerContext });
  }

  /** Signs, uploads to Cloudinary, and registers the asset — the full round trip in one call. */
  upload(file: File, ownerContext: OwnerContext): Observable<MediaDto> {
    return this.getUploadSignature(ownerContext).pipe(
      switchMap((signed) => from(uploadToCloudinary(file, signed))),
      switchMap((publicId) => this.api.post<MediaDto>('/media', { publicId, ownerContext })),
    );
  }
}

/** Shared with admin-media.service.ts's product-image upload — the Cloudinary POST itself is identical regardless of ownerContext. */
export async function uploadToCloudinary(file: File, signed: UploadSignatureDto): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', String(signed.timestamp));
  form.append('signature', signed.signature);
  form.append('folder', signed.folder);
  if (signed.uploadPreset) form.append('upload_preset', signed.uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Cloudinary upload failed (${response.status})`);
  }
  const result = (await response.json()) as { public_id: string };
  return result.public_id;
}
