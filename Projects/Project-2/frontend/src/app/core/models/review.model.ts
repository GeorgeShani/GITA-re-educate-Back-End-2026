export interface Review {
  readonly id: string;
  readonly productId: string;
  readonly author: string;
  readonly rating: number;
  readonly title?: string;
  readonly body: string;
  readonly createdAt: string;
}
