export interface UploadSignatureParams {
  folder: string;
}

export interface UploadSignatureResult {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export interface UploadedAssetMetadata {
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  resourceType: string;
}

export interface UploadBufferParams {
  buffer: Buffer;
  folder: string;
  publicId: string;
  /** Cloudinary resource type — 'raw' for non-image files like a generated PDF (S9's invoice consumer). */
  resourceType: 'image' | 'raw';
}

// SCOPE.md Phase 2 — same provider-abstraction shape as MailProvider (S4)
// and PaymentProvider (S9). One implementation (CloudinaryStorageProvider)
// behind it right now, but callers depend on this interface, never on
// Cloudinary's SDK directly.
export interface StorageProvider {
  getUploadSignature(params: UploadSignatureParams): UploadSignatureResult;
  /** Authoritative metadata for an asset the client claims to have uploaded — never trust client-supplied width/height/format/bytes. */
  getAssetMetadata(publicId: string): Promise<UploadedAssetMetadata>;
  /** For server-generated files (S9's invoice PDFs) — the one case that isn't a browser-signed upload. */
  uploadBuffer(params: UploadBufferParams): Promise<UploadedAssetMetadata>;
  destroy(publicId: string): Promise<void>;
  url(publicId: string, transform: string): string;
}

export const STORAGE_PROVIDER_TOKEN = Symbol('STORAGE_PROVIDER');
