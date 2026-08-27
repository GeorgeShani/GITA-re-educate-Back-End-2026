import { PartialType } from '@nestjs/swagger';

import { CreateProductDto } from './create-product.dto';

// Every field optional — PATCH semantics. `images`/`variants`, when
// present, replace the whole embedded array rather than merging
// (UpdateProductHandler) — simplest correct behavior for admin-managed
// embedded arrays with no independent lifecycle of their own (SCOPE.md
// A9), and it's what the admin UI would always send anyway (the full
// edited list, not a diff). `publish`/unset `publish` toggles
// publishedAt; omit it to leave publish state untouched.
export class UpdateProductDto extends PartialType(CreateProductDto) {}
