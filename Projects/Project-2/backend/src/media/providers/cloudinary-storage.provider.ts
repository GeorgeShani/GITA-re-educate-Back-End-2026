import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

import type {
  StorageProvider,
  UploadedAssetMetadata,
  UploadSignatureParams,
  UploadSignatureResult,
} from './storage-provider.interface';

// cloudinary's own types declare api.resource() as Promise<any> — the
// fields actually documented on its response, typed here once so the
// rest of the class isn't riddled with unsafe-any lint suppressions.
interface CloudinaryResourceResponse {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  resource_type: string;
}

// SCOPE.md Phase 2 — signed direct-to-Cloudinary uploads. The backend
// never touches upload bytes: it signs a small parameter set (folder +
// timestamp), the browser POSTs straight to Cloudinary with that
// signature, and the backend only re-enters the picture to record what
// happened (getAssetMetadata, called from the registration command) or
// clean up (destroy, called from the media.deleted consumer).
@Injectable()
export class CloudinaryStorageProvider
  implements StorageProvider, OnModuleInit
{
  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>(
        'CLOUDINARY_CLOUD_NAME',
      ),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>(
        'CLOUDINARY_API_SECRET',
      ),
      secure: true,
    });
  }

  getUploadSignature(params: UploadSignatureParams): UploadSignatureResult {
    const timestamp = Math.round(Date.now() / 1000);
    const apiSecret = this.configService.getOrThrow<string>(
      'CLOUDINARY_API_SECRET',
    );
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: params.folder },
      apiSecret,
    );

    return {
      signature,
      timestamp,
      apiKey: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      cloudName: this.configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      folder: params.folder,
    };
  }

  async getAssetMetadata(publicId: string): Promise<UploadedAssetMetadata> {
    const resource = (await cloudinary.api.resource(
      publicId,
    )) as CloudinaryResourceResponse;
    return {
      publicId: resource.public_id,
      url: resource.secure_url,
      width: resource.width,
      height: resource.height,
      format: resource.format,
      bytes: resource.bytes,
      resourceType: resource.resource_type,
    };
  }

  async destroy(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  url(publicId: string, transform: string): string {
    return cloudinary.url(publicId, {
      transformation: transform,
      secure: true,
    });
  }
}
