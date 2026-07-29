import type { ProductCategory } from '../enums/product-category.enum';

export class Product {
  id!: number;
  name!: string;
  description!: string;
  category!: ProductCategory;
  price!: number;
  quantity!: number;
}
