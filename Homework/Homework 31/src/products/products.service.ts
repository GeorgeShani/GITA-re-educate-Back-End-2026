import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Service } from '../aws/s3.service';
import { paginate } from '../common/utils/paginate.util';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsDto } from './dto/find-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductPhoto } from './entities/product-photo.entity';
import { Product } from './entities/product.entity';

const SUBSCRIBER_DISCOUNT_PERCENTAGE = 20;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductPhoto)
    private readonly productPhotosRepository: Repository<ProductPhoto>,
    private readonly s3Service: S3Service,
  ) {}

  create(createProductDto: CreateProductDto) {
    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async findAll(query: FindProductsDto, hasActiveSubscription: boolean) {
    const { page = 1, limit = 10, category } = query;

    const [data, total] = await this.productsRepository.findAndCount({
      where: category ? { category } : {},
      relations: { photos: true },
      skip: (page - 1) * limit,
      take: limit,
    });

    const withPricing = data.map((product) =>
      this.withPricing(product, hasActiveSubscription),
    );

    return paginate(withPricing, total, page, limit);
  }

  async findOne(id: number) {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: { photos: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return this.productsRepository.save(product);
  }

  async remove(id: number) {
    const product = await this.findOne(id);

    // `photos` cascades at the DB level (ProductPhoto has onDelete:
    // 'CASCADE'), so the rows disappear on their own — but that's a SQL
    // FK cascade, not something TypeORM can turn into an S3 delete call
    // for us. Without this, every deleted product would silently leave
    // its photo files behind in the bucket forever.
    await Promise.all(
      product.photos.map((photo) => this.s3Service.delete(photo.key)),
    );

    await this.productsRepository.remove(product);
    return product;
  }

  /**
   * Adds one or more photos to a product's gallery. A single-file upload
   * and a multi-file upload go through this same method — the client just
   * sends 1..N files under the same "photos" field, so there's no need for
   * separate single/multiple endpoints.
   */
  async addPhotos(id: number, files: Express.Multer.File[]) {
    const product = await this.findOne(id);
    const uploaded = await this.s3Service.uploadMany(files, `products/${id}`);

    const photos = uploaded.map((file) =>
      this.productPhotosRepository.create({ ...file, product }),
    );

    return this.productPhotosRepository.save(photos);
  }

  async removePhoto(productId: number, photoId: number) {
    // Ensuring the product itself exists first gives a clearer 404 when
    // someone passes a bogus productId, instead of the ambiguous "photo not
    // found" that a plain photo lookup would produce either way.
    await this.findOne(productId);

    const photo = await this.productPhotosRepository.findOne({
      where: { id: photoId, product: { id: productId } },
    });

    if (!photo) {
      throw new NotFoundException(
        `Photo with id ${photoId} not found on product ${productId}`,
      );
    }

    await this.s3Service.delete(photo.key);
    await this.productPhotosRepository.remove(photo);
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
