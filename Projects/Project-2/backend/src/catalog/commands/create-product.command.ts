import { CreateProductDto } from '@/catalog/dto/create-product.dto';

export class CreateProductCommand {
  constructor(
    readonly dto: CreateProductDto,
    readonly correlationId: string,
  ) {}
}
