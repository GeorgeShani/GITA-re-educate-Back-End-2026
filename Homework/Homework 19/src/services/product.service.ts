import type { HydratedDocument } from "mongoose";
import { Product } from "../models/product.model";
import type {
  CreateProductDTO,
  ProductSummaryDTO,
  UpdateProductDTO,
} from "../types/product.types";

type ProductDocument = HydratedDocument<CreateProductDTO>;

export async function getAllProducts(): Promise<ProductDocument[]> {
  return Product.find();
}

export async function getProductSummaries(): Promise<ProductSummaryDTO[]> {
  return Product.find().select("name price image").lean<ProductSummaryDTO[]>();
}

export async function getProductById(
  id: string,
): Promise<ProductDocument | null> {
  return Product.findById(id);
}

export async function createProduct(
  data: CreateProductDTO,
): Promise<ProductDocument> {
  return Product.create(data);
}

export async function updateProduct(
  id: string,
  data: UpdateProductDTO,
): Promise<ProductDocument | null> {
  return Product.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
}

export async function deleteProduct(
  id: string,
): Promise<ProductDocument | null> {
  return Product.findByIdAndDelete(id);
}
