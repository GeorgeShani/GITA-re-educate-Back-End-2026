// SCOPE.md's shopper-facing upload surfaces per the storefront backend
// plan (S6): "Shopper-facing uploads only — review photos and avatars."
// Deliberately excludes 'product' — MediaController's two routes (upload
// signature + register) are open to any authenticated user, and
// UploadSignatureQueryDto/RegisterMediaDto validate their ownerContext
// against this exact array, so keeping it out here is what stops a
// shopper requesting a signature for the product-image folder through
// the public routes.
export const MEDIA_OWNER_CONTEXTS = ['avatar', 'review'] as const;
export type MediaOwnerContext = (typeof MEDIA_OWNER_CONTEXTS)[number];

// Product images go through AdminMediaController instead (Phase 6,
// role-gated) — MediaService's generic upload-signature/register logic
// is reused as-is, just with a wider accepted context than the public
// DTOs above allow.
export type AnyMediaOwnerContext = MediaOwnerContext | 'product';
