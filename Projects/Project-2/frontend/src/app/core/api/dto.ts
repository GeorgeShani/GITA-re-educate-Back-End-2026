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
