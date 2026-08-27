import { PartialType } from '@nestjs/swagger';

import { AddressDto } from '../../common/dto/address.dto';

// Every field optional — PATCH semantics, only the fields the caller
// sends are applied (see UsersService.updateAddress).
export class UpdateAddressDto extends PartialType(AddressDto) {}
