import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './schemas/product.schema';

const SUBSCRIBER_DISCOUNT_PERCENTAGE = 20;

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  create(createProductDto: CreateProductDto) {
    return this.productModel.create(createProductDto);
  }

  async findAll(query: FindProductsDto, hasActiveSubscription: boolean) {
    const { page = 1, take = 30, category } = query;
    const mongoFilter: Record<string, unknown> = category ? { category } : {};

    const products = await this.productModel
      .find(mongoFilter)
      .skip((page - 1) * take)
      .limit(take)
      .exec();

    return products.map((product) =>
      this.withPricing(product, hasActiveSubscription),
    );
  }

  async findOne(id: string) {
    const product = await this.productModel.findById(id).exec();

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productModel
      .findByIdAndUpdate(id, updateProductDto, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }

  async remove(id: string) {
    const product = await this.productModel.findByIdAndDelete(id).exec();

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }

  private withPricing(
    product: ProductDocument,
    hasActiveSubscription: boolean,
  ) {
    const discountPercentage = hasActiveSubscription
      ? SUBSCRIBER_DISCOUNT_PERCENTAGE
      : 0;

    const finalPrice = Number(
      (product.price * (1 - discountPercentage / 100)).toFixed(2),
    );

    return { ...product.toJSON(), discountPercentage, finalPrice };
  }
}
