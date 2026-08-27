import { UpdateProductDto } from '../dto/update-product.dto';

export class UpdateProductCommand {
  constructor(
    readonly productId: string,
    readonly dto: UpdateProductDto,
    readonly correlationId: string,
  ) {}
}
