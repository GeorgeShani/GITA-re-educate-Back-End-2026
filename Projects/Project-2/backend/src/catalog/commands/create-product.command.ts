import { CreateProductDto } from '../dto/create-product.dto';

export class CreateProductCommand {
  constructor(
    readonly dto: CreateProductDto,
    readonly correlationId: string,
  ) {}
}
