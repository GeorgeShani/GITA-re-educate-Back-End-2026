export interface CartItem {
  readonly productId: string;
  readonly variantId?: string;
  readonly slug: string;
  readonly name: string;
  readonly image: string;
  readonly price: number;
  readonly quantity: number;
}
