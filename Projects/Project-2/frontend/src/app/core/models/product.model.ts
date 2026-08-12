/** Mirrors SCOPE.md A8 — golf domain model. */
export type ProductCategory =
  | 'gloves'
  | 'balls'
  | 'tees'
  | 'headcovers'
  | 'towels'
  | 'bags'
  | 'rangefinders-gps'
  | 'apparel'
  | 'training-aids'
  | 'accessories';

export interface ProductImage {
  readonly url: string;
  readonly alt: string;
}

/** Variant attributes per SCOPE.md A8 — not every product uses every key. */
export interface ProductVariantAttributes {
  readonly hand?: 'left' | 'right';
  readonly size?: string;
  readonly flex?: string;
  readonly loft?: string;
  readonly dexterity?: string;
  readonly colourway?: string;
  readonly material?: string;
  readonly compression?: string;
  readonly packSize?: number;
}

export interface ProductVariant {
  readonly id: string;
  readonly sku: string;
  readonly attributes: ProductVariantAttributes;
  readonly price: number;
  readonly stock: number;
}

/**
 * `publishedAt` is an ISO date string, not a Date — Date objects don't
 * survive JSON (de)serialization as Dates, and constructing one from a
 * server-sent timestamp vs. a client-parsed one is exactly the kind of
 * environment-dependent global the project rule against `new Date()`
 * assumptions is about. Format at the point of display, not in the model.
 */
export interface Product {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly brand: string;
  readonly sku: string;
  readonly category: ProductCategory;
  readonly description: string;
  readonly price: number;
  readonly originalPrice?: number;
  readonly images: ProductImage[];
  readonly variants: ProductVariant[];
  readonly rating?: number;
  readonly reviewCount?: number;
  readonly isFeatured: boolean;
  readonly publishedAt: string;
}
