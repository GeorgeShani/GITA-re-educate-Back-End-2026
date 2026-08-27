import { AddressDto } from '../../common/dto/address.dto';

export class PlaceOrderCommand {
  constructor(
    readonly userId: string,
    readonly shippingAddress: AddressDto,
    readonly billingAddress: AddressDto,
    readonly shippingMethod: string,
    readonly customerNote: string | undefined,
    readonly correlationId: string,
  ) {}
}
