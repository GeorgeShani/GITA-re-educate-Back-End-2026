import { PartialType } from '@nestjs/swagger';

import { CreateCategoryDto } from './create-category.dto';

// Every field optional — PATCH semantics. A `parentId` change is the
// re-parent (move) case: UpdateCategoryHandler detects it and rewrites
// `path` on this node and every descendant in the same transaction,
// rather than requiring a separate move endpoint.
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
