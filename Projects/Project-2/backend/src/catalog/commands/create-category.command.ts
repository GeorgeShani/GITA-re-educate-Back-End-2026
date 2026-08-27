import { CreateCategoryDto } from '../dto/create-category.dto';

export class CreateCategoryCommand {
  constructor(
    readonly dto: CreateCategoryDto,
    readonly correlationId: string,
  ) {}
}
