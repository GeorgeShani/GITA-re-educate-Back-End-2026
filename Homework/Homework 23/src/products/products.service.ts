import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../common/utils/paginate.util';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

const SUBSCRIBER_DISCOUNT_PERCENTAGE = 20;

@Injectable()
export class ProductsService {
  private products: Product[] = [];
  private nextId = 1;

  create(createProductDto: CreateProductDto) {
    const product: Product = {
      id: this.nextId++,
      ...createProductDto,
    };

    this.products.push(product);
    return product;
  }

  findAll(query: FindProductsDto, hasActiveSubscription: boolean) {
    const { page = 1, take = 30, category } = query;

    const filtered = category
      ? this.products.filter((product) => product.category === category)
      : this.products;

    return paginate(filtered, page, take).map((product) =>
      this.withPricing(product, hasActiveSubscription),
    );
  }

  findOne(id: number) {
    const product = this.products.find((product) => product.id === id);

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }

  update(id: number, updateProductDto: UpdateProductDto) {
    const product = this.findOne(id);

    Object.assign(product, updateProductDto);
    return product;
  }

  remove(id: number) {
    const index = this.products.findIndex((product) => product.id === id);

    if (index === -1) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    const [removedProduct] = this.products.splice(index, 1);
    return removedProduct;
  }

  private withPricing(product: Product, hasActiveSubscription: boolean) {
    const discountPercentage = hasActiveSubscription
      ? SUBSCRIBER_DISCOUNT_PERCENTAGE
      : 0;

    const finalPrice = Number(
      (product.price * (1 - discountPercentage / 100)).toFixed(2),
    );

    return { ...product, discountPercentage, finalPrice };
  }
}
