/**
 * Wire shapes returned by the NestJS API, mirrored exactly.
 *
 * Two conventions inherited from the backend and deliberately preserved
 * rather than translated at the boundary:
 *
 * 1. **All money is integer minor units** (`4499` is $44.99). Converting to
 *    floats here would reintroduce the rounding errors the backend went out
 *    of its way to avoid, so amounts stay integers all the way to the
 *    template and are formatted by MoneyPipe at render time.
 * 2. **Every entity serialises `id`, never `_id`**, plus `createdAt` and
 *    `updatedAt` as ISO strings.
 */

/** Shape of every paginated list endpoint. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  take: number;
}

/**
 * AllExceptionsFilter's envelope. `message` is a string[] when it comes from
 * the global ValidationPipe and a plain string otherwise.
 */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  correlationId?: string;
  timestamp: string;
}

// ---------------------------------------------------------------- catalog

export interface ProductImageDto {
  id: string;
  publicId: string;
  url: string;
  width: number;
  height: number;
  alt: string;
  position: number;
}

export interface ProductVariantDto {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  priceMinor?: number;
  compareAtPriceMinor?: number;
  barcode?: string;
  weightGrams?: number;
  isActive: boolean;
}

export interface ProductDto {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  description: string;
  tags: string[];
  categoryId: string;
  basePriceMinor: number;
  compareAtPriceMinor?: number;
  images: ProductImageDto[];
  variants: ProductVariantDto[];
  careInstructions?: string;
  specSheetUrl?: string;
  isFeatured: boolean;
  publishedAt: string | null;
  seoTitle?: string;
  seoDescription?: string;
  seoOgImageUrl?: string;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeNodeDto {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  children: CategoryTreeNodeDto[];
}

export interface ProductFacetsDto {
  brands: { brand: string; count: number }[];
  priceRange: { min: number; max: number };
}

/** Query for GET /products. Sent as-is, so it must match FindProductsDto. */
export interface ProductQuery {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  isFeatured?: boolean;
  sort?: 'price' | 'newest' | 'rating' | 'popularity';
  order?: 'asc' | 'desc';
  page?: number;
  take?: number;
}

export interface StockDto {
  quantityAvailable: number;
  inStock: boolean;
  backorderAllowed: boolean;
  lowStock: boolean;
}

// ------------------------------------------------------------------ reviews

/**
 * `userId` is a bare id, never populated with a name/avatar server-side
 * (see backend/src/reviews/schemas/review.schema.ts) — the reviews list UI
 * must not invent an author name from this alone. `isVerifiedPurchase` is
 * the one piece of author context the API actually gives us.
 */
export interface ReviewDto {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  body: string;
  isVerifiedPurchase: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------------- cart

export interface CartLineDto {
  itemId: string;
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl?: string;
  variantSku: string;
  variantAttributes: Record<string, string>;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  weightGrams: number;
}

/**
 * Note what is NOT here: no discount, tax, shipping or total. The cart
 * endpoints only ever return a subtotal — applying a coupon just echoes the
 * code back. Totals first exist at GET /checkout/quote.
 */
export interface CartSummaryDto {
  cartId: string;
  items: CartLineDto[];
  subtotalMinor: number;
  itemCount: number;
  couponCode?: string;
}

// ------------------------------------------------------------------- auth

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export type RoleDto = 'admin' | 'manager' | 'support' | 'editor' | 'customer';

export interface AddressDto {
  id: string;
  fullName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
  isDefault?: boolean;
}

/** GET /auth/me. `roles` is the full array; the JWT only carries roles[0]. */
export interface UserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  lastLoginAt?: string;
  phone?: string;
  roles: RoleDto[];
  addresses: AddressDto[];
  avatarUrl?: string;
  isDeleted: boolean;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Decoded access-token payload. Carries a single active role. */
export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: RoleDto;
  exp: number;
  iat: number;
}

// --------------------------------------------------------------- checkout

/**
 * What a new/typed-in address looks like on the wire — the same shape as
 * `AddressDto` minus `id`, since an id only exists once it's been saved to
 * a user's address book. Mirrors backend/src/common/dto/address.dto.ts.
 */
export interface AddressInput {
  fullName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
  isDefault?: boolean;
}

export interface ShippingOptionDto {
  method: string;
  priceMinor: number;
  estimatedDaysMin?: number;
  estimatedDaysMax?: number;
  /** priceMinor after a free_shipping coupon, if any (else = priceMinor). */
  effectivePriceMinor: number;
  /** subtotal - discount + effectivePrice + tax for choosing this option. */
  totalMinor: number;
}

/**
 * GET /checkout/quote. An estimate, not authoritative — the real charge is
 * whatever the resulting Order says. Notably: tax here is already computed
 * on the post-discount subtotal (checkout.service.ts's getQuote), matching
 * place-order exactly, so shippingOptions[].totalMinor is the true payable
 * total for that option.
 */
export interface CheckoutQuoteDto {
  items: CartLineDto[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  shippingOptions: ShippingOptionDto[];
  couponCode?: string;
}

export interface PlaceOrderRequest {
  shippingAddress: AddressInput;
  billingAddress: AddressInput;
  /** One of the `method` values from a CheckoutQuoteDto.shippingOptions entry. */
  shippingMethod: string;
  customerNote?: string;
}

// ----------------------------------------------------------------- orders

/** Mirrors backend/src/orders/enums/order-status.enum.ts. */
export type OrderStatus =
  | 'placed'
  | 'paid'
  | 'payment_failed'
  | 'confirmed'
  | 'fulfilled'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

/**
 * A frozen line snapshot taken at checkout — no `variantAttributes` (unlike
 * CartLineDto), because Order.items never references the live product, only
 * what was true the moment the order was placed.
 *
 * `_id`, not `id`: OrderItem is an embedded subdocument
 * (order.schema.ts's `@Schema({ _id: true })`) that does NOT use
 * baseSchemaOptions, so the "every entity serialises id, never _id"
 * convention at the top of this file does not extend to it — confirmed
 * against a real response, not assumed.
 */
export interface OrderItemDto {
  _id: string;
  productId: string;
  variantSku: string;
  nameSnapshot: string;
  imageUrlSnapshot?: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItemDto[];
  shippingAddress: AddressInput;
  billingAddress: AddressInput;
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: string;
  couponCode?: string;
  status: OrderStatus;
  paymentId?: string;
  cancelledReason?: string;
  customerNote?: string;
  invoiceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceOrderResultDto {
  order: OrderDto;
  /** The PaymentIntent's client secret — hand this straight to stripe.elements(). */
  clientSecret: string;
}

/** GET /orders/track. Deliberately minimal — a public, unauthenticated lookup. */
export interface TrackingInfoDto {
  orderNumber: string;
  status: OrderStatus;
  city: string;
  countryCode: string;
  placedAt: string;
}

// ---------------------------------------------------------------- account

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** A Cloudinary secure_url from POST /media (ownerContext: avatar). */
  avatarUrl?: string;
}

/**
 * GET /users/me/export — GDPR right to access. Each section is whatever
 * that collection's own toJSON() produces server-side; there's no fixed
 * shape worth typing beyond that; the UI's only job is to offer this as
 * a downloadable file, not to render it field by field.
 */
export interface AccountExportDto {
  exportedAt: string;
  profile: Record<string, unknown>;
  orders: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
  wishlist: Record<string, unknown>[];
}

/** Mirrors backend/src/notifications/schemas/email-message.schema.ts's EmailCategory. */
export type EmailCategory = 'transactional' | 'security' | 'ops' | 'marketing' | 'opt-in';

/**
 * GET /users/me/notification-preferences. transactional/security/ops are
 * never opt-out-able server-side — optedInCategories always carries them
 * regardless of what the UI shows, only 'marketing'/'opt-in' ever move.
 */
export interface NotificationPreferenceDto {
  id: string;
  userId: string;
  optedInCategories: EmailCategory[];
  createdAt: string;
  updatedAt: string;
}

// --------------------------------------------------------------- wishlist

export interface WishlistProductSummary {
  name: string;
  slug: string;
  brand?: string;
  basePriceMinor: number;
  compareAtPriceMinor?: number;
  image?: { url: string; alt: string };
}

export interface WishlistEntryDto {
  productId: string;
  addedAt: string;
  /** null when the product was deleted/unpublished out from under the wishlist entry. */
  product: WishlistProductSummary | null;
}

// ---------------------------------------------------------------- returns

/** Mirrors backend/src/returns/enums/return-status.enum.ts. */
export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'received' | 'refunded';

export interface ReturnItemDto {
  id: string;
  orderItemId: string;
  quantity: number;
  reason: string;
}

export interface ReturnDto {
  id: string;
  orderId: string;
  userId: string;
  items: ReturnItemDto[];
  status: ReturnStatus;
  adminNote?: string;
  refundId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestReturnItemInput {
  /** The order line's own id (OrderItemDto._id). */
  orderItemId: string;
  quantity: number;
  reason: string;
}

export interface RequestReturnRequest {
  orderId: string;
  items: RequestReturnItemInput[];
}

// --------------------------------------------------------- payment methods

export interface SavedPaymentMethodDto {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface SetupIntentResultDto {
  clientSecret: string;
}

// -------------------------------------------------------------------- media

/**
 * GET /media/upload-signature. Handed to Cloudinary's unsigned browser
 * upload endpoint verbatim — the client never sees or needs an API
 * secret, only this short-lived signed payload.
 */
export interface UploadSignatureDto {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadPreset?: string;
}

export interface MediaDto {
  id: string;
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  resourceType: string;
  ownerContext?: string;
  uploadedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------- content (F9)

export interface PostCategoryDto {
  id: string;
  name: string;
  slug: string;
}

/** No `slug` — Tag's own schema never added one, so tag archives filter by id. */
export interface TagDto {
  id: string;
  name: string;
}

/**
 * `authorId` is a raw ObjectId string — PublicBlogService never populates
 * it, so there's no public author name/avatar to show, same "attribute by
 * what's actually available, not an invented name" call as ReviewDto in F5.
 */
export interface PostDto {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  body: string;
  coverImageUrl?: string;
  authorId: string;
  categoryId?: string;
  tagIds: string[];
  publishedAt: string | null;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export type CommentStatus = 'pending' | 'approved' | 'rejected';

export interface CommentDto {
  id: string;
  postId: string;
  userId?: string;
  authorName: string;
  authorEmail: string;
  body: string;
  parentId?: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitCommentRequest {
  authorName: string;
  authorEmail: string;
  body: string;
  parentId?: string;
}

/** Query for GET /blog/posts. Sent as-is, so it must match FindPostsDto — category/tag are ids, not slugs (PostCategory has a slug, Tag never does). */
export interface PostQuery {
  category?: string;
  tag?: string;
  page?: number;
  take?: number;
}

export interface PageDto {
  id: string;
  title: string;
  slug: string;
  body: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface SubmitContactMessageRequest {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export interface NewsletterSubscriberDto {
  id: string;
  email: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
}
