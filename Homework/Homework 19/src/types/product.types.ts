export interface IProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

// Fields a client supplies to create a product — everything Mongoose/Mongo generates is excluded.
export type CreateProductDTO = Omit<IProduct, "_id" | "createdAt" | "updatedAt">;

// Same fields, all optional, for partial updates.
export type UpdateProductDTO = Partial<CreateProductDTO>;

// Lightweight shape for list views (e.g. a catalog grid that doesn't need the description).
export type ProductSummaryDTO = Pick<IProduct, "_id" | "name" | "price" | "image">;
