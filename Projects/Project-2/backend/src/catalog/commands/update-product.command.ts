import { UpdateProductDto } from '@/catalog/dto/update-product.dto';

export class UpdateProductCommand {
  constructor(
    readonly productId: string,
    readonly dto: UpdateProductDto,
    readonly correlationId: string,
  ) {}
}
