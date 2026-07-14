import { Schema, model } from "mongoose";
import type { CreateProductDTO } from "../types/product.types";

const productSchema = new Schema<CreateProductDTO>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
  },
  { timestamps: true, versionKey: false },
);

export const Product = model<CreateProductDTO>("Product", productSchema);
