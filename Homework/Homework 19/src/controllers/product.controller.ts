import type { Request, Response } from "express";
import * as productService from "../services/product.service";
import type { CreateProductDTO, UpdateProductDTO } from "../types/product.types";

export type ProductParams = { id: string };

export async function getAllProducts(req: Request, res: Response): Promise<void> {
  const products = await productService.getAllProducts();
  res.json(products);
}

export async function getProductSummaries(req: Request, res: Response): Promise<void> {
  const summaries = await productService.getProductSummaries();
  res.json(summaries);
}

export async function getProductById(
  req: Request<ProductParams>,
  res: Response,
): Promise<void> {
  const product = await productService.getProductById(req.params.id);

  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  res.json(product);
}

export async function createProduct(
  req: Request<{}, unknown, CreateProductDTO>,
  res: Response,
): Promise<void> {
  const product = await productService.createProduct(req.body);
  res.status(201).json(product);
}

export async function updateProduct(
  req: Request<ProductParams, unknown, UpdateProductDTO>,
  res: Response,
): Promise<void> {
  const product = await productService.updateProduct(req.params.id, req.body);

  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  res.json(product);
}

export async function deleteProduct(
  req: Request<ProductParams>,
  res: Response,
): Promise<void> {
  const product = await productService.deleteProduct(req.params.id);

  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return;
  }

  res.json({ message: "Product deleted successfully" });
}
