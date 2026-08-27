import { PartialType } from '@nestjs/swagger';

import { CreateShippingZoneDto } from './create-shipping-zone.dto';

// `rates`, when present, replaces the whole embedded array — same
// convention as Product.images/variants (see update-product.dto.ts).
export class UpdateShippingZoneDto extends PartialType(CreateShippingZoneDto) {}
