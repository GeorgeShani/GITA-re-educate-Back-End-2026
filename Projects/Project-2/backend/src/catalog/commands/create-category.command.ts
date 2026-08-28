import { CreateCategoryDto } from '@/catalog/dto/create-category.dto';

export class CreateCategoryCommand {
  constructor(
    readonly dto: CreateCategoryDto,
    readonly correlationId: string,
  ) {}
}
