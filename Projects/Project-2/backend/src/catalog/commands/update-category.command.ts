import { UpdateCategoryDto } from '../dto/update-category.dto';

export class UpdateCategoryCommand {
  constructor(
    readonly categoryId: string,
    readonly dto: UpdateCategoryDto,
    readonly correlationId: string,
  ) {}
}
