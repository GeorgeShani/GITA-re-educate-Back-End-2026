// SCOPE.md's shopper-facing upload surfaces per the storefront backend
// plan (S6): "Shopper-facing uploads only — review photos and avatars."
// Product images are seed-script-only (no admin CRUD in scope), so
// there's no 'product' context here despite the Media schema's comment
// mentioning it as a future possibility.
export const MEDIA_OWNER_CONTEXTS = ['avatar', 'review'] as const;
export type MediaOwnerContext = (typeof MEDIA_OWNER_CONTEXTS)[number];
