import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { ProductCategory } from '../enums/product-category.enum';

export type ProductDocument = HydratedDocument<Product>;

@Schema(baseSchemaOptions)
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ required: true, enum: ProductCategory })
  category!: ProductCategory;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, min: 0 })
  quantity!: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
